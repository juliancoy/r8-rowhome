# Artifacts and Releases Process

## Purpose

Keep source, tests, generated reports, screenshots, browser bundles, and release evidence distinct.

## Artifact Classes

- Source: `src/`, `tests/`, `scripts/`, `docs/`, `data/`, `sources/`, `public/`
- Deterministic generated source: `src/generated/documentIndex.ts`
- Reports: `artifacts/*-flow`, `artifacts/structural-gravity`, `artifacts/performance`
- Screenshots: `artifacts/screenshots`
- Temporary browser builds: `artifacts/browser-smoke-dist`, `artifacts/renderer-benchmark-dist`
- Production build: `dist`

## Current Implementation

- `dist/` is ignored.
- Temporary browser benchmark and smoke dist folders are ignored for new files.
- Existing tracked artifacts may still appear in diffs until repository policy is cleaned up.

## Acceptance Criteria

- Source changes should be reviewable without unrelated generated noise.
- Artifact update commands should be explicit.
- Timestamped reports should not be used as deterministic unit-test outputs.
- CI should retain generated reports and screenshots as job artifacts where possible.

## Current Problems To Keep Correcting

- Some tracked artifacts are already in the repository.
- Report-writing tests still mutate timestamped JSON.
- Browser smoke intentionally rewrites screenshots.

## Professional Direction

- Keep baselines only when they serve review.
- Move temporary browser bundles out of tracked source.
- Convert report-writing tests into pure assertions plus explicit generation commands.
- Record release evidence in a release note or CI artifact bundle, not incidental dirty files.
