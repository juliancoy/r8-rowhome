# Asset Ingestion

## Purpose

Bring third-party model assets into the browser viewer through a repeatable, source-traced, license-aware process.

## Scope

- Runtime visual assets under `public/models`.
- Source metadata, license files, and attribution records.
- Browser-oriented optimization that does not change the design intent of the asset.

This process does not create construction documents, product approvals, or procurement specifications.

## Procedure

1. Choose a specific source asset before downloading.
2. Confirm the asset is downloadable and its license permits the intended local project use.
3. Add the source UID, target directory, allowed license slug, and optimization limits to the ingestion script manifest.
4. Install the asset-script Python dependency on a fresh machine:

   ```bash
   python3 -m pip install -r requirements-assets.txt
   ```

5. Download with:

   ```bash
   npm run assets:sketchfab
   ```

6. Verify the script writes:
   - model geometry and textures,
   - the source license file,
   - `sketchfab-metadata.json`,
   - deterministic texture optimization metadata.
7. Record the asset in `public/models/README.md`.
8. Add or update tests before relying on the asset in the viewer.
9. Run:

   ```bash
   npm test
   npm run build
   npm run browser:smoke
   ```

## Current Sketchfab Asset

- Asset: Nathan Animated 003 - Walking 3D Man
- Author: Renderpeople
- Source: https://sketchfab.com/3d-models/nathan-animated-003-walking-3d-man-143a2b1ea5eb4385ae90a73657aca3bc
- License: Creative Commons Attribution 4.0
- Local path: `public/models/sketchfab/nathan-animated-walking-man/scene.gltf`
- Use: animated occupant in the browser walkthrough.

The download uses `SKETCHFAB_TOKEN` from `.env` or the shell environment. The token must never be committed, printed in logs, or copied into generated metadata.

The downloaded 8192px base-color texture is downsampled to 2048px by `scripts/download-sketchfab-assets.py` for browser performance. The original Sketchfab license file and attribution are retained.

## Acceptance Criteria

- The asset can be re-downloaded from the script without manual browser steps.
- The script fails if the source license no longer matches the approved license slug.
- Metadata identifies source, author, license, and optimization performed.
- Tests verify file presence, attribution, and reasonable browser payload size.
- Browser smoke verifies the viewer can still use the walkthrough path.
