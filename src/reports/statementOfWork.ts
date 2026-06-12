import { defaultRowhomeConfig } from "../core/config";
import { generateRowhome } from "../generators/rowhome";
import { constructionSystemOptions } from "../core/constructionSystems";
import { assignComponentsToRoles, rolesForSystem, skillsForRole } from "../core/personnel";
import { sources } from "../core/sources";
import type { ConstructionSystem, RowhomeConfig } from "../core/types";

export interface DesignTeamRequirement {
  role: string;
  requirement: string;
  sealRequired: boolean;
  source: string;
}

export interface PersonnelRequirement {
  roleId: string;
  title: string;
  scopeSummary: string;
  skills: string[];
  marylandCredential: string;
  crewSize: { minimum: number; typical: number };
  phases: number[];
  componentCount: number;
  estimatedMaterialCostUsd: number;
}

export interface SowPhase {
  sequence: number;
  name: string;
  description: string;
  personnel: string[];
  inspectionHoldPoints: string[];
}

export interface StatementOfWorkReport {
  generatedAt: string;
  projectName: string;
  purpose: string;
  scopeBoundary: string;
  constructionSystem: {
    id: ConstructionSystem;
    label: string;
    notes: string;
  };
  designTeam: DesignTeamRequirement[];
  personnel: PersonnelRequirement[];
  phases: SowPhase[];
  totals: {
    componentCount: number;
    estimatedMaterialCostUsd: number;
    typicalCrewHeadcount: number;
  };
  exclusions: string[];
  sourceDocuments: string[];
}

const designTeam: DesignTeamRequirement[] = [
  {
    role: "Architect of record",
    requirement: "Maryland-licensed architect to prepare and seal the permit drawing set, life-safety plan, and energy compliance documentation.",
    sealRequired: true,
    source: sources.permitDocuments
  },
  {
    role: "Structural engineer of record",
    requirement: "Maryland-licensed professional engineer to design and seal gravity and lateral structural systems, foundations, and party-wall conditions.",
    sealRequired: true,
    source: sources.permitDocuments
  },
  {
    role: "MEP engineer or qualified trade design",
    requirement: "Mechanical, electrical, and plumbing design (Manual J/S/D, NEC load calculation, riser diagrams) sealed or prepared per Baltimore City DHCD profession requirements.",
    sealRequired: true,
    source: sources.permitDocuments
  },
  {
    role: "Geotechnical engineer",
    requirement: "Soil bearing, excavation support, underpinning evaluation, and foundation recommendations for basement and party-wall conditions.",
    sealRequired: true,
    source: sources.permitDocuments
  },
  {
    role: "Civil/stormwater engineer",
    requirement: "Stormwater management and erosion/sediment control compliance per Baltimore City Article 7 and MDE standards where disturbance thresholds apply.",
    sealRequired: true,
    source: sources.naturalResources
  },
  {
    role: "General contractor",
    requirement: "Maryland Home Builder Registration (new dwelling) or MHIC license (improvement), Baltimore City contractor registration, and insurance per permit requirements.",
    sealRequired: false,
    source: sources.permitDocuments
  }
];

interface PhaseDefinition {
  sequence: number;
  name: string;
  description: (system: ConstructionSystem) => string;
  inspectionHoldPoints: string[];
}

const phaseDefinitions: PhaseDefinition[] = [
  {
    sequence: 1,
    name: "Pre-construction and permits",
    description: () =>
      "Complete sealed design documents, obtain Baltimore City DHCD permits, utility coordination, and pre-construction surveys of adjacent party walls.",
    inspectionHoldPoints: ["Permit issuance before any site disturbance"]
  },
  {
    sequence: 2,
    name: "Site preparation",
    description: () => "Erosion and sediment controls, demolition or clearing, excavation support, and excavation to bearing.",
    inspectionHoldPoints: ["Erosion/sediment control inspection", "Excavation/bearing inspection before footings"]
  },
  {
    sequence: 3,
    name: "Foundations and basement",
    description: () => "Footings, foundation walls, waterproofing, foundation drainage, under-slab utilities, and basement slab.",
    inspectionHoldPoints: ["Footing inspection before concrete placement", "Foundation/backfill inspection", "Under-slab plumbing inspection"]
  },
  {
    sequence: 4,
    name: "Primary structure",
    description: (system) =>
      system === "steel-concrete"
        ? "Erect steel columns, beams, and girders; place metal deck; place reinforcement; form and pour concrete party walls, rear wall, and slabs."
        : "Lay masonry party and rear walls; frame engineered wood floors, roof, and stair openings.",
    inspectionHoldPoints: ["Structural framing/erection inspection", "Special inspections per approved program"]
  },
  {
    sequence: 5,
    name: "Envelope and roofing",
    description: () => "Facade cladding, windows, exterior doors, air/water barriers, roof membrane, parapets, and flashing.",
    inspectionHoldPoints: ["Envelope/flashing inspection before concealment"]
  },
  {
    sequence: 6,
    name: "MEP rough-in",
    description: () =>
      "Electrical branch wiring, plumbing supply/DWV, HVAC ductwork and equipment, sprinkler piping, and PV raceways before close-in.",
    inspectionHoldPoints: [
      "Electrical rough-in inspection",
      "Plumbing rough-in inspection",
      "Mechanical rough-in inspection",
      "Sprinkler rough-in inspection"
    ]
  },
  {
    sequence: 7,
    name: "Insulation and air sealing",
    description: () => "Thermal insulation, air barrier continuity, and fire-resistance assemblies at party walls and ceilings.",
    inspectionHoldPoints: ["Insulation inspection before gypsum", "Fire-resistance assembly inspection"]
  },
  {
    sequence: 8,
    name: "Interior finishes",
    description: () => "Gypsum board, stairs, guards, handrails, doors, trim, kitchen and bath fixtures, and finish electrical devices.",
    inspectionHoldPoints: []
  },
  {
    sequence: 9,
    name: "Site finishes and landscape",
    description: () => "Sidewalk restoration, rear yard surfaces, planting, and street tree.",
    inspectionHoldPoints: ["Right-of-way restoration inspection"]
  },
  {
    sequence: 10,
    name: "Final inspections and closeout",
    description: () => "Final trade inspections, energy compliance verification, punch list, and Use and Occupancy certificate.",
    inspectionHoldPoints: ["Final electrical/plumbing/mechanical/sprinkler inspections", "Use and Occupancy issuance"]
  }
];

export function buildStatementOfWork(
  constructionSystem: ConstructionSystem,
  generatedAt = new Date().toISOString()
): StatementOfWorkReport {
  const config: RowhomeConfig = { ...defaultRowhomeConfig, constructionSystem };
  const model = generateRowhome(config);
  const system = constructionSystemOptions.find((option) => option.id === constructionSystem) ?? constructionSystemOptions[0];
  const roles = rolesForSystem(constructionSystem);

  const personnel: PersonnelRequirement[] = assignComponentsToRoles(model.components, roles).map((assignment) => ({
    roleId: assignment.role.id,
    title: assignment.role.title,
    scopeSummary: assignment.role.scopeSummary,
    skills: skillsForRole(assignment.role, constructionSystem),
    marylandCredential: assignment.role.marylandCredential,
    crewSize: assignment.role.crewSize,
    phases: assignment.role.phases,
    componentCount: assignment.components.length,
    estimatedMaterialCostUsd: Math.round(assignment.materialCostUsd)
  }));

  const phases: SowPhase[] = phaseDefinitions.map((definition) => ({
    sequence: definition.sequence,
    name: definition.name,
    description: definition.description(constructionSystem),
    personnel: roles.filter((role) => role.phases.includes(definition.sequence)).map((role) => role.title),
    inspectionHoldPoints: definition.inspectionHoldPoints
  }));

  const totalCost = Math.round(model.components.reduce((sum, component) => sum + component.metadata.estimatedCostUsd, 0));

  return {
    generatedAt,
    projectName: model.name,
    purpose:
      "Personnel-driven statement of work for constructing the modeled Baltimore R-8 rowhome: required roles, skills, Maryland credentials, crew sizes, phase staffing, and inspection hold points.",
    scopeBoundary:
      "Derived from the schematic source-traced model. Quantities and costs are rough-order estimates from model metadata, not bid documents. Credential names must be verified against current Maryland and Baltimore City requirements at the time of contracting.",
    constructionSystem: {
      id: system.id,
      label: system.label,
      notes: system.notes
    },
    designTeam,
    personnel,
    phases,
    totals: {
      componentCount: model.components.length,
      estimatedMaterialCostUsd: totalCost,
      typicalCrewHeadcount: personnel.reduce((sum, role) => sum + role.crewSize.typical, 0)
    },
    exclusions: [
      "Residential fire sprinkler geometry is required by Maryland law for new dwellings but is not yet modeled; the sprinkler fitter role is carried with no modeled quantity.",
      "Land acquisition, financing, insurance, bonds, permit fees, and utility connection charges.",
      "Hazardous material abatement and unforeseen existing-condition repairs.",
      "Construction labor cost; component estimates are material-basis rough-order values.",
      "Final professional design fees for the sealed permit set."
    ],
    sourceDocuments: [
      sources.r8,
      sources.residentialCode,
      sources.electricalCode,
      sources.plumbingCode,
      sources.permitDocuments,
      sources.naturalResources
    ]
  };
}

export function renderStatementOfWorkMarkdown(report: StatementOfWorkReport): string {
  const lines: string[] = [
    `# Statement of Work — ${report.projectName}`,
    "",
    `Construction system: **${report.constructionSystem.label}**`,
    "",
    report.constructionSystem.notes,
    "",
    `> ${report.scopeBoundary}`,
    "",
    "## Required Design Team",
    "",
    "| Role | Requirement | Seal required |",
    "| --- | --- | --- |",
    ...report.designTeam.map((member) => `| ${member.role} | ${member.requirement} | ${member.sealRequired ? "Yes" : "No"} |`),
    "",
    "## Required Personnel, Skills, and Credentials",
    ""
  ];
  for (const role of report.personnel) {
    lines.push(
      `### ${role.title}`,
      "",
      role.scopeSummary,
      "",
      `- Crew size: ${role.crewSize.typical} typical (${role.crewSize.minimum} minimum)`,
      `- Maryland credential: ${role.marylandCredential}`,
      `- Phases: ${role.phases.join(", ")}`,
      `- Modeled components: ${role.componentCount} ($${role.estimatedMaterialCostUsd.toLocaleString()} est. material)`,
      "",
      "Required skills:",
      ...role.skills.map((skill) => `- ${skill}`),
      ""
    );
  }
  lines.push("## Construction Phases and Inspection Hold Points", "");
  for (const phase of report.phases) {
    lines.push(`### Phase ${phase.sequence}: ${phase.name}`, "", phase.description, "", `Personnel: ${phase.personnel.join(", ")}`);
    if (phase.inspectionHoldPoints.length > 0) {
      lines.push("", "Inspection hold points:", ...phase.inspectionHoldPoints.map((point) => `- ${point}`));
    }
    lines.push("");
  }
  lines.push(
    "## Totals",
    "",
    `- Modeled components: ${report.totals.componentCount}`,
    `- Estimated material cost (rough order): $${report.totals.estimatedMaterialCostUsd.toLocaleString()}`,
    `- Typical combined crew headcount across roles: ${report.totals.typicalCrewHeadcount}`,
    "",
    "## Exclusions",
    "",
    ...report.exclusions.map((exclusion) => `- ${exclusion}`),
    "",
    "## Source Documents",
    "",
    ...report.sourceDocuments.map((doc) => `- ${doc}`),
    ""
  );
  return lines.join("\n");
}
