# Cost and Bill of Materials Process

## Purpose

Produce rough material/category rollups and estimated cost summaries from generated components.

## Inputs

- `src/export/bom.ts`
- `data/costs/default-costs.json`
- `data/materials/catalog.json`
- Component metadata from generators

## Current Implementation

- Component metadata carries estimated cost values.
- BOM export groups components by material and category.
- Brick takeoff summary tracks standard brick quantity.
- Product metadata identifies selected real-product references for owner planning.

## Acceptance Criteria

- Estimated costs are non-negative.
- BOM rollups include material/category grouping.
- Brick quantity remains available even when rendering solid textured walls.
- Real product references include brand/source metadata where used.

## Current Tests

- `tests/rowhome.test.ts`
- `tests/professional-practice.test.ts`

## Professional Gaps

- No quantity surveyor review.
- No labor, escalation, contingency, waste, tax, freight, contractor overhead, or permit-fee model.
- No vendor quote validation.
- No procurement schedule.
- No specification-grade alternates.

## Required Professional Handoff

A cost estimator or contractor must validate quantities, scope gaps, labor, subcontractor pricing, escalation, market conditions, alternates, and allowances.
