# Legal Procedure and Buildability Boundary

This project is a conceptual design, engineering-preflight, and visualization tool. It is not a legal opinion, permit approval, sealed drawing package, construction contract, or authorization to build.

## Plain Answer

Do not build from this repository alone.

The model can support design coordination and professional handoff. Construction requires site-specific legal review, permit approval, licensed professional documents where required, inspections, and contractor execution.

## Required Procedure Before Construction

1. Confirm property identity, ownership, zoning district, overlays, historic district status, easements, and right-of-way constraints.
2. Obtain or commission a boundary and topographic survey.
3. Confirm utility availability and service requirements.
4. Engage the required licensed professionals.
5. Convert the conceptual model into permit drawings, specifications, schedules, and calculations.
6. Complete discipline calculations:
   - Architectural code and egress review.
   - Structural gravity and lateral design.
   - Foundation and soil-bearing review.
   - Electrical load calculation and panel schedule.
   - HVAC Manual J/S/D or accepted local equivalent.
   - Plumbing fixture-unit, venting, drainage, and water-sizing design.
   - Energy-code compliance documentation.
   - Fire-resistance and firestopping assembly selection.
   - Civil/site, stormwater, erosion-control, and right-of-way documents where required.
7. Submit permit documents to the authority having jurisdiction.
8. Respond to plan-review comments.
9. Receive required permits before work begins.
10. Build only from approved drawings and specifications.
11. Schedule required inspections.
12. Resolve inspection corrections.
13. Obtain final approvals before occupancy or closeout.

## What This Repository Can Do

- Generate a source-traced rowhome concept.
- Show rooms, egress, systems, structure, envelope, and site context.
- Produce conceptual bill-of-materials and metadata exports.
- Validate internal model consistency.
- Produce downstream reports and screenshots.
- Maintain a buildability-readiness register.
- Identify blockers that prevent construction use.

## What This Repository Cannot Do

- Seal drawings.
- Approve permits.
- Decide legal compliance.
- Replace licensed professional judgment.
- Confirm site conditions.
- Confirm utility service conditions.
- Guarantee constructability.
- Authorize construction.

## Current Buildability Status

Status: blocked.

Reason: the project lacks site-specific survey, permit approval, sealed professional drawings, solved structural design, discipline calculations, specifications, and contractor coordination.

See `src/buildability/readiness.ts` for the structured buildability register enforced by tests.

Run `npm run permit:readiness` to generate `artifacts/permit-readiness/permit-readiness-report.json`. That report includes the readiness register and preliminary electrical, HVAC, and plumbing calculations for professional handoff.

## Source Procedure References

Local source documents in `sources/` include DHCD permit, ePlans, inspection, and trade-document guides. They are reference material for process planning. They are not automatically transformed into binding project approval.

Relevant local sources include:

- `sources/dhcd-document-requirements-by-trade-2026-04.pdf`
- `sources/dhcd-eplans-submission-matrix-2026-01-26.pdf`
- `sources/dhcd-eplans-getting-started-guide-2026-05.pdf`
- `sources/dhcd-epermits-one-two-family-combo-new-construction-guide.pdf`
- `sources/dhcd-inspection-guidelines-2026-01.pdf`
- `sources/code-building-codes-part-x-international-residential-code-full.html`
- `sources/code-building-codes-part-iii-national-electrical-code-full.html`
- `sources/code-building-codes-part-v-international-mechanical-code-full.html`
- `sources/code-building-codes-part-vi-international-plumbing-code-full.html`

## Rule for Future Work

Any feature that makes the project look more buildable must also state the remaining blocker if professional approval or site-specific input is still missing.
