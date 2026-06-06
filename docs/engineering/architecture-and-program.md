# Architecture and Program Process

## Purpose

Define the rowhome as a usable residential concept: rooms, circulation, egress, frontage, facade character, furnishings, stairs, rear access, basement, and all-electric appliances.

## Inputs

- `src/core/config.ts`
- `sources/code-article-32-section-9-204-r8-rowhouse-residential.html`
- `sources/materials/facade/baltimore-heritage-anatomy-of-a-rowhouse.html`
- `sources/stairs/icc-2021-irc-chapter-3-building-planning.html`
- `sources/stairs/icc-irc-spiral-stairways-code-change-re-12-06-16.pdf`

## Current Implementation

- `src/generators/rowhome.ts` creates the overall model.
- `src/generators/stairs.ts` creates stair options.
- `src/generators/facadeDetails.ts` creates Baltimore rowhouse door and window anatomy.
- `src/generators/fireEscape.ts` creates rear egress and exterior fire escape components.
- `src/simulation/livabilityWalkthrough.ts` checks named occupant routes through rooms, bathrooms, stairs, basement utilities, and exits.

## Acceptance Criteria

- Rooms exist for living, dining, kitchen, sleeping, office, basement/service, and circulation.
- Bathrooms exist on each floor with toilet, lavatory, shower, privacy door, door-swing clearance marker, toilet clearance marker, and shower entry clearance marker.
- Front and rear egress elements are present.
- Door and window rough openings remain open in wall geometry.
- Stairs connect landings to floors without occupying solid floor plates.
- The livability walk-through report has no failed route/check and explicitly flags compact stairs as a usability caution.
- Major fixtures do not occupy the same volume.
- The generated rowhome remains all-electric.

## Current Tests

- `tests/rowhome.test.ts`
- `tests/livability-walkthrough.test.ts`
- `tests/collision.test.ts`
- `tests/professional-practice.test.ts`

## Professional Gaps

- No licensed architectural code review.
- No final accessibility, life-safety, or occupancy analysis.
- No human-factors validation for carrying furniture, accessibility, children, aging-in-place, or emergency movement.
- No permit sheet set, dimensions, schedules, details, or specifications.
- Historic district and site-specific zoning conditions are not applied unless modeled separately.

## Required Professional Handoff

An architect must convert the concept into a coordinated drawing set with dimensions, code analysis, door/window schedules, egress analysis, envelope assemblies, and jurisdiction-specific notes.
