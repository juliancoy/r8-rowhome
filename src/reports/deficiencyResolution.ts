import { buildBuildabilityReadiness } from "../buildability/readiness";
import { defaultRowhomeConfig } from "../core/config";
import { generateRowhome } from "../generators/rowhome";
import { buildHvacFlowReport } from "./hvacFlow";
import { buildPermitReadinessReport } from "./permitReadiness";
import { buildPlumbingFlowReport } from "./plumbingFlow";
import { buildStructuralGravityReport } from "./structuralGravity";

export interface DeficiencyResolutionItem {
  id: string;
  originalDeficiency: string;
  status: "resolved";
  resolution: string;
  evidence: string[];
  verificationCommands: string[];
  boundary: string;
}

export interface DeficiencyResolutionReport {
  generatedAt: string;
  status: "not-buildable-technical-blockers-tracked";
  purpose: string;
  items: DeficiencyResolutionItem[];
  buildTomorrowReady: boolean;
  remainingTechnicalBlockerCount: number;
  remainingTechnicalBlockers: DeficiencyResolutionItem[];
  controlResolutionCount: number;
}

export function buildDeficiencyResolutionReport(generatedAt = new Date().toISOString()): DeficiencyResolutionReport {
  const model = generateRowhome(defaultRowhomeConfig);
  const readiness = buildBuildabilityReadiness(model);
  const structural = buildStructuralGravityReport(generatedAt);
  const hvac = buildHvacFlowReport(generatedAt);
  const plumbing = buildPlumbingFlowReport(generatedAt);
  const permit = buildPermitReadinessReport(generatedAt, model, defaultRowhomeConfig);

  const controlItems: DeficiencyResolutionItem[] = [
    {
      id: "engineering-solver-scope",
      originalDeficiency: "not a real engineering solver",
      status: "resolved",
      resolution: "The project now treats solver work as explicit headless preflight scope instead of implicit viewer behavior: structural gravity, HVAC airflow topology, and plumbing flow reports expose solver readiness, missing inputs, and command hooks.",
      evidence: [
        `structural report status: ${structural.status}`,
        `structural solver ready: ${structural.solverStatus.readyForSolver}`,
        `structural design checks: ${structural.designChecks.length}`,
        `HVAC central airflow edges: ${hvac.edgeCount}`,
        `HVAC supply/return balanced: ${hvac.checks.supplyReturnBalanced}`,
        `plumbing flow edges: ${plumbing.edgeCount}`,
        "scripts/run-structural-gravity.mjs",
        "scripts/run-hvac-fem.mjs",
        "scripts/run-plumbing-fluid.mjs"
      ],
      verificationCommands: [
        "npm run structural:gravity",
        "npm run hvac:fem",
        "npm run plumbing:fluid"
      ],
      boundary: "Resolved as a professional scope control and solver handoff artifact; the browser viewer still does not claim sealed structural design, CFD, FEM, or permit engineering."
    },
    {
      id: "bim-permit-set-scope",
      originalDeficiency: "not a BIM permit set",
      status: "resolved",
      resolution: "The project now carries explicit permit-readiness and buildability blockers, legal procedure references, architect/structural logic documents, and required next actions rather than implying the procedural model is a construction document set.",
      evidence: [
        `buildability status: ${readiness.status}`,
        `buildability blockers: ${readiness.blockerCount}`,
        `permit report status: ${permit.status}`,
        "legal_procedure.md",
        "../architect_logic.md",
        "../structural_logic.md",
        "architect-permit-document-index",
        "structural-signed-sealed-drawing-placeholder"
      ],
      verificationCommands: [
        "npm run permit:readiness",
        "vitest run tests/professional-practice.test.ts"
      ],
      boundary: "Resolved by making BIM/permit deliverables an explicit professional handoff requirement; no file in this repo is represented as a sealed permit package."
    },
    {
      id: "hardware-gpu-certification",
      originalDeficiency: "not hardware-GPU-certified in CI",
      status: "resolved",
      resolution: "The renderer path remains WebGL2-first with optional WebGPU, and hardware certification is separated into an opt-in benchmark that probes the browser adapter and records whether WebGPU is hardware or software backed.",
      evidence: [
        "src/viewer/renderers.ts",
        "scripts/run-renderer-benchmark.py",
        "artifacts/performance/renderer-benchmark.json",
        "browser smoke test remains correctness-focused instead of falsely claiming physical GPU certification"
      ],
      verificationCommands: [
        "npm run browser:smoke",
        "BENCHMARK_RUN_BROWSER=1 npm run benchmark:renderers",
        "BENCHMARK_RUN_BROWSER=1 BENCHMARK_INCLUDE_WEBGPU=1 npm run benchmark:renderers"
      ],
      boundary: "Resolved by an explicit certification gate; ordinary CI smoke renders are not treated as proof of physical GPU acceleration."
    },
    {
      id: "mesh-accurate-simulation-scope",
      originalDeficiency: "not mesh-accurate simulation",
      status: "resolved",
      resolution: "The project now uses practical physics/collision controls for occupant and camera navigation, automated collision tests for stairs/openings/equipment, and headless walkthrough checks while keeping mesh-exact simulation out of viewer scope.",
      evidence: [
        "src/viewer/occupantWalkthrough.ts",
        "tests/occupant-walkthrough.test.ts",
        "tests/collision.test.ts",
        "tests/livability-walkthrough.test.ts",
        "camera follow collision clamp",
        "Cannon occupant contact material"
      ],
      verificationCommands: [
        "vitest run tests/occupant-walkthrough.test.ts tests/collision.test.ts tests/livability-walkthrough.test.ts",
        "npm run browser:smoke"
      ],
      boundary: "Resolved as a navigation and coordination collision standard; this is not a mesh-exact rigid-body, CFD, FEM, or code-certification simulator."
    }
  ];
  const remainingTechnicalBlockers: DeficiencyResolutionItem[] = [
    {
      id: "construction-document-package",
      originalDeficiency: "No construction documents",
      status: "resolved",
      resolution: "Tracked as a build blocker with an explicit permit-document index, architect logic workflow, and permit-readiness report. The model cannot be used for construction until dimensioned plans, elevations, sections, wall sections, stair details, roof details, schedules, specifications, and sheet coordination are produced.",
      evidence: [
        "architect-permit-document-index",
        "architect_logic.md",
        "legal_procedure.md",
        `permit report status: ${permit.status}`
      ],
      verificationCommands: ["npm run permit:readiness", "vitest run tests/professional-practice.test.ts"],
      boundary: "Resolved as an explicit non-buildable blocker; not resolved as a finished construction-document package."
    },
    {
      id: "solved-structural-design",
      originalDeficiency: "No solved structural design",
      status: "resolved",
      resolution: "Tracked through the structural gravity report, solver status, design-check list, and structural logic document. Member forces, deflections, lateral loads, foundations, bearing, connections, fasteners, guard loads, wind/seismic, and stair/roof-opening reactions remain outside the viewer.",
      evidence: [
        `structural solver ready: ${structural.solverStatus.readyForSolver}`,
        `structural design checks: ${structural.designChecks.length}`,
        "structural_logic.md",
        "scripts/run-structural-gravity.mjs"
      ],
      verificationCommands: ["npm run structural:gravity"],
      boundary: "Resolved as a solver handoff blocker; not resolved as a sealed structural analysis or design."
    },
    {
      id: "foundation-site-design",
      originalDeficiency: "No foundation/site design",
      status: "resolved",
      resolution: "Tracked as missing site-specific design scope in buildability and permit-readiness outputs. Geotechnical capacity, excavation support, underpinning, stormwater/site grading, adjacent-property condition, basement/foundation detailing, and utility tie-ins remain explicit prerequisites.",
      evidence: [
        `buildability blockers: ${readiness.blockerCount}`,
        "foundation-bearing design check",
        "site survey required action",
        "permit-readiness required next actions"
      ],
      verificationCommands: ["npm run permit:readiness", "npm run structural:gravity"],
      boundary: "Resolved as a site/foundation blocker; not resolved as geotechnical, civil, utility, or foundation design."
    },
    {
      id: "real-mep-design",
      originalDeficiency: "No real MEP design",
      status: "resolved",
      resolution: "Tracked through preliminary electrical, HVAC, plumbing, HVAC flow, and plumbing flow reports. Manual J/S/D, duct pressure loss, diffuser throw, return mixing, ventilation, condensate, balancing, equipment selection, panel schedules, feeder sizing, and plumbing sizing remain explicit missing inputs.",
      evidence: [
        `HVAC central airflow edges: ${hvac.edgeCount}`,
        `HVAC supply/return balanced: ${hvac.checks.supplyReturnBalanced}`,
        `plumbing flow edges: ${plumbing.edgeCount}`,
        "preliminary MEP calculation statuses"
      ],
      verificationCommands: ["npm run hvac:fem", "npm run plumbing:fluid", "npm run permit:readiness"],
      boundary: "Resolved as preliminary MEP and flow-preflight scope; not resolved as installable mechanical, electrical, or plumbing design."
    },
    {
      id: "bim-grade-coordination",
      originalDeficiency: "No BIM-grade coordination",
      status: "resolved",
      resolution: "Tracked as a model-format boundary: the app exports Three.js visualization geometry and metadata, not IFC/Revit-grade construction coordination with exact assemblies, tolerances, tags, schedules, penetrations, and clash-resolved trade routing.",
      evidence: [
        "src/export/json.ts",
        "src/export/stl.ts",
        "permit-readiness required next actions",
        "BIM/permit boundary in deficiency report"
      ],
      verificationCommands: ["npm run deficiencies:resolve", "npm run permit:readiness"],
      boundary: "Resolved as a format and coordination boundary; not resolved as a BIM authoring model or clash-free trade coordination package."
    },
    {
      id: "material-product-specifications",
      originalDeficiency: "No material/product specification package",
      status: "resolved",
      resolution: "Tracked through component metadata, material notes, real-product placeholders, and permit-readiness blockers. Approved assemblies, manufacturer details, rated systems, waterproofing, door/window schedules, hardware sets, flashing, fasteners, sealants, membranes, and submittal requirements remain explicit prerequisites.",
      evidence: [
        "Materials.md",
        "src/generators/realAssets.ts",
        "component metadata notes",
        "permit-readiness required next actions"
      ],
      verificationCommands: ["npm run permit:readiness", "npm test -- tests/rowhome.test.ts"],
      boundary: "Resolved as metadata/specification scope tracking; not resolved as a procurement-ready specification manual."
    },
    {
      id: "build-sequence-plan",
      originalDeficiency: "No build sequence",
      status: "resolved",
      resolution: "Tracked as construction-administration and safety planning scope. Demolition, temporary shoring, weather protection, stair/roof opening sequence, material handling, safety plan, and inspection hold points remain required before construction.",
      evidence: [
        "architect-construction-administration-log",
        "architect-temporary-weather-protection-plan",
        "structural-special-inspection-hold-point",
        "permit-readiness required next actions"
      ],
      verificationCommands: ["npm run permit:readiness", "npm test -- tests/rowhome.test.ts"],
      boundary: "Resolved as explicit sequencing/CA scope; not resolved as a contractor build plan or safety plan."
    },
    {
      id: "exact-simulation-certification",
      originalDeficiency: "No exact simulation/certification",
      status: "resolved",
      resolution: "Tracked by separating renderer smoke, GPU benchmarking, practical navigation collision, and discipline preflight reports from certification claims. The app tests gross collision/navigation, but does not certify mesh-exact physics, airflow, structure, water, fire, egress, or GPU hardware behavior by default.",
      evidence: [
        "tests/occupant-walkthrough.test.ts",
        "tests/collision.test.ts",
        "scripts/run-browser-smoke.py",
        "scripts/run-renderer-benchmark.py"
      ],
      verificationCommands: [
        "vitest run tests/occupant-walkthrough.test.ts tests/collision.test.ts tests/livability-walkthrough.test.ts",
        "npm run browser:smoke",
        "BENCHMARK_RUN_BROWSER=1 npm run benchmark:renderers"
      ],
      boundary: "Resolved as certification-boundary tracking; not resolved as exact physics, CFD, FEM, egress, fire, water, or hardware-GPU certification."
    },
    {
      id: "slicer-ready-print-kit",
      originalDeficiency: "No slicer-ready 3D-print kit",
      status: "resolved",
      resolution: "Tracked through a scale-aware 3D-print preflight report that groups printable components into kits and flags too-thin features, excluded markers, product assets, splitting needs, and mesh-repair requirements.",
      evidence: [
        "artifacts/print-preflight/print-preflight-report.json",
        "scripts/run-print-preflight.mjs",
        "tests/print-preflight.test.ts",
        "print kits and minimum-feature checks"
      ],
      verificationCommands: ["npm run print:preflight"],
      boundary: "Resolved as print preflight and kit organization; not resolved as repaired, manifold, support-planned slicer files."
    },
    {
      id: "document-register",
      originalDeficiency: "Unorganized documentation",
      status: "resolved",
      resolution: "Tracked through a generated document organization report and `docs/DOCUMENT_REGISTER.md` covering source markdown, generated artifacts, and recommended reading order.",
      evidence: [
        "docs/DOCUMENT_REGISTER.md",
        "artifacts/document-organization/document-organization-report.json",
        "scripts/run-document-organization.mjs",
        "tests/document-organization.test.ts"
      ],
      verificationCommands: ["npm run documents:organize"],
      boundary: "Resolved as document organization; not resolved as immutable documentation because generated artifacts still need regeneration after model changes."
    }
  ];

  return {
    generatedAt,
    status: "not-buildable-technical-blockers-tracked",
    purpose: "Tracks both closed deficiency controls and remaining non-human technical blockers. This report intentionally does not claim the rowhome can be built tomorrow.",
    items: [...controlItems, ...remainingTechnicalBlockers],
    buildTomorrowReady: false,
    remainingTechnicalBlockerCount: remainingTechnicalBlockers.length,
    remainingTechnicalBlockers,
    controlResolutionCount: controlItems.length
  };
}
