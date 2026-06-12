#!/usr/bin/env python3
"""Local UX evaluation harness (Playwright + local Chrome).

Replaces the earlier remote Selenium/Docker evaluation: builds the app, serves
it locally, walks every inspection view, and writes screenshots plus a JSON
report (console errors, WebGL renderer, per-view status) to artifacts/ux-eval/.

Run with:
    npm run ux:eval            # headless
    UX_EVAL_HEADED=1 npm run ux:eval   # watch the browser live
"""
import asyncio
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
PORT = int(os.environ.get("UX_EVAL_PORT", "5180"))
BASE_URL = f"https://127.0.0.1:{PORT}"
OUTPUT_DIR = ROOT / "artifacts" / "ux-eval"
BUILD_DIR = ROOT / "artifacts" / "ux-eval-dist"
LOCAL_BIN = ROOT / "node_modules" / ".bin"
HEADED = os.environ.get("UX_EVAL_HEADED") == "1"

VIEWS = [
    {"hash": "", "name": "default", "settle_ms": 2500},
    {"hash": "#camera-top", "name": "camera-top", "settle_ms": 1500},
    {"hash": "#camera-front", "name": "camera-front", "settle_ms": 1500},
    {"hash": "#camera-interior", "name": "camera-interior", "settle_ms": 1500},
    {"hash": "#steel-concrete", "name": "steel-concrete", "settle_ms": 2500},
    {"hash": "#city-block", "name": "city-block", "settle_ms": 2500},
    {"hash": "#investor", "name": "investor-dashboard", "settle_ms": 1500},
]


def run(command: list[str]) -> None:
    subprocess.run(command, cwd=ROOT, check=True)


def start_preview() -> subprocess.Popen:
    return subprocess.Popen(
        [str(LOCAL_BIN / "vite"), "preview", "--host", "127.0.0.1", "--port", str(PORT), "--strictPort", "--outDir", str(BUILD_DIR)],
        cwd=ROOT,
        start_new_session=True,
    )


def wait_for_server(process: subprocess.Popen, timeout_seconds: float = 30) -> None:
    import ssl
    import urllib.request

    context = ssl._create_unverified_context()
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"preview server exited early with code {process.returncode}")
        try:
            with urllib.request.urlopen(BASE_URL, context=context, timeout=1) as response:
                if response.status < 500:
                    return
        except OSError:
            time.sleep(0.25)
    raise TimeoutError(f"Timed out waiting for {BASE_URL}")


async def evaluate() -> dict:
    report: dict = {"baseUrl": BASE_URL, "views": [], "webgl": None}
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(channel="chrome", headless=not HEADED)
        context = await browser.new_context(ignore_https_errors=True, viewport={"width": 1600, "height": 1000})
        page = await context.new_page()
        console_errors: list[str] = []
        page.on("console", lambda message: console_errors.append(f"{message.type}: {message.text}") if message.type == "error" else None)
        page.on("pageerror", lambda error: console_errors.append(f"pageerror: {error}"))

        for view in VIEWS:
            errors_before = len(console_errors)
            await page.goto(f"{BASE_URL}/{view['hash']}", wait_until="domcontentloaded", timeout=60_000)
            await page.wait_for_selector("#scene", timeout=30_000)
            await page.wait_for_timeout(view["settle_ms"])
            screenshot = OUTPUT_DIR / f"ux-{view['name']}.png"
            await page.screenshot(path=str(screenshot))
            view_errors = console_errors[errors_before:]
            report["views"].append(
                {
                    "name": view["name"],
                    "hash": view["hash"],
                    "screenshot": str(screenshot.relative_to(ROOT)),
                    "consoleErrors": view_errors,
                    "status": "pass" if not view_errors else "errors",
                }
            )
            print(f"  {view['name']}: {'pass' if not view_errors else f'{len(view_errors)} console errors'}", flush=True)

        report["webgl"] = await page.evaluate(
            """() => {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
                if (!gl) return { supported: false };
                const info = gl.getExtension('WEBGL_debug_renderer_info');
                return {
                    supported: true,
                    version: gl.getParameter(gl.VERSION),
                    renderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
                };
            }"""
        )
        await browser.close()
    return report


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    run(["npm", "run", "generate:documents"])
    run([str(LOCAL_BIN / "vite"), "build", "--outDir", str(BUILD_DIR), "--emptyOutDir"])

    preview = start_preview()
    try:
        wait_for_server(preview)
        print(f"Evaluating {len(VIEWS)} views against {BASE_URL} ({'headed' if HEADED else 'headless'} local Chrome)…", flush=True)
        report = asyncio.run(evaluate())
    finally:
        try:
            os.killpg(os.getpgid(preview.pid), 15)
        except (ProcessLookupError, PermissionError):
            preview.terminate()

    (OUTPUT_DIR / "ux-eval-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")
    failing = [view for view in report["views"] if view["status"] != "pass"]
    print(f"WebGL: {report['webgl']}")
    print(f"Report and screenshots written to {OUTPUT_DIR.relative_to(ROOT)}")
    if failing:
        print(f"{len(failing)} view(s) had console errors: {', '.join(view['name'] for view in failing)}", file=sys.stderr)
        return 1
    print("All views passed with no console errors.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
