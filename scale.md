# Scale Review Procedure

This document defines a repeatable way for an agent to inspect the rowhome visually from fixed camera positions, read the resulting screenshots, and decide whether the architecture is implemented correctly.

## Camera Presets

The application exposes three fixed inspection views in the toolbar and by URL hash:

- `#camera-top`
  Use this to inspect the roof and solar layout.
- `#camera-front`
  Use this to inspect the facade composition and street-facing proportions.
- `#camera-interior`
  Use this to inspect the main interior room composition and general architectural plausibility.

These presets are deterministic relative to the current model configuration, including multi-row layouts.

## Capture Workflow

1. Start the app or run the screenshot automation.
   Use `npm run browser:smoke` to produce current inspection screenshots in `artifacts/screenshots/`.
2. Read these images:
   - `artifacts/screenshots/e2e-camera-top.png`
   - `artifacts/screenshots/e2e-camera-front.png`
   - `artifacts/screenshots/e2e-camera-interior.png`
3. Evaluate each image against the checks below.
4. Mark each view as `pass`, `warning`, or `fail`.
5. If any view fails, identify the visible defect, the affected components, and the likely source module.

## Review Checks

### Top View

Purpose: verify roof-mounted elements and solar layout.

Pass criteria:
- Solar panels are visible on the roof plane.
- Panels sit on the roof and do not float above it or clip into it.
- Panels are aligned in a coherent array rather than scattered arbitrarily.
- Roof geometry, parapets, and cornice edges remain legible from above.
- No major collision is visible between panels and other roof elements.

Warning conditions:
- Panel spacing looks uneven but does not obviously collide.
- Roof accessories are crowded enough that clearance is questionable.

Fail conditions:
- Panels are missing.
- Panels intersect parapets, roof edges, or other objects.
- Panels are visibly off-axis, floating, or buried in the roof.

Likely code areas:
- `src/generators/solar.ts`
- `src/generators/rowhome.ts`

### Front View

Purpose: verify facade composition, openings, and street-facing architectural character.

Pass criteria:
- Front door is aligned with the stoop and visibly accessible.
- Window openings are centered and not blocked by facade mass.
- Brick, trim, sill, lintel, bay, or bowed-front features read cleanly from the street.
- Cornice, parapet, belt courses, and stoop appear attached and proportionate.
- No visible collision exists between stairs, facade trim, windows, planters, or entry parts.

Warning conditions:
- Symmetry or spacing looks slightly off but circulation and openings remain plausible.
- Detail pieces appear shallow or heavy but not broken.

Fail conditions:
- Door or windows are occluded by wall geometry.
- Stoop, facade trim, or openings visibly intersect.
- Major architectural elements are missing, floating, or scaled implausibly.

Likely code areas:
- `src/generators/rowhome.ts`
- `src/generators/facadeDetails.ts`
- `src/generators/stairs.ts`

### Interior View

Purpose: verify the room reads as a plausible inhabited interior rather than a geometric collision field.

Pass criteria:
- Floor, walls, openings, and main furnishings are visible and legible.
- Furniture sits on the floor rather than floating or penetrating other elements.
- Windows and doors read as openings with usable room space around them.
- The camera shows a coherent room composition rather than an obstructed or empty view.
- Lighting is bright enough to inspect surfaces and objects.

Warning conditions:
- The room is inspectable but a few objects feel too close or slightly misaligned.
- The camera is usable but not ideal for one room type.

Fail conditions:
- The camera lands inside geometry or behind an opaque obstruction.
- Major furnishings intersect walls, floor, or each other.
- The room is too dark or blocked to inspect architecture.

Likely code areas:
- `src/generators/rowhome.ts`
- `src/viewer/productModels.ts`
- `src/viewer/lighting.ts`

## Agent Decision Rule

The agent should classify implementation quality as follows:

- `pass`
  All three views satisfy the pass criteria, with no fail conditions and at most minor warnings.
- `warning`
  No hard failure exists, but one or more views show conditions that need human review.
- `fail`
  Any view shows a clear geometric, circulation, placement, or visibility defect.

## Reporting Format

When reviewing screenshots, report in this structure:

1. `Top`: `pass|warning|fail` plus one sentence.
2. `Front`: `pass|warning|fail` plus one sentence.
3. `Interior`: `pass|warning|fail` plus one sentence.
4. `Overall`: `pass|warning|fail`.
5. `Fix targets`: list the most likely source files or generators.

Example:

```text
Top: pass. Solar array is present, aligned, and seated on the roof plane.
Front: warning. Window planter alignment looks slightly low relative to sill lines.
Interior: fail. Refrigerator intersects the adjacent wall and blocks circulation.
Overall: fail.
Fix targets: src/generators/rowhome.ts, src/viewer/productModels.ts
```

## Notes

- These screenshots support visual QA only. They do not prove structural correctness, code compliance, or constructability.
- If a defect is suspected, the agent should inspect the corresponding generator and capture an updated screenshot after the fix.
