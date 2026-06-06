# Permit and Professional Review Process

## Purpose

Define the boundary between this conceptual generator and actual permit/construction work.

The blunt project-level legal/buildability procedure is maintained at `legal_procedure.md`.

## Inputs

- `sources/dhcd-document-requirements-by-trade-2026-04.pdf`
- `sources/dhcd-eplans-submission-matrix-2026-01-26.pdf`
- `sources/dhcd-eplans-getting-started-guide-2026-05.pdf`
- `sources/dhcd-epermits-one-two-family-combo-new-construction-guide.pdf`
- `sources/dhcd-inspection-guidelines-2026-01.pdf`

## Current Implementation

- Model validation always emits a professional-review warning.
- Structural model emits a conceptual-model warning.
- Engineering process docs identify professional gaps.
- Buildability readiness stays blocked until missing professional inputs and permit approvals are satisfied.
- `npm run permit:readiness` writes a downstream readiness artifact with preliminary calculations and blockers.

## Acceptance Criteria

- Generated outputs must not claim to be sealed drawings.
- Missing licensed-design inputs must remain explicit.
- Permit-related source documents must be cited when process assumptions reference them.
- Any future permit export must state scope, author, status, and review limitations.

## Professional Gaps

- No professional-of-record.
- No sealed drawings.
- No permit matrix extraction into enforceable structured requirements.
- No jurisdictional review workflow.
- No inspection checklist tied to model components.

## Current Handoff Artifact

The permit-readiness artifact includes:

- Buildability status and blockers.
- Preliminary electrical load tracking.
- Preliminary HVAC sizing assumptions.
- Preliminary plumbing fixture-unit tracking.
- Required next actions before construction.

The artifact remains blocked by design until professional and permit requirements are satisfied.

## Required Professional Handoff

Before construction or permit use, licensed professionals must review, correct, seal where required, coordinate disciplines, submit to the authority having jurisdiction, and respond to plan review comments.
