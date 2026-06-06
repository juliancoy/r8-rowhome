# Structural Gravity Process

## Purpose

Represent conceptual gravity load paths from roof and floor diaphragms through masonry walls, optional steel supports, and foundations.

## Inputs

- `src/structure/gravity.ts`
- `src/core/config.ts`
- `sources/code-building-codes-part-x-international-residential-code-full.html`
- `sources/code-building-codes-part-ii-international-building-code-full.html`

## Current Implementation

- Builds nodes, members, supports, materials, sections, load cases, area loads, load combinations, design-check placeholders, and demand surfaces.
- Reports floor dead load, floor live load, roof dead load, roof live load, wall dead load, and optional steel allowance.
- Creates a continuous sampled gravity-demand field along load-bearing wall elements.
- Exposes structural-demand overlay data to the browser viewer.

## Acceptance Criteria

- Structural model contains supports, load cases, area loads, members, and source-traced assumptions.
- Demand surfaces have normalized intensities between 0 and 1.
- Bearing-wall demand samples are dense enough to read continuously across each load-bearing element.
- Lower wall samples show higher cumulative tributary gravity demand than upper wall samples.
- The model warns that it is conceptual and not solved.

## Current Tests

- `tests/structural-gravity.test.ts`
- `tests/rowhome.test.ts`
- `scripts/run-structural-gravity.mjs`

## Professional Gaps

- No stiffness matrix.
- No solved reactions.
- No member force envelope.
- No capacity checks.
- No foundation bearing or settlement calculation.
- No wind, seismic, diaphragm, collector, anchorage, or overturning model.
- No connection design.

## Required Professional Handoff

A licensed structural engineer must select members, model boundary conditions, solve load combinations, check demand/capacity ratios, design connections, verify foundations, and produce sealed structural documents where required.
