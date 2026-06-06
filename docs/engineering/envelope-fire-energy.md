# Envelope, Fire, and Energy Process

## Purpose

Represent schematic wall, roof, party-wall, insulation, gypsum, air-barrier, fireblocking, and fire-resistance assemblies.

## Inputs

- `src/generators/assemblies.ts`
- `src/generators/basement.ts`
- `src/generators/brickwork.ts`
- `sources/code-building-codes-part-x-international-residential-code-full.html`
- `sources/code-building-codes-part-ix-b-residential-energy-code-full.html`
- `sources/code-building-fire-related-codes-index.html`

## Current Implementation

- Adds party-wall gypsum and mineral wool fire insulation.
- Adds cavity insulation, roof insulation, rim joist insulation, and fireblocking.
- Adds wall assembly layers around front openings.
- Tracks brick takeoff summary and optional individual brick instances.

## Acceptance Criteria

- Fire and insulation components are explicit model components.
- Party walls, front wall, rear wall, roof, and foundation/rim areas include source-traced envelope metadata.
- Openings remain open where doors and windows occur.
- Brick takeoff remains available even when individual bricks are not rendered.

## Current Tests

- `tests/rowhome.test.ts`
- `tests/collision.test.ts`

## Professional Gaps

- No certified energy model.
- No condensation, vapor, or hygrothermal analysis.
- No tested fire-rated assembly selection.
- No penetration/firestop schedule.
- No product-specific specifications.
- No constructability details for flashing, waterproofing, drainage plane, or air sealing.

## Required Professional Handoff

Architectural and envelope professionals must select approved assemblies, coordinate penetrations, produce details, verify energy-code compliance, and specify products and inspections.
