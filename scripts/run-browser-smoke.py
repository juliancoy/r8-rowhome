#!/usr/bin/env python3
import os
import signal
import shutil
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
PORT = int(os.environ.get("SMOKE_PORT", "5173"))
BASE_URL = f"https://127.0.0.1:{PORT}"
SCREENSHOT_DIR = ROOT / "artifacts" / "screenshots"
BUILD_DIR = ROOT / "artifacts" / "browser-smoke-dist"
LOCAL_BIN = ROOT / "node_modules" / ".bin"
ALLOWED_CONSOLE_WARNINGS = (
    "THREE.WebGPURenderer: WebGPU is not available",
    "No available adapters.",
    "GL Driver Message",
)
ALLOWED_CONSOLE_ERRORS_WITHOUT_FAILED_RESPONSE = (
    "Failed to load resource: the server responded with a status of 404",
)


def run(command: list[str]) -> None:
    subprocess.run(command, cwd=ROOT, check=True)


def clear_vite_temp_cache() -> None:
    cache_dir = ROOT / "node_modules" / ".vite-temp"
    if cache_dir.exists():
        shutil.rmtree(cache_dir)


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


def assert_no_browser_errors(console_messages: list[str], page_errors: list[str], failed_responses: list[str]) -> None:
    disallowed = [
        message
        for message in console_messages
        if not any(allowed in message for allowed in ALLOWED_CONSOLE_WARNINGS)
        and not (not failed_responses and any(allowed in message for allowed in ALLOWED_CONSOLE_ERRORS_WITHOUT_FAILED_RESPONSE))
    ]
    if page_errors or disallowed or failed_responses:
        details = "\n".join([*page_errors, *failed_responses, *disallowed])
        raise AssertionError(f"Browser errors detected:\n{details}")


def inspect_page(page, path: str, screenshot_name: str, selector: str, must_be_unhidden: bool = False) -> None:
    console_messages: list[str] = []
    page_errors: list[str] = []
    failed_responses: list[str] = []

    page.on("console", lambda message: console_messages.append(f"{message.type}: {message.text}") if message.type in {"error", "warning"} else None)
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("response", lambda response: failed_responses.append(f"{response.status}: {response.url}") if response.status >= 400 else None)

    url = f"{BASE_URL}/{path}"
    print(f"Checking {url}", flush=True)
    page.goto(url, wait_until="domcontentloaded", timeout=30_000)
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        if element_matches(page, selector, must_be_unhidden):
            break
        page.wait_for_timeout(100)
    else:
        diagnostic_name = screenshot_name.replace(".png", "-selector-timeout.png")
        page.screenshot(path=str(SCREENSHOT_DIR / diagnostic_name), full_page=False, timeout=60_000)
        html_path = SCREENSHOT_DIR / diagnostic_name.replace(".png", ".html")
        html_path.write_text(page.content(), encoding="utf8")
        raise PlaywrightError(f"{path} did not render expected selector {selector}")
    page.wait_for_timeout(500)

    canvas_box = page.evaluate(
        """() => {
            const canvas = document.querySelector('#scene');
            if (!canvas) {
                return null;
            }
            const rect = canvas.getBoundingClientRect();
            return { width: rect.width, height: rect.height };
        }"""
    )
    if not canvas_box or canvas_box["width"] < 300 or canvas_box["height"] < 300:
        raise AssertionError(f"Scene canvas has invalid dimensions: {canvas_box}")

    page.screenshot(path=str(SCREENSHOT_DIR / screenshot_name), full_page=False, timeout=60_000)
    assert_no_browser_errors(console_messages, page_errors, failed_responses)


def element_matches(page, selector: str, must_be_unhidden: bool) -> bool:
    return page.evaluate(
        """([selector, mustBeUnhidden]) => {
            const element = document.querySelector(selector);
            if (!element) {
                return false;
            }
            if (!mustBeUnhidden) {
                return true;
            }
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return !element.hasAttribute('hidden')
                && style.display !== 'none'
                && style.visibility !== 'hidden'
                && rect.width > 0
                && rect.height > 0;
        }""",
        [selector, must_be_unhidden],
    )


def main() -> int:
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    clear_vite_temp_cache()
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    run(["npm", "run", "generate:documents"])
    run([str(LOCAL_BIN / "tsc")])
    run([str(LOCAL_BIN / "vite"), "build", "--outDir", str(BUILD_DIR), "--emptyOutDir"])

    preview = start_preview()
    try:
        wait_for_server(preview)
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel="chrome", headless=True)
            try:
                context = browser.new_context(ignore_https_errors=True, viewport={"width": 1440, "height": 1000})
                page = context.new_page()
                inspect_page(page, "#structural-demand", "e2e-structural-demand.png", "#structural-legend", must_be_unhidden=True)
                page.close()

                page = context.new_page()
                inspect_page(page, "#steel-structural-demand", "e2e-steel-structural-demand.png", "#structural-legend", must_be_unhidden=True)
                page.close()

                page = context.new_page()
                inspect_page(page, "#steel-support", "e2e-steel-support.png", "#structural-support-select")
                page.close()

                page = context.new_page()
                inspect_page(page, "#camera-top", "e2e-camera-top.png", "#view-preset-select")
                page.close()

                page = context.new_page()
                inspect_page(page, "#camera-front", "e2e-camera-front.png", "#view-preset-select")
                page.close()

                page = context.new_page()
                inspect_page(page, "#camera-interior", "e2e-camera-interior.png", "#view-preset-select")
                page.close()

                page = context.new_page()
                inspect_page(page, "#camera-sheet", "e2e-camera-sheet.png", "#review-sheet-overlay", must_be_unhidden=True)
                page.close()
            finally:
                browser.close()
    except PlaywrightError as error:
        print(f"Playwright failed: {error}", file=sys.stderr)
        return 1
    finally:
        stop_process(preview)

    print("Browser smoke checks passed.")
    print(f"Screenshots written to {SCREENSHOT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
