# Validation and QA Process

## Purpose

Keep generated geometry, metadata, engineering preflight outputs, and browser behavior testable without overstating professional design validity.

## Inputs

- `tests/*.test.ts`
- `src/validation/validate.ts`
- `scripts/run-browser-smoke.py`
- `scripts/run-renderer-benchmark.py`
- `scripts/run-structural-gravity.mjs`
- `scripts/run-hvac-fem.mjs`
- `scripts/run-plumbing-fluid.mjs`
- `scripts/run-livability-walkthrough.mjs`

## Current Implementation

- Vitest checks model generation, collisions, structural gravity schema, HVAC flow metadata, plumbing flow metadata, and professional-practice invariants.
- Livability walkthrough checks named occupant routes, bathroom usability markers, doors, stairs, basement utility access, and egress as an explicit artifact command.
- Browser smoke checks production build rendering across structural, steel, camera, and review-sheet views.
- Benchmark tooling measures renderer behavior in automated Chrome.

## Acceptance Criteria

- `npm test` passes.
- `npm run build` passes.
- `npm run browser:smoke` passes before relying on visual changes.
- `npm run livability:walkthrough` passes before claiming the model is usable as a residence concept.
- Domain tests assert graph connectivity and metadata completeness, not just component names.
- Generated warnings remain visible for conceptual limitations.

## Current Problems To Keep Correcting

- Some tests still write report artifacts with timestamps.
- Browser smoke rewrites screenshots and built assets.
- Generated artifacts can create noisy diffs.
- Benchmark results depend on Chrome/headless/GPU driver behavior.

## Professional QA Direction

- Separate deterministic tests from artifact-generation commands.
- Make report generation explicit and opt-in.
- Store CI artifacts outside tracked source unless intentionally baselined.
- Add fixture-based regression tests for structured engineering data.
- Require screenshot review only for meaningful visual baselines.
