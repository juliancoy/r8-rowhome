# Deficiencies

Status: not buildable tomorrow. Technical blockers are now explicit and test-tracked.

This file distinguishes two things:

- **Closed controls:** vague deficiencies have been converted into reports, tests, scripts, and professional handoff boundaries.
- **Remaining technical build blockers:** even if every human/process dependency is ignored, the model is still not a construction-ready package.

Run the machine-readable tracker with:

```sh
npm run deficiencies:resolve
```

Run the automated construction-document preflight package with:

```sh
npm run construction:preflight
```

Run the automated 3D-print preflight and document organization packages with:

```sh
npm run print:preflight
npm run documents:organize
```

Generated output:

- `artifacts/deficiency-resolution/deficiency-resolution-report.json`
- `artifacts/deficiency-resolution/README.md`
- `artifacts/construction-documents/construction-document-preflight-report.json`
- `artifacts/construction-documents/README.md`
- `artifacts/print-preflight/print-preflight-report.json`
- `artifacts/print-preflight/README.md`
- `docs/DOCUMENT_REGISTER.md`

## Remaining Technical Build Blockers

| Deficiency | Current Resolution | Verification |
| --- | --- | --- |
| No construction documents | Partially automated with a construction-document preflight sheet index plus door, window, material, product, and coordination schedules. The model still needs dimensioned plans, elevations, sections, wall sections, stair details, roof details, specifications, notes, and coordinated sheets. | `npm run construction:preflight`, `npm run permit:readiness` |
| No solved structural design | Tracked through structural gravity, solver-status, design-check, and structural-logic artifacts. Forces, deflections, lateral loads, foundations, bearing, connections, fasteners, wind/seismic, guard loads, stair reactions, and roof-opening reinforcement are not solved. | `npm run structural:gravity` |
| No foundation/site design | Tracked as site/foundation prerequisite scope. Geotechnical capacity, excavation support, underpinning, stormwater/site grading, adjacent property condition, foundation detailing, and utility tie-ins are not designed. | `npm run permit:readiness`, `npm run structural:gravity` |
| No real MEP design | Tracked through preliminary MEP and flow reports. Manual J/S/D, pressure loss, diffuser throw, return mixing, equipment selection, ventilation, condensate, balancing, panel schedules, feeder sizing, and plumbing sizing are not installable design. | `npm run hvac:fem`, `npm run plumbing:fluid`, `npm run permit:readiness` |
| No BIM-grade coordination | Tracked as a model-format boundary. Three.js geometry and metadata are not IFC/Revit-grade coordination with exact assemblies, tolerances, tags, schedules, penetrations, and clash-resolved trade routing. | `npm run deficiencies:resolve` |
| No material/product specification package | Tracked through metadata and material notes. Approved assemblies, manufacturer details, rated systems, waterproofing, door/window schedules, hardware sets, flashing, fasteners, sealants, membranes, and submittals are not complete. | `npm run permit:readiness`, `npm test -- tests/rowhome.test.ts` |
| No build sequence | Tracked as construction-administration/safety scope. Demolition, temporary shoring, weather protection, stair/roof opening sequence, material handling, safety plan, and inspection hold points are not a contractor-ready plan. | `npm run permit:readiness` |
| No exact simulation/certification | Tracked as a certification boundary. Viewer tests cover practical navigation and gross collision; they do not certify mesh-exact physics, airflow, structure, water, fire, egress, or physical GPU behavior by default. | `npm run browser:smoke`, `BENCHMARK_RUN_BROWSER=1 npm run benchmark:renderers` |
| No slicer-ready 3D-print kit | Partially automated with a scale-aware print preflight that groups printable components into kits and identifies too-thin features, excluded markers, and product assets requiring watertight printable replacements. | `npm run print:preflight` |

## Closed Controls

| Prior Deficiency | Closed Control |
| --- | --- |
| Not a real engineering solver | Solver work is explicit headless/preflight scope, with structural, HVAC, and plumbing command artifacts. |
| Not a BIM permit set | Permit readiness and buildability blockers are explicit and remain blocked until construction documents exist. |
| Not hardware-GPU-certified in CI | Browser smoke is correctness-only; hardware GPU certification is an explicit opt-in benchmark gate. |
| Not mesh-accurate simulation | Collision scope is practical navigation/coordination collision, covered by occupant, camera, stair/opening, and equipment tests. |
| Unorganized documentation | Source documents and generated artifacts are registered in `docs/DOCUMENT_REGISTER.md`. |

Boundary: this resolves deficiency tracking and prevents false buildability claims. It does not make the current rowhome model ready to build tomorrow.
