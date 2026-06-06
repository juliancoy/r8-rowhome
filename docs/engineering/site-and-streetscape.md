# Site and Streetscape Process

## Purpose

Represent lot, sidewalk, curb, roadway, crosswalks, lighting, tree, rear yard, and public/private frontage context.

## Inputs

- `src/generators/rowhome.ts`
- `src/generators/solar.ts`
- `src/generators/roofGarden.ts`
- `sources/code-article-26-complete-streets-manual.html`
- `sources/dot-complete-streets-manual-2021-03.pdf`
- `sources/code-article-7-natural-resources-full.html`
- `sources/mde-2011-md-standards-specifications-soil-erosion-sediment-control.pdf`
- `sources/mde-maryland-stormwater-design-manual-volume-1-2009.pdf`
- `sources/mde-maryland-stormwater-design-manual-volume-2-2009.pdf`

## Current Implementation

- Adds lot plane, sidewalks, curbs, roads, crosswalks, stop signs, street lights, rear yard, and tree references.
- Adds rooftop photovoltaic array geometry.
- Adds raised roof garden planters, planting, paver access, drainage/root-barrier marker, and drip-irrigation marker next to the solar array.
- Keeps public sidewalks outside the house footprint.

## Acceptance Criteria

- Front and side public realm components are source-traced.
- Sidewalks remain outside the building footprint.
- Multi-home rows use shared public frontage rather than duplicated per-unit roads.
- Roof solar panels are clear of stair and service zones.
- Roof garden components stay beside the solar array without overlapping photovoltaic panels.

## Current Tests

- `tests/rowhome.test.ts`
- `tests/collision.test.ts`

## Professional Gaps

- No civil survey.
- No grading plan.
- No stormwater calculation.
- No erosion and sediment control plan.
- No utility plan.
- No right-of-way permit plan.
- No tree protection, planting, or maintenance specification.
- No roof garden saturated-weight structural design.
- No roof garden waterproofing, root-barrier, irrigation, overflow drainage, wind uplift, or maintenance design.

## Required Professional Handoff

Civil/site professionals must provide survey data, grading, stormwater, erosion control, utility coordination, right-of-way coordination, and jurisdictional permit exhibits.
