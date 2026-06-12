#!/usr/bin/env python3
import asyncio
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

from playwright.async_api import Error as PlaywrightError
from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from playwright.async_api import async_playwright


ROOT = Path(__file__).resolve().parents[1]
PORT = int(os.environ.get("SMOKE_PORT", "5173"))
BASE_URL = f"https://127.0.0.1:{PORT}"
SCREENSHOT_DIR = ROOT / "artifacts" / "screenshots"
BUILD_DIR = ROOT / "artifacts" / "browser-smoke-dist"
LOCAL_BIN = ROOT / "node_modules" / ".bin"
SMOKE_CONCURRENCY = max(1, int(os.environ.get("SMOKE_CONCURRENCY", "2")))
NAVIGATION_TIMEOUT_MS = max(30_000, int(os.environ.get("SMOKE_NAVIGATION_TIMEOUT_MS", "60000")))
ALLOWED_CONSOLE_WARNINGS = (
    "THREE.WebGPURenderer: WebGPU is not available",
    "THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated",
    "No available adapters.",
    "GL Driver Message",
    "WebGL: CONTEXT_LOST_WEBGL",
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


async def element_matches(page, selector: str, must_be_unhidden: bool) -> bool:
    return await page.evaluate(
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


async def attach_error_capture(page) -> tuple[list[str], list[str], list[str]]:
    console_messages: list[str] = []
    page_errors: list[str] = []
    failed_responses: list[str] = []

    page.on(
        "console",
        lambda message: console_messages.append(f"{message.type}: {message.text}") if message.type in {"error", "warning"} else None,
    )
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("response", lambda response: failed_responses.append(f"{response.status}: {response.url}") if response.status >= 400 else None)
    return console_messages, page_errors, failed_responses


async def capture_screenshot(page, screenshot_name: str) -> None:
    path = str(SCREENSHOT_DIR / screenshot_name)
    try:
        await page.screenshot(path=path, full_page=False, timeout=60_000, animations="disabled")
    except PlaywrightTimeoutError:
        canvas = page.locator("#scene")
        await canvas.screenshot(path=path, timeout=60_000, animations="disabled")


async def inspect_page(page, path: str, screenshot_name: str, selector: str, must_be_unhidden: bool = False) -> None:
    console_messages, page_errors, failed_responses = await attach_error_capture(page)

    url = f"{BASE_URL}/{path}"
    print(f"Checking {url}", flush=True)
    await page.goto(url, wait_until="domcontentloaded", timeout=NAVIGATION_TIMEOUT_MS)
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        if await element_matches(page, selector, must_be_unhidden):
            break
        await page.wait_for_timeout(100)
    else:
        diagnostic_name = screenshot_name.replace(".png", "-selector-timeout.png")
        await page.screenshot(path=str(SCREENSHOT_DIR / diagnostic_name), full_page=False, timeout=60_000)
        html_path = SCREENSHOT_DIR / diagnostic_name.replace(".png", ".html")
        html_path.write_text(await page.content(), encoding="utf8")
        raise PlaywrightError(f"{path} did not render expected selector {selector}")
    await page.wait_for_timeout(500)

    canvas_box = await page.evaluate(
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

    await capture_screenshot(page, screenshot_name)
    assert_no_browser_errors(console_messages, page_errors, failed_responses)


async def inspect_walkthrough(page) -> None:
    console_messages, page_errors, failed_responses = await attach_error_capture(page)

    url = f"{BASE_URL}/#camera-interior"
    print(f"Checking {url} walkthrough", flush=True)
    await page.goto(url, wait_until="domcontentloaded", timeout=NAVIGATION_TIMEOUT_MS)
    await page.wait_for_selector("#walkthrough-toggle", timeout=30_000)
    await page.click("#walkthrough-toggle")
    await page.wait_for_function(
        """() => {
            const hud = document.querySelector('#walkthrough-hud');
            const avatarActive = document.querySelector('#walkthrough-toggle')?.classList.contains('is-active');
            return hud && !hud.hasAttribute('hidden') && avatarActive && hud.textContent.includes('%');
        }""",
        timeout=30_000,
    )
    await page.wait_for_timeout(900)
    await capture_screenshot(page, "e2e-walkthrough-person.png")
    assert_no_browser_errors(console_messages, page_errors, failed_responses)


async def run_check(browser, check: dict[str, object], semaphore: asyncio.Semaphore) -> None:
    async with semaphore:
        context = await browser.new_context(ignore_https_errors=True, viewport={"width": 1440, "height": 1000})
        page = await context.new_page()
        try:
            if check["kind"] == "walkthrough":
                await inspect_walkthrough(page)
            else:
                await inspect_page(
                    page,
                    str(check["path"]),
                    str(check["screenshot"]),
                    str(check["selector"]),
                    bool(check.get("must_be_unhidden", False)),
                )
        finally:
            await context.close()


async def run_browser_checks() -> None:
    checks: list[dict[str, object]] = [
        {
            "kind": "page",
            "path": "#structural-demand",
            "screenshot": "e2e-structural-demand.png",
            "selector": "#structural-legend",
            "must_be_unhidden": True,
        },
        {
            "kind": "page",
            "path": "#steel-structural-demand",
            "screenshot": "e2e-steel-structural-demand.png",
            "selector": "#structural-legend",
            "must_be_unhidden": True,
        },
        {"kind": "page", "path": "#steel-support", "screenshot": "e2e-steel-support.png", "selector": "#structural-support-select"},
        {"kind": "page", "path": "#steel-concrete", "screenshot": "e2e-steel-concrete.png", "selector": "#construction-system-select"},
        {"kind": "page", "path": "#city-block", "screenshot": "e2e-city-block.png", "selector": "#urban-scale-select"},
        {"kind": "page", "path": "#investor", "screenshot": "e2e-investor-dashboard.png", "selector": "#investor-dashboard"},
        {"kind": "page", "path": "#camera-top", "screenshot": "e2e-camera-top.png", "selector": "#view-preset-select"},
        {"kind": "page", "path": "#camera-front", "screenshot": "e2e-camera-front.png", "selector": "#view-preset-select"},
        {"kind": "page", "path": "#camera-interior", "screenshot": "e2e-camera-interior.png", "selector": "#view-preset-select"},
        {
            "kind": "page",
            "path": "#camera-sheet",
            "screenshot": "e2e-camera-sheet.png",
            "selector": "#review-sheet-overlay",
            "must_be_unhidden": True,
        },
        {"kind": "walkthrough"},
    ]
    semaphore = asyncio.Semaphore(min(SMOKE_CONCURRENCY, len(checks)))
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(channel="chrome", headless=True)
        try:
            await asyncio.gather(*(run_check(browser, check, semaphore) for check in checks))
        finally:
            await browser.close()


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
        asyncio.run(run_browser_checks())
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
