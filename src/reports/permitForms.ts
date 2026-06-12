import { defaultRowhomeConfig } from "../core/config";
import { generateRowhome } from "../generators/rowhome";
import { constructionSystemOptions } from "../core/constructionSystems";
import { buildElectricalLoadCalculation } from "../calculations/electricalLoad";
import { buildHvacSizingCalculation } from "../calculations/hvacSizing";
import { buildPlumbingFixtureUnitCalculation } from "../calculations/plumbingFixtureUnits";
import { buildInvestorDashboard } from "./investorDashboard";
import { panelSchedule } from "../generators/electrical";
import { sources } from "../core/sources";
import type { ConstructionSystem, RowhomeConfig } from "../core/types";

export type FormFieldSource = "model" | "owner" | "licensed-professional" | "portal-auto";

export interface FormField {
  label: string;
  value: string;
  source: FormFieldSource;
}

export interface FormSection {
  title: string;
  fields: FormField[];
}

export interface PermitForm {
  id: string;
  title: string;
  basis: string;
  submittedVia: string;
  notes: string[];
  sections: FormSection[];
}

export interface PermitFormsPackage {
  generatedAt: string;
  purpose: string;
  scopeBoundary: string;
  constructionSystem: { id: ConstructionSystem; label: string };
  forms: PermitForm[];
  totals: {
    formCount: number;
    fieldCount: number;
    modelFilledCount: number;
    ownerActionCount: number;
    licensedProfessionalCount: number;
    portalAutoCount: number;
  };
}

export const OWNER = "[OWNER TO PROVIDE]";
export const LICENSEE = "[LICENSED PROFESSIONAL TO PROVIDE]";
export const PORTAL = "[AUTO-FILLED BY EPERMITS FROM PARCEL RECORD — VERIFY]";

const EPERMITS = "Baltimore City DHCD ePermits portal (online application; no paper form exists for this step)";

function field(label: string, value: string, source: FormFieldSource): FormField {
  return { label, value, source };
}

export function buildPermitFormsPackage(
  constructionSystem: ConstructionSystem = defaultRowhomeConfig.constructionSystem,
  generatedAt = new Date().toISOString()
): PermitFormsPackage {
  const config: RowhomeConfig = { ...defaultRowhomeConfig, constructionSystem, rowhomeCount: 1, urbanScale: "single" };
  const model = generateRowhome(config);
  const system = constructionSystemOptions.find((option) => option.id === constructionSystem) ?? constructionSystemOptions[0];
  const electrical = buildElectricalLoadCalculation(model, config);
  const hvac = buildHvacSizingCalculation(model, config);
  const plumbing = buildPlumbingFixtureUnitCalculation(model);
  const dashboard = buildInvestorDashboard(config, generatedAt, model);

  const finishedAreaSf = config.stories * config.buildingWidthFt * config.buildingDepthFt;
  const basementAreaSf = config.includeBasement ? config.buildingWidthFt * config.buildingDepthFt : 0;
  const buildingHeightFt = config.stories * config.storyHeightFt;
  const hardCostUsd = dashboard.perHome.materialCostUsd + dashboard.perHome.laborCostUsd;
  const constructionType =
    constructionSystem === "steel-concrete"
      ? "II-B (noncombustible steel frame + concrete) — confirm with architect of record"
      : "V-B (combustible wood framing with masonry party walls) — confirm with architect of record";
  const workDescription =
    `New construction of one three-story single-family attached rowhouse with basement on an R-8 lot: ` +
    `${system.label.toLowerCase()} structure, all-electric service (no gas), heat pump HVAC, heat pump water heater, ` +
    `rooftop solar PV with battery storage, residential fire sprinkler per IRC P2904, rear egress and fire escape, ` +
    `roof garden allowance, and street tree.`;

  const forms: PermitForm[] = [
    {
      id: "form-01-combo-permit-application",
      title: "One and Two Family Combo Permit Application — New Construction",
      basis: "sources/dhcd-epermits-one-two-family-combo-new-construction-guide.pdf",
      submittedVia: EPERMITS,
      notes: [
        "Field order mirrors the ePermits application screens so values can be transcribed directly.",
        "Owner identity and parcel fields auto-populate in the portal from the address search; verify the record owner."
      ],
      sections: [
        {
          title: "Work Site Information",
          fields: [
            field("Street #", OWNER, "owner"),
            field("Street name", `${OWNER} — candidate corridor: East 25th Street, Baltimore, MD 21218`, "owner"),
            field("Parcel and legal owner of record", PORTAL, "portal-auto")
          ]
        },
        {
          title: "Project Information",
          fields: [
            field("Project name", "R-8 Rowhome New Construction (source-traced concept model)", "model"),
            field("Detailed description of work", workDescription, "model"),
            field("Type of work", "New Construction", "model"),
            field("Building type", "One-family dwelling — attached rowhouse", "model"),
            field("Other permits pending for this property", `No (verify) — ${OWNER}`, "owner")
          ]
        },
        {
          title: "Project Details and Acknowledgements",
          fields: [
            field("Lead paint notification acknowledgement", `${OWNER} (new construction; acknowledge in portal)`, "owner"),
            field("Affordable housing question", OWNER, "owner"),
            field("Reasonable accommodations question", OWNER, "owner")
          ]
        },
        {
          title: "Residential Detail",
          fields: [
            field("Dwelling units", "1", "model"),
            field("Stories above grade", String(config.stories), "model"),
            field("Basement", config.includeBasement ? `Yes — ${config.basementDepthFt} ft depth` : "No", "model"),
            field("Finished floor area", `${finishedAreaSf} sq ft`, "model"),
            field("Basement area", `${basementAreaSf} sq ft`, "model"),
            field("Building footprint", `${config.buildingWidthFt} ft x ${config.buildingDepthFt} ft`, "model"),
            field("Building height", `${buildingHeightFt} ft`, "model"),
            field("Construction type", constructionType, "model"),
            field("Heating fuel", "Electric (all-electric dwelling; no gas service or gas appliances)", "model"),
            field("Water service", `Public (verify) — ${OWNER}`, "owner"),
            field("Sanitary sewer", `Public (verify) — ${OWNER}`, "owner")
          ]
        },
        {
          title: "Zoning Information",
          fields: [
            field("Zoning district", `R-8 Rowhouse and Multi-Family Residential (${sources.r8}) — ${PORTAL}`, "portal-auto"),
            field("Proposed use", "Single-family attached rowhouse dwelling", "model"),
            field("Historic district / overlay questions", `${OWNER} (verify CHAP and overlay status for the parcel)`, "owner")
          ]
        },
        {
          title: "Fire Protection",
          fields: [
            field("Residential fire sprinkler required", "Yes — Maryland requires sprinklers in all new dwellings (IRC P2904 basis)", "model"),
            field("Sprinkler system type and design", `${LICENSEE} (State Fire Marshal licensed fire protection contractor; not yet modeled)`, "licensed-professional")
          ]
        },
        {
          title: "Estimated Cost of Construction",
          fields: [
            field(
              "Estimated cost (hard cost basis)",
              `$${hardCostUsd.toLocaleString()} (rough-order model estimate: materials $${dashboard.perHome.materialCostUsd.toLocaleString()} + labor $${dashboard.perHome.laborCostUsd.toLocaleString()}; permit fees are valuation-based — confirm final figure with contractor)`,
              "model"
            )
          ]
        },
        {
          title: "Licensed Professionals on the Permit",
          fields: [
            field("General contractor (Maryland Home Builder Registration)", LICENSEE, "licensed-professional"),
            field("Master electrician (Maryland license + Baltimore City registration)", LICENSEE, "licensed-professional"),
            field("Master plumber (Maryland license + Baltimore City registration)", LICENSEE, "licensed-professional"),
            field("Master HVACR (Maryland license + Baltimore City registration)", LICENSEE, "licensed-professional"),
            field("Fire protection contractor (State Fire Marshal license)", LICENSEE, "licensed-professional")
          ]
        }
      ]
    },
    {
      id: "form-02-electrical-detail",
      title: "Electrical Detail Worksheet",
      basis: "sources/dhcd-document-requirements-by-trade-2026-04.pdf",
      submittedVia: EPERMITS,
      notes: [
        "Connected load and circuit schedule come from the model's verified-connectivity electrical system.",
        "The NEC load calculation of record must be produced by the master electrician; model values are preliminary."
      ],
      sections: [
        {
          title: "Service",
          fields: [
            field("Service voltage", `${electrical.serviceVoltage} V single phase`, "model"),
            field("Service size", "200 A main-breaker load center (all-electric service)", "model"),
            field("Preliminary connected load", `${electrical.totalConnectedVoltAmps.toLocaleString()} VA (preliminary, not for permit)`, "model"),
            field("Recommended service per preliminary calc", `${electrical.recommendedServiceAmps} A`, "model"),
            field("Dwelling area used in calc", `${electrical.dwellingAreaSqFt} sq ft`, "model")
          ]
        },
        {
          title: "Branch Circuit Schedule (modeled)",
          fields: panelSchedule.map((entry) =>
            field(
              entry.description,
              `${entry.breakerAmps} A, ${entry.poles}-pole, ${entry.voltage} V, #${entry.conductorAwg || "service"} AWG Cu`,
              "model"
            )
          )
        },
        {
          title: "Special Systems",
          fields: [
            field("Rooftop PV + battery storage", "Yes — hybrid inverter with lithium-ion storage; interconnection on 40 A 2-pole breaker", "model"),
            field("240 V range circuit", "Yes — 50 A, #6 AWG Cu, accessible kitchen receptacle", "model")
          ]
        },
        {
          title: "Licensed Electrician",
          fields: [
            field("Master electrician name and Maryland license #", LICENSEE, "licensed-professional"),
            field("Baltimore City registration #", LICENSEE, "licensed-professional"),
            field("NEC load calculation of record", `${LICENSEE} (Article 220)`, "licensed-professional")
          ]
        }
      ]
    },
    {
      id: "form-03-plumbing-detail",
      title: "Plumbing Detail Worksheet",
      basis: "sources/dhcd-document-requirements-by-trade-2026-04.pdf",
      submittedVia: EPERMITS,
      notes: ["Fixture counts and fixture units derive from the generated model; sizing design of record requires the master plumber."],
      sections: [
        {
          title: "Fixtures and Loads",
          fields: [
            field("Total plumbing fixtures", String(plumbing.fixtureCount), "model"),
            field("Water supply fixture units (WSFU)", String(plumbing.waterSupplyFixtureUnits), "model"),
            field("Drainage fixture units (DFU)", String(plumbing.drainageFixtureUnits), "model"),
            field("Hot water fixtures", String(plumbing.hotWaterFixtureCount), "model"),
            field("Water heater", "Electric heat pump water heater (no gas)", "model"),
            field("DWV material", "PVC DWV with vent and storm leader per model", "model")
          ]
        },
        {
          title: "Service Sizing (design of record)",
          fields: [
            field("Water service size", LICENSEE, "licensed-professional"),
            field("Sewer connection and slope", LICENSEE, "licensed-professional"),
            field("Backflow prevention", LICENSEE, "licensed-professional")
          ]
        },
        {
          title: "Licensed Plumber",
          fields: [
            field("Master plumber name and Maryland license #", LICENSEE, "licensed-professional"),
            field("Baltimore City registration #", LICENSEE, "licensed-professional")
          ]
        }
      ]
    },
    {
      id: "form-04-mechanical-detail",
      title: "Mechanical (HVAC) Detail Worksheet",
      basis: "sources/dhcd-document-requirements-by-trade-2026-04.pdf",
      submittedVia: EPERMITS,
      notes: ["Duct topology is connectivity- and conservation-verified in the model; Manual J/S/D of record requires the licensed designer."],
      sections: [
        {
          title: "Equipment and Loads",
          fields: [
            field("Heating/cooling system", "Air-source heat pump with electric air handler (all-electric)", "model"),
            field("Conditioned area", `${hvac.conditionedAreaSqFt} sq ft`, "model"),
            field("Preliminary cooling load", `${hvac.coolingBtuh.toLocaleString()} BTU/h (${hvac.coolingTons} tons; preliminary, not Manual J)`, "model"),
            field("Design supply airflow", `${hvac.modeledSupplyCfm} CFM supply / ${hvac.modeledReturnCfm} CFM return, balanced per floor`, "model"),
            field("Ventilation/exhaust", "Bathroom exhaust to roof termination; kitchen range hood to rear wall termination", "model"),
            field("Supplemental heat", "Floor-independent electric heating terminals on every floor", "model")
          ]
        },
        {
          title: "Design of Record",
          fields: [
            field("Manual J / S / D (or local equivalent)", LICENSEE, "licensed-professional"),
            field("Equipment selection and refrigerant charge", `${LICENSEE} (EPA 608 certified technician)`, "licensed-professional")
          ]
        },
        {
          title: "Licensed HVACR Contractor",
          fields: [
            field("Master HVACR name and Maryland license #", LICENSEE, "licensed-professional"),
            field("Baltimore City registration #", LICENSEE, "licensed-professional")
          ]
        }
      ]
    },
    {
      id: "form-05-fire-sprinkler",
      title: "Residential Fire Sprinkler Worksheet",
      basis: sources.residentialCode,
      submittedVia: EPERMITS,
      notes: [
        "Maryland requires residential sprinklers in all new dwellings; this system is required scope and is not yet modeled in geometry.",
        "All design fields are the licensed fire protection contractor's responsibility."
      ],
      sections: [
        {
          title: "Requirement",
          fields: [
            field("Sprinkler system required", "Yes — new single-family dwelling in Maryland (IRC P2904 basis)", "model"),
            field("Water supply source", `${OWNER} (public service expected; confirm meter and pressure)`, "owner")
          ]
        },
        {
          title: "System Design (design of record)",
          fields: [
            field("System type (P2904 multipurpose or NFPA 13D)", LICENSEE, "licensed-professional"),
            field("Hydraulic calculation and head layout", LICENSEE, "licensed-professional"),
            field("Hydrostatic test", LICENSEE, "licensed-professional"),
            field("Fire protection contractor and State Fire Marshal license #", LICENSEE, "licensed-professional")
          ]
        }
      ]
    },
    {
      id: "form-06-use-and-occupancy",
      title: "Use and Occupancy Permit Application",
      basis: "sources/dhcd-detailed-use-and-occupancy-permit-instructions-2025-12.pdf",
      submittedVia: EPERMITS,
      notes: ["Filed after construction; listed now so the package is complete end to end."],
      sections: [
        {
          title: "Application",
          fields: [
            field("Property address", OWNER, "owner"),
            field("Proposed use", "Single-family dwelling — attached rowhouse", "model"),
            field("Dwelling units", "1", "model"),
            field("Zoning district", "R-8 (verify parcel record)", "portal-auto"),
            field("Prior use", `${OWNER} (vacant lot / prior structure)`, "owner"),
            field("Applicant name and contact", OWNER, "owner")
          ]
        }
      ]
    },
    {
      id: "form-07-eplans-submission-checklist",
      title: "ePlans Drawing Submission Checklist",
      basis: "sources/dhcd-eplans-submission-matrix-2026-01-26.pdf",
      submittedVia: "Baltimore City DHCD ePlans (drawing upload follows the permit application)",
      notes: ["Model artifacts are design inputs for the professionals; every sealed document remains their responsibility."],
      sections: [
        {
          title: "Required Drawing Set",
          fields: [
            field("Sealed architectural set (plans, elevations, sections, life safety)", `${LICENSEE} — model input: artifacts/construction-documents/`, "licensed-professional"),
            field("Sealed structural drawings and calculations", `${LICENSEE} — model input: artifacts/structural-gravity/`, "licensed-professional"),
            field("Electrical design and panel schedule", `${LICENSEE} — model input: artifacts/electrical-circuits/`, "licensed-professional"),
            field("Mechanical design", `${LICENSEE} — model input: artifacts/hvac-flow/`, "licensed-professional"),
            field("Plumbing riser and sizing", `${LICENSEE} — model input: artifacts/plumbing-fluid/`, "licensed-professional"),
            field("Energy code compliance documentation", LICENSEE, "licensed-professional"),
            field("Site / erosion and sediment control documents", `${LICENSEE} (where disturbance thresholds apply)`, "licensed-professional"),
            field("File naming per submission matrix", `${OWNER} (follow sources/dhcd-eplans-submission-matrix-2026-01-26.pdf)`, "owner")
          ]
        }
      ]
    },
    {
      id: "form-08-licensed-professional-registration",
      title: "Licensed Professional Registration Worksheet",
      basis: "sources/dhcd-epermits-renew-registration-licensed-professionals-2026-03-18.pdf",
      submittedVia: EPERMITS,
      notes: ["Every professional must hold a current Baltimore City ePermits registration before they can be added to the permit."],
      sections: [
        {
          title: "Registrations to Verify or Renew",
          fields: [
            field("General contractor — Maryland Home Builder Registration #", LICENSEE, "licensed-professional"),
            field("Master electrician — license # and city registration", LICENSEE, "licensed-professional"),
            field("Master plumber — license # and city registration", LICENSEE, "licensed-professional"),
            field("Master HVACR — license # and city registration", LICENSEE, "licensed-professional"),
            field("Fire protection contractor — State Fire Marshal license #", LICENSEE, "licensed-professional"),
            field("Architect of record — Maryland license #", LICENSEE, "licensed-professional"),
            field("Structural engineer of record — Maryland PE #", LICENSEE, "licensed-professional")
          ]
        }
      ]
    }
  ];

  const allFields = forms.flatMap((form) => form.sections.flatMap((section) => section.fields));
  return {
    generatedAt,
    purpose:
      "Filled permit application worksheets for the Baltimore City DHCD ePermits new-construction path, mirroring the portal screens so values can be transcribed directly.",
    scopeBoundary:
      "Baltimore City accepts these applications only through the ePermits portal; no standalone fillable PDFs exist for this path. Every value the model can supply is filled in; fields marked for the owner or a licensed professional are genuinely theirs to complete and none of this is a submitted application or approval.",
    constructionSystem: { id: system.id, label: system.label },
    forms,
    totals: {
      formCount: forms.length,
      fieldCount: allFields.length,
      modelFilledCount: allFields.filter((entry) => entry.source === "model").length,
      ownerActionCount: allFields.filter((entry) => entry.source === "owner").length,
      licensedProfessionalCount: allFields.filter((entry) => entry.source === "licensed-professional").length,
      portalAutoCount: allFields.filter((entry) => entry.source === "portal-auto").length
    }
  };
}

const sourceBadge: Record<FormFieldSource, string> = {
  model: "FILLED FROM MODEL",
  owner: "OWNER ACTION",
  "licensed-professional": "LICENSED PROFESSIONAL",
  "portal-auto": "PORTAL AUTO-FILL"
};

export function renderPermitFormMarkdown(form: PermitForm, pkg: PermitFormsPackage): string {
  const lines: string[] = [
    `# ${form.title}`,
    "",
    `Construction system: ${pkg.constructionSystem.label}`,
    "",
    `Submitted via: ${form.submittedVia}`,
    "",
    `Basis: \`${form.basis}\``,
    ""
  ];
  for (const note of form.notes) {
    lines.push(`> ${note}`, "");
  }
  for (const section of form.sections) {
    lines.push(`## ${section.title}`, "", "| Field | Value | Status |", "| --- | --- | --- |");
    for (const entry of section.fields) {
      lines.push(`| ${entry.label} | ${entry.value} | ${sourceBadge[entry.source]} |`);
    }
    lines.push("");
  }
  lines.push("---", "", `Generated ${pkg.generatedAt}. ${pkg.scopeBoundary}`, "");
  return lines.join("\n");
}
