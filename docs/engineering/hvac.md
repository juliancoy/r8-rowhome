# HVAC Process

## Purpose

Represent an all-electric zoned heat-pump HVAC system with connected supply, return, exhaust, per-floor heaters, controls, and equipment components.

## Inputs

- `src/generators/hvac.ts`
- `sources/code-building-codes-part-v-international-mechanical-code-full.html`
- `sources/code-building-codes-part-x-international-residential-code-full.html`

## Current Implementation

- Creates heat-pump condenser, condenser pad, air handler, supply plenum, return plenum, refrigerant line set, one electric heat-pump indoor heating unit per floor, one thermostat per floor, supply trunks, supply risers, supply branches, return trunks, return risers, returns, bathroom exhaust, and range hood exhaust.
- Duct geometry is hollow and carries `object.userData.hvac` metadata for **airflow only**.
- Heat transfer is not modeled as moving through ducts. Room heat gain/loss is a separate envelope, infiltration, solar gain, internal load, and Manual J problem.
- Flow edges include nodes, CFM, design velocity, hydraulic area, and dimensions.
- Builds preliminary sizing and airflow tracking in `src/calculations/hvacSizing.ts`.

## Acceptance Criteria

- Supply registers are reachable from the supply plenum in the HVAC graph.
- Return grilles are reachable back to the return plenum.
- Exhaust paths terminate outdoors or at roof/wall endpoints.
- Each floor has an independent schematic electric heat-pump indoor heating unit and thermostat.
- Ducts have positive flow, positive area, and positive dimensions.
- HVAC remains all-electric.

## Current Tests

- `tests/rowhome.test.ts`
- `tests/hvac-flow-report.test.ts`
- `tests/professional-practice.test.ts`

## Professional Gaps

- No Manual J load calculation.
- No floor-by-floor heat-loss or heat-gain allocation.
- No Manual S equipment selection.
- No Manual D duct sizing.
- No ventilation rate calculation.
- No static-pressure calculation.
- No condensate, refrigerant, or commissioning design.
- No acoustic, balancing, insulation, or leakage specification.

The preliminary HVAC calculation is not a Manual J/S/D result. It is a handoff aid for a mechanical designer.

## Required Professional Handoff

A mechanical designer must size equipment and ducts, verify ventilation and exhaust, coordinate penetrations, specify controls and balancing, and produce permit-ready mechanical documents.
