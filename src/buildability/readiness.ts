import type { RowhomeModel } from "../core/types";
import { sources } from "../core/sources";

export type BuildabilityDiscipline =
  | "architecture"
  | "structural"
  | "electrical"
  | "hvac"
  | "plumbing"
  | "envelope"
  | "site"
  | "cost"
  | "legal";

export type BuildabilityStatus = "model-supported" | "blocked";

export interface BuildabilityItem {
  id: string;
  discipline: BuildabilityDiscipline;
  status: BuildabilityStatus;
  requirement: string;
  evidence: string[];
  missingInputs: string[];
  source: string;
}

export interface BuildabilityReadiness {
  status: "not-buildable" | "ready-for-professional-review";
  modelSupportedCount: number;
  blockerCount: number;
  items: BuildabilityItem[];
}

function hasComponent(model: RowhomeModel, id: string): boolean {
  return model.components.some((component) => component.metadata.id === id);
}

export function buildBuildabilityReadiness(model: RowhomeModel): BuildabilityReadiness {
  const items: BuildabilityItem[] = [
    {
      id: "architecture-program-modeled",
      discipline: "architecture",
      status: hasComponent(model, "front-door") && hasComponent(model, "rear-exit-door-1") && hasComponent(model, "architect-egress-life-safety-path") ? "model-supported" : "blocked",
      requirement: "Concept model includes rooms, primary entry, rear exits, stairs, visible rowhome facade intent, and architectural egress coordination markers.",
      evidence: ["front-door", "rear-exit-door-1", "stair-run-1", "living-room-zone", "kitchen-room-zone", "architect-egress-life-safety-path", "architect-stair-headroom-envelope-1"].filter((id) => hasComponent(model, id)),
      missingInputs: [],
      source: sources.r8
    },
    {
      id: "architect-roof-envelope-coordination-modeled",
      discipline: "architecture",
      status: hasComponent(model, "architect-roof-access-bulkhead-weatherhood") && hasComponent(model, "architect-roof-membrane-turnup") ? "model-supported" : "blocked",
      requirement: "Concept model includes architectural roof access, membrane, drainage, envelope continuity, and protected penetration coordination markers.",
      evidence: [
        "architect-roof-access-bulkhead-weatherhood",
        "architect-roof-membrane-turnup",
        "architect-curb-air-vapor-control-front",
        "architect-rated-penetration-firestop-roof-vent",
        "architect-mep-roof-penetration-coordination-zone"
      ].filter((id) => hasComponent(model, id)),
      missingInputs: [],
      source: sources.permitDocuments
    },
    {
      id: "all-electric-systems-modeled",
      discipline: "electrical",
      status: hasComponent(model, "electrical-panel") && hasComponent(model, "central-ac-condenser") && hasComponent(model, "electric-water-heater") && hasComponent(model, "lithium-ion-battery") ? "model-supported" : "blocked",
      requirement: "Concept model remains all-electric and includes electrical service, centralized AC cooling airflow equipment, electric water heating, PV, and lithium-ion storage.",
      evidence: ["electrical-panel", "central-ac-condenser", "air-handler", "central-cooling-coil", "floor-1-cooling-zone-terminal", "floor-2-cooling-zone-terminal", "floor-3-cooling-zone-terminal", "electric-water-heater", "electric-range", "lithium-ion-battery", "pv-hybrid-inverter"].filter((id) => hasComponent(model, id)),
      missingInputs: [],
      source: sources.electricalCode
    },
    {
      id: "plumbing-network-modeled",
      discipline: "plumbing",
      status: hasComponent(model, "water-service-lateral") && hasComponent(model, "sanitary-building-drain") ? "model-supported" : "blocked",
      requirement: "Concept model includes potable water, sanitary DWV, vent, storm, and condensate paths.",
      evidence: ["water-service-lateral", "sanitary-building-drain", "vent-stack-through-roof", "roof-drain-leader"].filter((id) => hasComponent(model, id)),
      missingInputs: [],
      source: sources.plumbingCode
    },
    {
      id: "sealed-architectural-drawings-required",
      discipline: "architecture",
      status: "blocked",
      requirement: "Permit-ready architectural drawings, schedules, details, specifications, code analysis, AHJ responses, and closeout requirements must be prepared and reviewed.",
      evidence: [
        "architect-code-basis-and-zoning-matrix",
        "architect-permit-document-index",
        "architect-ahj-review-response-log",
        "architect-construction-administration-log",
        "architect-closeout-records"
      ].filter((id) => hasComponent(model, id)),
      missingInputs: [
        "dimensioned drawings",
        "life-safety and egress analysis",
        "door/window schedules",
        "wall sections",
        "waterproofing details",
        "rated assembly details",
        "specifications",
        "AHJ approval",
        "licensed architect review"
      ],
      source: sources.permitDocuments
    },
    {
      id: "structural-design-required",
      discipline: "structural",
      status: "blocked",
      requirement: "Structural design must be solved, checked, and documented before construction.",
      evidence: model.structural ? ["conceptual gravity model exists"] : [],
      missingInputs: ["stiffness model", "member forces", "capacity checks", "lateral loads", "foundation bearing", "connection design", "sealed structural drawings where required"],
      source: sources.residentialCode
    },
    {
      id: "electrical-design-required",
      discipline: "electrical",
      status: "blocked",
      requirement: "Electrical design must include load calculations, panel schedule, protection, grounding, PV/battery interconnection, energy-storage safety, and inspection documents.",
      evidence: hasComponent(model, "electrical-panel") ? ["schematic panel exists"] : [],
      missingInputs: ["load calculation", "panel schedule", "conductor sizing", "breaker sizing", "PV interconnection", "battery energy-storage listing and shutdown", "AFCI/GFCI requirements", "grounding and bonding design"],
      source: sources.electricalCode
    },
    {
      id: "hvac-design-required",
      discipline: "hvac",
      status: "blocked",
      requirement: "HVAC design must size central cooling equipment, ducts/air distribution, ventilation, controls, fluid/airflow boundary conditions, and commissioning requirements.",
      evidence: hasComponent(model, "floor-1-cooling-zone-terminal") ? ["schematic central cooling airflow zones exist"] : [],
      missingInputs: ["Manual J cooling loads", "floor-by-floor cooling airflow allocation", "Manual S", "Manual D", "ventilation calculation", "static pressure calculation", "CFD/fluid boundary conditions", "balancing and commissioning requirements"],
      source: "sources/code-building-codes-part-v-international-mechanical-code-full.html"
    },
    {
      id: "plumbing-design-required",
      discipline: "plumbing",
      status: "blocked",
      requirement: "Plumbing design must size water, DWV, venting, cleanouts, supports, and utility connections.",
      evidence: hasComponent(model, "soil-stack") ? ["schematic soil stack exists"] : [],
      missingInputs: ["fixture-unit sizing", "trap and vent validation", "cleanout schedule", "water service sizing", "drain slope routing", "inspection documents"],
      source: sources.plumbingCode
    },
    {
      id: "site-permit-inputs-required",
      discipline: "site",
      status: "blocked",
      requirement: "Site-specific legal and civil inputs must be obtained before construction.",
      evidence: hasComponent(model, "front-sidewalk") ? ["conceptual frontage exists"] : [],
      missingInputs: ["survey", "property/legal constraints", "utility confirmations", "stormwater requirements", "right-of-way requirements", "erosion-control requirements"],
      source: "sources/dhcd-eplans-getting-started-guide-2026-05.pdf"
    },
    {
      id: "permit-approval-required",
      discipline: "legal",
      status: "blocked",
      requirement: "Authority having jurisdiction must approve required permits before construction starts.",
      evidence: ["permit procedure documented"],
      missingInputs: ["permit application", "plan review", "approved drawings", "inspection schedule", "final approval process"],
      source: "legal_procedure.md"
    }
  ];

  const blockerCount = items.filter((item) => item.status === "blocked").length;
  return {
    status: blockerCount === 0 ? "ready-for-professional-review" : "not-buildable",
    modelSupportedCount: items.filter((item) => item.status === "model-supported").length,
    blockerCount,
    items
  };
}
