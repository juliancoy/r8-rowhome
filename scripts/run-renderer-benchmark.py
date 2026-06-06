#!/usr/bin/env python3
import json
import os
import signal
import shutil
import ssl
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.request
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
PORT = int(os.environ.get("BENCHMARK_PORT", "5174"))
BASE_URL = f"https://127.0.0.1:{PORT}"
BUILD_DIR = ROOT / "artifacts" / "renderer-benchmark-dist"
OUTPUT_DIR = ROOT / "artifacts" / "performance"
LOCAL_BIN = ROOT / "node_modules" / ".bin"


class RendererSampleTimeout(RuntimeError):
    pass


@contextmanager
def timeout_after(seconds: int, label: str):
    def raise_timeout(signum, frame):
        raise RendererSampleTimeout(f"Timed out after {seconds}s while sampling {label}")

    previous_handler = signal.signal(signal.SIGALRM, raise_timeout)
    signal.setitimer(signal.ITIMER_REAL, seconds)
    try:
        yield
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous_handler)


def run(command: list[str]) -> None:
    subprocess.run(command, cwd=ROOT, check=True)


def wait_for_server(process: subprocess.Popen, timeout_seconds: float = 30) -> None:
    deadline = time.monotonic() + timeout_seconds
    ssl_context = ssl._create_unverified_context()
    last_error: Exception | None = None
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"preview server exited early with code {process.returncode}")
        try:
            with urllib.request.urlopen(BASE_URL, context=ssl_context, timeout=1) as response:
                if response.status < 500:
                    return
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            last_error = error
            time.sleep(0.25)
    raise TimeoutError(f"Timed out waiting for {BASE_URL}: {last_error}")


def start_preview() -> subprocess.Popen:
    return subprocess.Popen(
        [
            str(LOCAL_BIN / "vite"),
            "preview",
            "--host",
            "127.0.0.1",
            "--port",
            str(PORT),
            "--strictPort",
            "--outDir",
            str(BUILD_DIR),
        ],
        cwd=ROOT,
        start_new_session=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )


def stop_process(process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return
    os.killpg(process.pid, signal.SIGTERM)
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        process.wait(timeout=5)


def summarize_runs(runs: list[dict]) -> dict:
    keys = [
        "averageFrameMs",
        "medianFrameMs",
        "p95FrameMs",
        "minFrameMs",
        "maxFrameMs",
        "averageRenderMs",
        "medianRenderMs",
        "p95RenderMs",
        "maxRenderMs",
        "directAverageRenderMs",
        "directMedianRenderMs",
        "directP95RenderMs",
        "directMaxRenderMs",
    ]
    successful_runs = [run for run in runs if not run.get("failed")]
    if not successful_runs:
        return {
            key: 0
            for key in keys
        } | {
            "frames": 0,
            "runs": len(runs),
            "failedRuns": len(runs),
        }
    return {
        key: statistics.mean(run[key] for run in successful_runs)
        for key in keys
    } | {
        "frames": sum(run["frames"] for run in successful_runs),
        "runs": len(runs),
        "failedRuns": len(runs) - len(successful_runs),
    }


def adapter_info(page) -> dict:
    return page.evaluate(
        """async () => {
            if (!navigator.gpu) {
                return { available: false };
            }
            const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
            if (!adapter) {
                return { available: true, adapter: null };
            }
            return {
                available: true,
                adapter: {
                    info: adapter.info ?? null,
                    features: Array.from(adapter.features ?? []).sort(),
                    limits: {
                        maxTextureDimension2D: adapter.limits?.maxTextureDimension2D,
                        maxBufferSize: adapter.limits?.maxBufferSize,
                        maxBindGroups: adapter.limits?.maxBindGroups
                    }
                }
            };
        }"""
    )


def webgpu_looks_software_backed(webgpu: dict | None) -> bool:
    if not webgpu or not webgpu.get("available"):
        return False
    label = json.dumps(webgpu, sort_keys=True).lower()
    software_markers = ["swiftshader", "llvmpipe", "software", "cpu", "mesa offscreen"]
    return any(marker in label for marker in software_markers)


def failed_renderer_sample(mode: str, error: Exception) -> dict:
    return {
        "averageFrameMs": 0,
        "medianFrameMs": 0,
        "p95FrameMs": 0,
        "minFrameMs": 0,
        "maxFrameMs": 0,
        "averageRenderMs": 0,
        "medianRenderMs": 0,
        "p95RenderMs": 0,
        "maxRenderMs": 0,
        "directAverageRenderMs": 0,
        "directMedianRenderMs": 0,
        "directP95RenderMs": 0,
        "directMaxRenderMs": 0,
        "frames": 0,
        "directCalls": 0,
        "directError": str(error),
        "requestedMode": mode,
        "actualMode": "failed",
        "failed": True,
    }


def wait_for_hook(page) -> None:
    page.wait_for_function("() => Boolean(window.__r8RowhomeBenchmark)", timeout=30_000)


def run_renderer_sample(page, mode: str, warmup_frames: int, sample_frames: int, warmup_calls: int, sample_calls: int) -> dict:
    actual_mode = page.evaluate(
        """async ([mode]) => {
            return await window.__r8RowhomeBenchmark.setRendererMode(mode);
        }""",
        [mode],
    )
    page.wait_for_timeout(1000)
    measurement = page.evaluate(
        """async ([warmupFrames, sampleFrames]) => {
            return await window.__r8RowhomeBenchmark.sampleFrames({ warmupFrames, sampleFrames });
        }""",
        [warmup_frames, sample_frames],
    )
    direct_error = None
    try:
        direct = page.evaluate(
            """([warmupCalls, sampleCalls]) => {
                return window.__r8RowhomeBenchmark.sampleRenderCalls({ warmupCalls, sampleCalls });
            }""",
            [warmup_calls, sample_calls],
        )
    except PlaywrightError as error:
        direct_error = str(error)
        direct = {
            "averageRenderMs": 0,
            "medianRenderMs": 0,
            "p95RenderMs": 0,
            "maxRenderMs": 0,
            "calls": 0,
        }
    return {
        **measurement,
        "directAverageRenderMs": direct["averageRenderMs"],
        "directMedianRenderMs": direct["medianRenderMs"],
        "directP95RenderMs": direct["p95RenderMs"],
        "directMaxRenderMs": direct["maxRenderMs"],
        "directCalls": direct["calls"],
        "directError": direct_error,
        "requestedMode": mode,
        "actualMode": actual_mode,
    }


def markdown_report(report: dict) -> str:
    lines = [
        "# Renderer Benchmark",
        "",
        f"- Generated: `{report['generatedAt']}`",
        f"- Browser: `{report['browser']['version']}`",
        f"- User agent: `{report['browser']['userAgent']}`",
        f"- WebGPU adapter: `{json.dumps(report['webgpu'], sort_keys=True)}`",
        "",
        "| View | Requested | Actual | RAF avg ms | RAF p95 ms | Loop render avg ms | Direct render avg ms | Direct p95 ms | Frames | Runs |",
        "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for result in report["results"]:
        summary = result["summary"]
        lines.append(
            f"| {result['view']} | {result['mode']} | "
            f"{', '.join(result['actualModes'])} | "
            f"{summary['averageFrameMs']:.2f} | {summary['p95FrameMs']:.2f} | "
            f"{summary['averageRenderMs']:.2f} | {summary['directAverageRenderMs']:.2f} | {summary['directP95RenderMs']:.2f} | "
            f"{summary['frames']} | {summary['runs']} |"
        )
    lines.extend(
        [
            "",
            "## Scene Stats",
            "",
            "```json",
            json.dumps(report["sceneStats"], indent=2, sort_keys=True),
            "```",
            "",
            "## Notes",
            "",
            "- Measurements are production-build browser automation timings based on `requestAnimationFrame` intervals after warmup.",
            "- WebGPU availability and speed depend heavily on Chrome, OS, GPU driver, adapter selection, and whether headless Chrome is using hardware acceleration or a software adapter.",
        ]
    )
    if report.get("notes"):
        lines.extend(["", "## Run Notes", ""])
        lines.extend(f"- {note}" for note in report["notes"])
    direct_errors = [
        {
            "view": result["view"],
            "mode": result["mode"],
            "errors": [run["directError"] for run in result["runs"] if run.get("directError")],
        }
        for result in report["results"]
    ]
    direct_errors = [item for item in direct_errors if item["errors"]]
    if direct_errors:
        lines.extend(
            [
                "",
                "## Direct Render Errors",
                "",
                "```json",
                json.dumps(direct_errors, indent=2),
                "```",
            ]
        )
    return "\n".join(lines) + "\n"


def main() -> int:
    warmup_frames = int(os.environ.get("BENCHMARK_WARMUP_FRAMES", "30"))
    sample_frames = int(os.environ.get("BENCHMARK_SAMPLE_FRAMES", "120"))
    warmup_calls = int(os.environ.get("BENCHMARK_WARMUP_CALLS", "10"))
    sample_calls = int(os.environ.get("BENCHMARK_SAMPLE_CALLS", "60"))
    repeats = int(os.environ.get("BENCHMARK_REPEATS", "2"))
    sample_timeout_seconds = int(os.environ.get("BENCHMARK_SAMPLE_TIMEOUT_SECONDS", "45"))
    include_webgpu = os.environ.get("BENCHMARK_INCLUDE_WEBGPU", "auto").lower()
    run_browser_benchmark = os.environ.get("BENCHMARK_RUN_BROWSER", "0").lower() in {"1", "true", "yes"}
    views = [
        ("model", "#camera-interior"),
        ("structural-demand", "#structural-demand"),
        ("review-sheet", "#camera-sheet"),
    ]

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    run(["npm", "run", "generate:documents"])
    run([str(LOCAL_BIN / "tsc")])
    run([str(LOCAL_BIN / "vite"), "build", "--outDir", str(BUILD_DIR), "--emptyOutDir"])

    if not run_browser_benchmark:
        report = {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "browser": {
                "version": "not-run",
                "userAgent": "not-run",
            },
            "webgpu": {
                "available": "not-probed",
            },
            "warmupFrames": warmup_frames,
            "sampleFrames": sample_frames,
            "warmupCalls": warmup_calls,
            "sampleCalls": sample_calls,
            "repeats": repeats,
            "sampleTimeoutSeconds": sample_timeout_seconds,
            "sceneStats": {
                "status": "not-collected",
            },
            "notes": [
                "Browser timing is opt-in because Playwright headless Chrome uses a software GPU backend in this environment and can hang while timing renderer frames.",
                "Run with BENCHMARK_RUN_BROWSER=1 for WebGL timing on a machine where headless Chrome is backed by a real GPU.",
                "Run with BENCHMARK_RUN_BROWSER=1 BENCHMARK_INCLUDE_WEBGPU=1 only when Chrome has a working hardware WebGPU adapter.",
            ],
            "results": [],
        }
        (OUTPUT_DIR / "renderer-benchmark.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")
        (OUTPUT_DIR / "renderer-benchmark.md").write_text(markdown_report(report), encoding="utf8")
        print(markdown_report(report))
        return 0

    preview = start_preview()
    try:
        wait_for_server(preview)
        with sync_playwright() as playwright:
            browser_args = []
            if include_webgpu in {"1", "true", "yes"}:
                browser_args = [
                    "--enable-unsafe-webgpu",
                    "--ignore-gpu-blocklist",
                    "--enable-features=Vulkan,WebGPUDeveloperFeatures",
                ]
            browser = playwright.chromium.launch(
                channel="chrome",
                headless=True,
                args=browser_args,
            )
            try:
                context = browser.new_context(ignore_https_errors=True, viewport={"width": 1440, "height": 1000})
                page = context.new_page()
                browser_info = {
                    "version": browser.version,
                    "userAgent": page.evaluate("() => navigator.userAgent"),
                }
                webgpu = None
                modes = ["WebGL2"]
                notes: list[str] = []
                results: list[dict] = []
                scene_stats = None
                webgpu_disabled_after_failure = False

                for view_name, hash_path in views:
                    page.goto(f"{BASE_URL}/{hash_path}", wait_until="networkidle", timeout=60_000)
                    wait_for_hook(page)
                    page.wait_for_timeout(5000)
                    if webgpu is None:
                        webgpu = adapter_info(page)
                        if include_webgpu in {"1", "true", "yes"}:
                            modes = ["WebGL2", "WebGPU"]
                        elif include_webgpu == "auto" and webgpu.get("available") and not webgpu_looks_software_backed(webgpu):
                            modes = ["WebGL2", "WebGPU"]
                        elif include_webgpu == "auto" and webgpu_looks_software_backed(webgpu):
                            notes.append(
                                "WebGPU timing was skipped because the browser reports a software GPU adapter; set BENCHMARK_INCLUDE_WEBGPU=1 to force it."
                            )
                        elif include_webgpu not in {"0", "false", "no", "auto"}:
                            notes.append(f"Unknown BENCHMARK_INCLUDE_WEBGPU value `{include_webgpu}`; WebGPU timing skipped.")
                    if scene_stats is None:
                        scene_stats = page.evaluate("() => window.__r8RowhomeBenchmark.getSceneStats()")

                    for mode in modes:
                        if mode == "WebGPU" and webgpu_disabled_after_failure:
                            continue
                        runs = []
                        for _ in range(repeats):
                            try:
                                with timeout_after(sample_timeout_seconds, f"{view_name} {mode}"):
                                    sample = run_renderer_sample(page, mode, warmup_frames, sample_frames, warmup_calls, sample_calls)
                            except (PlaywrightError, RendererSampleTimeout) as error:
                                sample = failed_renderer_sample(mode, error)
                                if mode == "WebGPU":
                                    webgpu_disabled_after_failure = True
                                    notes.append(f"WebGPU sampling stopped after failure in `{view_name}`: {error}")
                                runs.append(sample)
                                break
                            runs.append(sample)
                        actual_modes = sorted(set(run["actualMode"] for run in runs))
                        results.append(
                            {
                                "view": view_name,
                                "mode": mode,
                                "actualModes": actual_modes,
                                "summary": summarize_runs(runs),
                                "runs": runs,
                            }
                        )

                report = {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "browser": browser_info,
                    "webgpu": webgpu,
                    "warmupFrames": warmup_frames,
                    "sampleFrames": sample_frames,
                    "warmupCalls": warmup_calls,
                    "sampleCalls": sample_calls,
                    "repeats": repeats,
                    "sampleTimeoutSeconds": sample_timeout_seconds,
                    "sceneStats": scene_stats,
                    "notes": notes,
                    "results": results,
                }
                (OUTPUT_DIR / "renderer-benchmark.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")
                (OUTPUT_DIR / "renderer-benchmark.md").write_text(markdown_report(report), encoding="utf8")
                print(markdown_report(report))
            finally:
                browser.close()
    except PlaywrightError as error:
        print(f"Playwright failed: {error}", file=sys.stderr)
        return 1
    finally:
        stop_process(preview)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
