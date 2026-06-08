# R8 Rowhome Document Register

This register organizes source documents and generated artifacts for professional handoff. Generated artifacts must be regenerated after model changes.

## Recommended Reading Order

- `README.md`
- `DEFICIENCIES.md`
- `legal_procedure.md`
- `../architect_logic.md`
- `../structural_logic.md`
- `Materials.md`
- `artifacts/construction-documents/construction-document-preflight-report.json`
- `artifacts/print-preflight/print-preflight-report.json`
- `artifacts/permit-readiness/permit-readiness-report.json`

## Register

| Section | Status | Path | Purpose |
| --- | --- | --- | --- |
| orientation | source | `README.md` | Project overview, commands, and viewer entry points. |
| orientation | source | `mission.md` | Original project mission and product intent. |
| orientation | source | `plan.md` | Implementation plan and acceptance approach. |
| professional-practice | source | `Materials.md` | Material assumptions and source-traced assembly notes. |
| professional-practice | source | `DEFICIENCIES.md` | Remaining technical build blockers and closed controls. |
| professional-practice | source | `legal_procedure.md` | Nonconstruction boundary and permit/legal procedure. |
| professional-practice | source | `../architect_logic.md` | Architect workflow for code, envelope, egress, roof access, and closeout. |
| engineering | source | `../structural_logic.md` | Structural engineer workflow for load path, stair/roof openings, guards, and review. |
| engineering | source | `pragmaticpath.md` | Structural simulation path and solver tradeoffs. |
| viewer | source | `scale.md` | Visual inspection checklist and screenshot expectations. |
| viewer | source | `docs/model-assumptions.md` | Declared model assumptions. |
| external-source-index | source | `docs/source-traceability.md` | Source traceability process. |
| viewer | source | `docs/validation.md` | Validation expectations and known boundaries. |
| viewer | source | `docs/web-viewer.md` | Web viewer usage notes. |
| generated-artifact | generated | `artifacts/construction-documents/construction-document-preflight-report.json` | Generated sheet index, schedules, and construction-document preflight checks. |
| generated-artifact | generated | `artifacts/collision-audit/collision-audit-report.json` | Generated all-printable-component collision audit. |
| generated-artifact | generated | `artifacts/print-preflight/print-preflight-report.json` | Generated 3D-print scale, kit, and minimum-feature preflight checks. |
| generated-artifact | generated | `artifacts/deficiency-resolution/deficiency-resolution-report.json` | Generated deficiency control and remaining blocker register. |
| generated-artifact | generated | `artifacts/permit-readiness/permit-readiness-report.json` | Generated buildability and preliminary discipline readiness report. |
| generated-artifact | generated | `artifacts/structural-gravity/structural-gravity-report.json` | Generated structural gravity preflight report. |
| generated-artifact | generated | `artifacts/hvac-flow/hvac-flow-report.json` | Generated HVAC airflow topology report. |
| generated-artifact | generated | `artifacts/plumbing-flow/plumbing-flow-report.json` | Generated plumbing flow topology report. |
| generated-artifact | generated | `artifacts/livability-walkthrough/livability-walkthrough-report.json` | Generated named-route livability walkthrough report. |
| generated-artifact | generated | `artifacts/performance/renderer-benchmark.json` | Generated renderer timing and GPU adapter report when benchmark is run. |
