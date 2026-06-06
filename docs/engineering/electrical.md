# Electrical Process

## Purpose

Represent an all-electric service, meter, disconnect, panel, branch circuits, receptacles, lighting, range circuit, floor-zoned HVAC circuits, water-heater circuit, photovoltaic interconnection, and lithium-ion battery storage.

## Inputs

- `src/generators/electrical.ts`
- `sources/code-building-codes-part-iii-national-electrical-code-full.html`

## Current Implementation

- Creates a schematic service mast, meter socket, emergency disconnect, panel, working clearance, breakers, bus bars, branch circuits, luminaires, switches, receptacles, HVAC circuits, range circuit, water-heater circuit, PV hybrid inverter, battery disconnect, lithium-ion battery cabinet, and AC interconnection to the panel.
- Adds connection notes to electrical parts.
- Keeps gas components out of the model.
- Builds preliminary load tracking in `src/calculations/electricalLoad.ts`.

## Acceptance Criteria

- Electrical service path is explicit from service mast to panel.
- Panel working clearance exists and is non-printable reference geometry.
- HVAC, range, water heater, lighting, receptacle, PV, and battery-storage paths are represented.
- Electrical components include source metadata and connection notes.
- All modeled appliances remain electric.

## Current Tests

- `tests/rowhome.test.ts`
- `tests/professional-practice.test.ts`

## Professional Gaps

- No electrical load calculation.
- No panel schedule.
- No PV/battery interconnection study.
- No lithium-ion battery listing, shutdown, fire separation, or emergency-response design.
- No AFCI/GFCI logic.
- No grounding and bonding design.
- No voltage-drop calculation.
- No conductor derating, raceway fill, or device listing validation.
- No utility coordination.

The preliminary load calculation is a handoff aid only. It does not remove the missing-input requirements above.

## Required Professional Handoff

A licensed electrician or electrical engineer must produce load calculations, panel schedules, conductor and breaker sizing, grounding/bonding design, device protection requirements, and inspection-ready documents.
