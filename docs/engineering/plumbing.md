# Plumbing Process

## Purpose

Represent potable water, hot water, sanitary DWV, vent, storm, and condensate flow paths with connected hollow pipe metadata.

## Inputs

- `src/generators/plumbing.ts`
- `sources/code-building-codes-part-vi-international-plumbing-code-full.html`

## Current Implementation

- Creates plumbing fixtures for bathrooms and kitchen.
- Creates water service, shutoff, pressure reducing valve, backflow preventer, cold/hot manifolds, water heater connections, risers, fixture branches, sanitary building drain, soil stack, vent stack, condensate drain, and storm leader.
- Pipes are hollow and carry `object.userData.plumbing` metadata.
- Builds preliminary fixture-unit tracking in `src/calculations/plumbingFixtureUnits.ts`.

## Acceptance Criteria

- Cold-water fixtures are reachable from the public water main.
- Hot-water fixtures are reachable from the electric water heater.
- DWV fixture branches are reachable to the public sanitary sewer path.
- Vent, storm, and condensate systems have explicit endpoints.
- Pipes have positive internal area and connection metadata.

## Current Tests

- `tests/plumbing-flow-report.test.ts`
- `tests/professional-practice.test.ts`
- `tests/rowhome.test.ts`

## Professional Gaps

- No fixture-unit sizing table calculation.
- No trap, trap-arm, wet-vent, or vent-distance validation.
- No cleanout and support schedule.
- No public utility service sizing.
- No slope routing clash resolution.
- No freeze protection, backwater, or sump discharge design.

The preliminary fixture-unit calculation is not permit sizing. It is a handoff aid for a plumbing designer.

## Required Professional Handoff

A plumbing designer must size water and drainage systems, validate venting, coordinate cleanouts/supports, verify utility connections, and produce inspection-ready plumbing documents.
