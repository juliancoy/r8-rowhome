import { defaultRowhomeConfig } from "../core/config";
import { generateRowhome } from "../generators/rowhome";
import { buildBuildabilityReadiness } from "../buildability/readiness";
import { constructionSystemOptions } from "../core/constructionSystems";
import { sources } from "../core/sources";
import type { ConstructionSystem, RowhomeConfig } from "../core/types";

export type PermitDocumentStatus =
  | "generated-by-model"
  | "requires-licensed-professional"
  | "requires-site-specific-input"
  | "requires-owner-action";

export interface PermitDocumentEntry {
  id: string;
  name: string;
  requiredBy: string;
  status: PermitDocumentStatus;
  modelArtifact?: string;
  notes: string;
  source: string;
}

export interface PermitApplicationStep {
  sequence: number;
  name: string;
  description: string;
  responsible: string;
  source: string;
}

export interface ZoningDataSheetEntry {
  item: string;
  modeledValue: string;
  basis: string;
  status: "internally-consistent" | "requires-zoning-verification";
}

export interface PermitPackageReport {
  generatedAt: string;
  purpose: string;
  scopeBoundary: string;
  jurisdiction: string;
  permitPath: string;
  buildabilityStatus: string;
  blockerCount: number;
  zoningDataSheet: ZoningDataSheetEntry[];
  applicationSteps: PermitApplicationStep[];
  documentRegister: PermitDocumentEntry[];
  constructionSystems: Array<{
    id: ConstructionSystem;
    label: string;
    statementOfWorkArtifact: string;
  }>;
  professionalSealGaps: string[];
  checks: {
    buildingFitsLot: boolean;
    noModelErrorValidation: boolean;
    everyDocumentHasStatus: boolean;
    sealGapsExplicit: boolean;
  };
}

function zoningDataSheet(config: RowhomeConfig): ZoningDataSheetEntry[] {
  const buildingHeightFt = config.stories * config.storyHeightFt;
  return [
    {
      item: "Zoning district and use",
      modeledValue: "R-8 Rowhouse and Multi-Family Residential District; attached rowhouse dwelling",
      basis: sources.r8,
      status: "requires-zoning-verification"
    },
    {
      item: "Lot width",
      modeledValue: `${config.lotWidthFt} ft`,
      basis: sources.r8,
      status: "requires-zoning-verification"
    },
    {
      item: "Lot depth",
      modeledValue: `${config.lotDepthFt} ft`,
      basis: sources.r8,
      status: "requires-zoning-verification"
    },
    {
      item: "Lot area",
      modeledValue: `${config.lotWidthFt * config.lotDepthFt} sf`,
      basis: sources.r8,
      status: "requires-zoning-verification"
    },
    {
      item: "Building footprint",
      modeledValue: `${config.buildingWidthFt} ft x ${config.buildingDepthFt} ft`,
      basis: sources.r8,
      status: config.buildingWidthFt <= config.lotWidthFt && config.buildingDepthFt <= config.lotDepthFt ? "internally-consistent" : "requires-zoning-verification"
    },
    {
      item: "Building height",
      modeledValue: `${buildingHeightFt} ft (${config.stories} stories above grade${config.includeBasement ? " plus basement" : ""})`,
      basis: sources.r8,
      status: "requires-zoning-verification"
    },
    {
      item: "Rear yard",
      modeledValue: `${config.lotDepthFt - config.buildingDepthFt} ft modeled rear yard depth`,
      basis: sources.r8,
      status: "requires-zoning-verification"
    },
    {
      item: "Dwelling units",
      modeledValue: `${Math.max(1, Math.round(config.rowhomeCount))} attached rowhouse dwelling unit(s)`,
      basis: sources.r8,
      status: "requires-zoning-verification"
    }
  ];
}

const applicationSteps: PermitApplicationStep[] = [
  {
    sequence: 1,
    name: "Property and zoning verification",
    description:
      "Confirm property identity, ownership, R-8 zoning district, overlays, historic district status, easements, and right-of-way constraints; obtain a boundary and topographic survey.",
    responsible: "Owner with surveyor and zoning counsel as needed",
    source: sources.r8
  },
  {
    sequence: 2,
    name: "Engage licensed design team",
    description:
      "Retain the Maryland-licensed architect, structural engineer, MEP design, geotechnical, and civil/stormwater professionals listed in the statement of work.",
    responsible: "Owner",
    source: "sources/dhcd-epermits-document-requirements-by-profession.pdf"
  },
  {
    sequence: 3,
    name: "Prepare sealed permit documents",
    description:
      "Convert the model into dimensioned, sealed permit drawings, specifications, schedules, and discipline calculations per the DHCD document requirements by trade and profession.",
    responsible: "Design team",
    source: "sources/dhcd-document-requirements-by-trade-2026-04.pdf"
  },
  {
    sequence: 4,
    name: "Create ePermits application",
    description:
      "Open the Baltimore City DHCD ePermits one/two-family combination new-construction application and register all licensed professionals on the permit.",
    responsible: "Owner or authorized agent",
    source: "sources/dhcd-epermits-one-two-family-combo-new-construction-guide.pdf"
  },
  {
    sequence: 5,
    name: "Upload plans through ePlans",
    description: "Submit the sealed drawing set and supporting documents through ePlans following the submission matrix naming and sheet standards.",
    responsible: "Design team",
    source: "sources/dhcd-eplans-submission-matrix-2026-01-26.pdf"
  },
  {
    sequence: 6,
    name: "Plan review and comment response",
    description: "Respond to zoning, building, fire, site/stormwater, and forestry plan-review comments until approval.",
    responsible: "Design team",
    source: "sources/dhcd-eplans-getting-started-guide-2026-05.pdf"
  },
  {
    sequence: 7,
    name: "Permit issuance and fees",
    description: "Pay assessed fees and receive the issued building and trade permits before any site disturbance.",
    responsible: "Owner",
    source: "sources/dhcd-epermits-one-two-family-combo-new-construction-guide.pdf"
  },
  {
    sequence: 8,
    name: "Construction inspections",
    description:
      "Schedule and pass required inspections (footing, foundation/backfill, framing/structural, rough-in trades, insulation, finals) per the inspection guidelines and the statement-of-work hold points.",
    responsible: "General contractor with licensed trades",
    source: "sources/dhcd-inspection-guidelines-2026-01.pdf"
  },
  {
    sequence: 9,
    name: "Use and Occupancy",
    description: "Obtain the Use and Occupancy permit after final approvals.",
    responsible: "Owner with general contractor",
    source: "sources/dhcd-epermits-use-and-occupancy-guide-2025.pdf"
  }
];

function documentRegister(): PermitDocumentEntry[] {
  return [
    {
      id: "boundary-topographic-survey",
      name: "Boundary and topographic survey",
      requiredBy: "Zoning and site plan review",
      status: "requires-site-specific-input",
      notes: "Must be produced by a Maryland-licensed land surveyor for the actual parcel.",
      source: sources.permitDocuments
    },
    {
      id: "sealed-architectural-set",
      name: "Sealed architectural drawing set",
      requiredBy: "Building plan review",
      status: "requires-licensed-professional",
      notes: "Dimensioned plans, elevations, sections, wall sections, stair details, life-safety plan, and schedules sealed by a Maryland-licensed architect. The model's geometry, screenshots, and construction-document preflight index are coordination inputs only.",
      source: "sources/dhcd-document-requirements-by-trade-2026-04.pdf"
    },
    {
      id: "sealed-structural-design",
      name: "Sealed structural drawings and calculations",
      requiredBy: "Building plan review",
      status: "requires-licensed-professional",
      notes: "Solved gravity and lateral design for the selected construction system. The conceptual gravity-load model and demand reports are engineering-handoff inputs only.",
      source: "sources/dhcd-document-requirements-by-trade-2026-04.pdf"
    },
    {
      id: "geotechnical-report",
      name: "Geotechnical report",
      requiredBy: "Structural and foundation review",
      status: "requires-site-specific-input",
      notes: "Soil bearing, groundwater, excavation support, and underpinning evaluation for basement and party-wall conditions.",
      source: sources.permitDocuments
    },
    {
      id: "electrical-design",
      name: "Electrical design, load calculation, and panel schedule",
      requiredBy: "Electrical plan review and licensed master electrician",
      status: "requires-licensed-professional",
      modelArtifact: "artifacts/electrical-circuits/electrical-circuit-report.json",
      notes: "The model provides a verified-connectivity schematic panel schedule and circuit topology as design input; the NEC load calculation and final design require the licensed master.",
      source: sources.electricalCode
    },
    {
      id: "mechanical-design",
      name: "Mechanical design (Manual J/S/D or local equivalent)",
      requiredBy: "Mechanical plan review and licensed HVACR master",
      status: "requires-licensed-professional",
      modelArtifact: "artifacts/hvac-flow/hvac-flow-report.json",
      notes: "The model provides a conservation-checked duct topology with design CFM as input; load calculations and equipment selection require the licensed designer.",
      source: "sources/code-building-codes-part-v-international-mechanical-code-full.html"
    },
    {
      id: "plumbing-design",
      name: "Plumbing riser, fixture-unit, and sizing design",
      requiredBy: "Plumbing plan review and licensed master plumber",
      status: "requires-licensed-professional",
      modelArtifact: "artifacts/plumbing-fluid/plumbing-flow-report.json",
      notes: "The model provides fixture and pipe topology with DFU/GPM metadata as input.",
      source: sources.plumbingCode
    },
    {
      id: "fire-sprinkler-design",
      name: "Residential fire sprinkler design (Maryland requirement for new dwellings)",
      requiredBy: "Fire plan review",
      status: "requires-licensed-professional",
      notes: "Required for new Maryland dwellings; not yet modeled in geometry. Carried as explicit scope in the statement of work.",
      source: sources.residentialCode
    },
    {
      id: "energy-compliance",
      name: "Residential energy-code compliance documentation",
      requiredBy: "Building plan review",
      status: "requires-licensed-professional",
      notes: "Envelope assemblies and insulation intent are modeled; compliance path documentation requires the design team.",
      source: sources.energyCode
    },
    {
      id: "stormwater-esc",
      name: "Stormwater management and erosion/sediment control documents",
      requiredBy: "Site plan review where disturbance thresholds apply",
      status: "requires-licensed-professional",
      notes: "Site grading and drainage direction are modeled conceptually; engineered documents follow Baltimore Article 7 and MDE standards.",
      source: sources.naturalResources
    },
    {
      id: "statement-of-work",
      name: "Statement of work with trades, licensing, phases, and hold points",
      requiredBy: "Owner-contractor coordination",
      status: "generated-by-model",
      modelArtifact: "artifacts/statement-of-work/",
      notes: "Generated for both construction systems with model-derived quantities and rough-order material costs.",
      source: sources.plan
    },
    {
      id: "bill-of-materials",
      name: "Bill of materials and cost rollup",
      requiredBy: "Owner-contractor coordination",
      status: "generated-by-model",
      modelArtifact: "viewer BOM export (JSON/CSV)",
      notes: "Rough-order material quantities grouped by system; labeled estimates only.",
      source: sources.plan
    },
    {
      id: "structural-handoff",
      name: "Conceptual structural gravity model and demand report",
      requiredBy: "Structural engineer of record (input)",
      status: "generated-by-model",
      modelArtifact: "artifacts/structural-gravity/structural-gravity-report.json",
      notes: "Source-traced nodes, members, supports, loads, and load combinations for both construction systems.",
      source: sources.residentialCode
    },
    {
      id: "construction-document-preflight",
      name: "Construction-document preflight sheet index and schedules",
      requiredBy: "Design team (input)",
      status: "generated-by-model",
      modelArtifact: "artifacts/construction-documents/construction-document-preflight-report.json",
      notes: "Sheet index plus door, window, material, product, and coordination schedules generated from the model.",
      source: sources.plan
    },
    {
      id: "homebuilder-registration",
      name: "Maryland Home Builder Registration / MHIC license evidence",
      requiredBy: "Permit application",
      status: "requires-owner-action",
      notes: "The constructing entity must hold the applicable registration and Baltimore City contractor registration.",
      source: "sources/dhcd-epermits-renew-registration-licensed-professionals-2026-03-18.pdf"
    }
  ];
}

export function buildPermitPackageReport(generatedAt = new Date().toISOString()): PermitPackageReport {
  const config = defaultRowhomeConfig;
  const model = generateRowhome(config);
  const buildability = buildBuildabilityReadiness(model);
  const register = documentRegister();
  const sealGaps = register
    .filter((entry) => entry.status === "requires-licensed-professional")
    .map((entry) => entry.name);

  return {
    generatedAt,
    purpose:
      "Assembled Baltimore City R-8 permit application package: zoning data sheet, DHCD application path, document register, and statements of work for both construction systems.",
    scopeBoundary:
      "This package organizes every permitting step and document and identifies which inputs the model generates. It is not a permit application or approval; documents marked as requiring a licensed professional or site-specific input must be produced and sealed by the design team before submission.",
    jurisdiction: "Baltimore City Department of Housing & Community Development (DHCD)",
    permitPath: "ePermits one/two-family combination permit — new construction, with ePlans drawing submission",
    buildabilityStatus: buildability.status,
    blockerCount: buildability.blockerCount,
    zoningDataSheet: zoningDataSheet(config),
    applicationSteps,
    documentRegister: register,
    constructionSystems: constructionSystemOptions.map((option) => ({
      id: option.id,
      label: option.label,
      statementOfWorkArtifact: `artifacts/statement-of-work/STATEMENT_OF_WORK-${option.id}.md`
    })),
    professionalSealGaps: sealGaps,
    checks: {
      buildingFitsLot: config.buildingWidthFt <= config.lotWidthFt && config.buildingDepthFt <= config.lotDepthFt,
      noModelErrorValidation: model.validation.every((message) => message.severity !== "error"),
      everyDocumentHasStatus: register.every((entry) => entry.status.length > 0 && entry.notes.length > 0),
      sealGapsExplicit: sealGaps.length > 0
    }
  };
}

export function renderPermitPackageMarkdown(report: PermitPackageReport): string {
  const lines: string[] = [
    "# Baltimore R-8 Permit Application Package",
    "",
    `Jurisdiction: ${report.jurisdiction}`,
    "",
    `Permit path: ${report.permitPath}`,
    "",
    `> ${report.scopeBoundary}`,
    "",
    `Current buildability status: **${report.buildabilityStatus}** (${report.blockerCount} tracked blockers).`,
    "",
    "## Zoning Data Sheet (modeled values for verification)",
    "",
    "| Item | Modeled value | Status |",
    "| --- | --- | --- |",
    ...report.zoningDataSheet.map((entry) => `| ${entry.item} | ${entry.modeledValue} | ${entry.status} |`),
    "",
    "## Application Steps",
    ""
  ];
  for (const step of report.applicationSteps) {
    lines.push(`${step.sequence}. **${step.name}** — ${step.description} _(Responsible: ${step.responsible}; basis: ${step.source})_`);
  }
  lines.push(
    "",
    "## Document Register",
    "",
    "| Document | Required by | Status | Model artifact |",
    "| --- | --- | --- | --- |",
    ...report.documentRegister.map(
      (entry) => `| ${entry.name} | ${entry.requiredBy} | ${entry.status} | ${entry.modelArtifact ?? "—"} |`
    ),
    "",
    "## Construction System Statements of Work",
    "",
    ...report.constructionSystems.map((system) => `- ${system.label}: \`${system.statementOfWorkArtifact}\``),
    "",
    "## Professional Seal Gaps (must be closed before submission)",
    "",
    ...report.professionalSealGaps.map((gap) => `- ${gap}`),
    ""
  );
  return lines.join("\n");
}
