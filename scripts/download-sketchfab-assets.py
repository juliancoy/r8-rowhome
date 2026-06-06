#!/usr/bin/env python3
"""Download approved Sketchfab assets into public/models.

This script is intentionally manifest-driven. Do not add ad hoc search/download
logic here; review the model, license, and attribution first, then add the UID
and expected license to ASSETS.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import tempfile
import urllib.request
import zipfile
from pathlib import Path
from typing import Any

try:
    from PIL import Image
except ImportError as exc:  # pragma: no cover - exercised only on missing local dependency
    raise SystemExit(
        "Pillow is required for texture optimization. Install it with `python3 -m pip install Pillow`."
    ) from exc


ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"
SKETCHFAB_API = "https://api.sketchfab.com/v3"

ASSETS: dict[str, dict[str, Any]] = {
    "nathan-animated-walking-man": {
        "uid": "143a2b1ea5eb4385ae90a73657aca3bc",
        "target": ROOT / "public/models/sketchfab/nathan-animated-walking-man",
        "allowed_license_slugs": ["by"],
        "texture_limits": {
            "textures/rp_nathan_animated_003_mat_baseColor.jpeg": {
                "max_size": [2048, 2048],
                "quality": 84,
            }
        },
    }
}


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip("'\"")
    return values


def sketchfab_request(token: str, url: str) -> urllib.request.Request:
    return urllib.request.Request(url, headers={"Authorization": f"Token {token}"})


def read_json_url(token: str, url: str) -> Any:
    with urllib.request.urlopen(sketchfab_request(token, url), timeout=45) as response:
        return json.load(response)


def download_file(url: str, destination: Path) -> None:
    with urllib.request.urlopen(url, timeout=180) as response, destination.open("wb") as output:
        shutil.copyfileobj(response, output)


def safe_extract_zip(zip_file: zipfile.ZipFile, destination: Path) -> None:
    destination_root = destination.resolve()
    for member in zip_file.infolist():
        member_path = destination / member.filename
        resolved_member_path = member_path.resolve()
        if destination_root != resolved_member_path and destination_root not in resolved_member_path.parents:
            raise SystemExit(f"Refusing unsafe zip member path: {member.filename}")
        zip_file.extract(member, destination)


def optimize_textures(asset: dict[str, Any], target: Path) -> list[dict[str, Any]]:
    optimized: list[dict[str, Any]] = []
    for relative_path, limits in asset.get("texture_limits", {}).items():
        texture_path = target / relative_path
        if not texture_path.exists():
            raise FileNotFoundError(f"Expected texture missing after download: {texture_path}")
        original_size = texture_path.stat().st_size
        with Image.open(texture_path) as image:
            original_dimensions = image.size
            image.thumbnail(tuple(limits["max_size"]), Image.Resampling.LANCZOS)
            image.save(
                texture_path,
                format="JPEG",
                quality=int(limits.get("quality", 84)),
                optimize=True,
                progressive=True,
            )
            optimized.append(
                {
                    "path": relative_path,
                    "originalDimensions": list(original_dimensions),
                    "optimizedDimensions": list(image.size),
                    "originalBytes": original_size,
                    "optimizedBytes": texture_path.stat().st_size,
                }
            )
    return optimized


def write_metadata(target: Path, model: dict[str, Any], optimized_textures: list[dict[str, Any]]) -> None:
    metadata = {
        "uid": model["uid"],
        "name": model["name"],
        "author": model["user"]["displayName"],
        "authorUrl": model["user"]["profileUrl"],
        "viewerUrl": model["viewerUrl"],
        "license": model["license"],
        "downloadedFrom": "Sketchfab API glTF archive",
        "optimizedTextures": optimized_textures,
    }
    (target / "sketchfab-metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")


def download_asset(asset_name: str, token: str) -> None:
    asset = ASSETS[asset_name]
    uid = asset["uid"]
    target = Path(asset["target"])
    model = read_json_url(token, f"{SKETCHFAB_API}/models/{uid}")
    license_slug = model.get("license", {}).get("slug")
    if license_slug not in asset["allowed_license_slugs"]:
        allowed = ", ".join(asset["allowed_license_slugs"])
        raise SystemExit(f"{asset_name} license `{license_slug}` is not allowed by manifest; expected one of: {allowed}")
    if not model.get("isDownloadable"):
        raise SystemExit(f"{asset_name} is no longer downloadable from Sketchfab.")

    download = read_json_url(token, f"{SKETCHFAB_API}/models/{uid}/download")
    gltf_download = download.get("gltf", {})
    gltf_url = gltf_download.get("url")
    if not gltf_url:
        raise SystemExit(f"{asset_name} did not provide a glTF download URL.")

    with tempfile.TemporaryDirectory(prefix=f"r8-sketchfab-{asset_name}-") as temp_dir:
        temp = Path(temp_dir)
        archive = temp / "model.zip"
        extract_dir = temp / "extract"
        extract_dir.mkdir()
        download_file(gltf_url, archive)
        with zipfile.ZipFile(archive) as zip_file:
            safe_extract_zip(zip_file, extract_dir)

        replacement = temp / "replacement"
        replacement.mkdir()
        for item in extract_dir.iterdir():
            shutil.move(str(item), replacement / item.name)
        optimized_textures = optimize_textures(asset, replacement)
        write_metadata(replacement, model, optimized_textures)

        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            shutil.rmtree(target)
        shutil.move(str(replacement), target)

    print(f"Downloaded {asset_name} to {target.relative_to(ROOT)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Download approved Sketchfab assets.")
    parser.add_argument(
        "assets",
        nargs="*",
        default=["all"],
        help=f"Asset names to download. Known: {', '.join(sorted(ASSETS))}, all",
    )
    args = parser.parse_args()

    env = {**load_env(ENV_PATH), **os.environ}
    token = env.get("SKETCHFAB_TOKEN")
    if not token:
        raise SystemExit("Missing SKETCHFAB_TOKEN. Add it to .env or export it before running this script.")

    requested = sorted(ASSETS) if "all" in args.assets else args.assets
    unknown = sorted(set(requested) - set(ASSETS))
    if unknown:
        raise SystemExit(f"Unknown Sketchfab asset(s): {', '.join(unknown)}")

    for asset_name in requested:
        download_asset(asset_name, token)


if __name__ == "__main__":
    main()
