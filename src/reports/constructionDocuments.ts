import { buildBom, totalEstimatedCost } from "../export/bom";
import { buildBuildabilityReadiness } from "../buildability/readiness";
import { defaultRowhomeConfig } from "../core/config";
import type { ComponentCategory, ModelComponent, RowhomeConfig, RowhomeModel } from "../core/types";
import { generateRowhome } from "../generators/rowhome";

export interface ConstructionSheet {
  id: string;
  discipline: "general" | "architectural" | "structural" | "mechanical" | "electrical" | "plumbing";
  title: string;
  modelSupported: boolean;
  sourceComponentIds: string[];
  missingInputs: string[];
}

export interface DoorScheduleRow {
  id: string;
  name: string;
  type: "front-entry" | "rear-egress" | "roof-access" | "bath-privacy";
  level: string;
  egress: boolean;
  modeledAsHingedDoor: boolean;
  remainingRequirements: string[];
}

export interface WindowScheduleRow {
  id: string;
  name: string;
  level: string;
  type: "front-sash" | "transom";
  remainingRequirements: string[];
}

export interface MaterialScheduleRow {
  category: ComponentCategory;
  material: string;
  componentCount: number;
  estimatedCostUsd: number;
  quantity?: {
    kind: string;
    count: number;
    unit: string;
  };
}

export interface ProductScheduleRow {
  componentId: string;
  brand: string;
  productName: string;
  articleNumber?: string;
  source: string;
  verificationRequired: boolean;
}

export interface ConstructionDocumentPreflightReport {
  generatedAt: string;
  status: "preflight-not-construction-documents";
  purpose: string;
  buildTomorrowReady: false;
  modelSummary: {
    componentCount: number;
    categoryCounts: Record<string, number>;
    totalEstimatedCostUsd: number;
  };
  sheetIndex: ConstructionSheet[];
  schedules: {
    doors: DoorScheduleRow[];
    windows: WindowScheduleRow[];
    materials: MaterialScheduleRow[];
    products: ProductScheduleRow[];
  };
  coordinationChecks: {
    allComponentsSourceTraced: boolean;
    uniqueComponentIds: boolean;
    hasArchitecturalPermitIndex: boolean;
    hasStructuralLogicPlaceholders: boolean;
    hasMepPreflightModels: boolean;
    hasModeledRoofDrainage: boolean;
    hasExteriorEgressDoors: boolean;
  };
  remainingTechnicalBlockers: string[];
  permitReadinessStatus: string;
}

function levelFromId(id: string): string {
  const rear = id.match(/rear-exit-door-(\d+)/);
  if (rear) {
    return `floor-${rear[1]}`;
  }
  const bath = id.match(/bath-(\d+)-door/);
  if (bath) {
    return `floor-${bath[1]}`;
  }
  const frontWindow = id.match(/front-window-(?:left|right)-(\d+)/);
  if (frontWindow) {
    return `floor-${frontWindow[1]}`;
  }
  if (id.includes("roof")) {
    return "roof";
  }
  return "floor-1";
}

function doorType(id: string): DoorScheduleRow["type"] {
  if (id.startsWith("rear-exit-door")) {
    return "rear-egress";
  }
  if (id === "architect-roof-access-rated-door") {
    return "roof-access";
  }
  if (id.startsWith("bath-")) {
    return "bath-privacy";
  }
  return "front-entry";
}

function doorSchedule(components: ModelComponent[]): DoorScheduleRow[] {
  return components
    .filter((component) =>
      component.metadata.id === "front-door"
      || /^rear-exit-door-\d+$/.test(component.metadata.id)
      || component.metadata.id === "architect-roof-access-rated-door"
      || /^bath-\d+-door$/.test(component.metadata.id)
    )
    .map((component) => {
      const type = doorType(component.metadata.id);
      return {
        id: component.metadata.id,
        name: component.metadata.name,
        type,
        level: levelFromId(component.metadata.id),
        egress: type === "front-entry" || type === "rear-egress" || type === "roof-access",
        modeledAsHingedDoor: component.object.userData.interactionClass === "hinged-door" || type === "bath-privacy",
        remainingRequirements: [
          "dimensioned rough opening",
          "manufacturer and listing",
          "hardware set",
          "threshold/flashing detail",
          type === "bath-privacy" ? "privacy hardware and clearance verification" : "egress clear-opening and latch verification"
        ]
      };
    });
}

function windowSchedule(components: ModelComponent[]): WindowScheduleRow[] {
  return components
    .filter((component) => /^front-window-(?:left|right)-\d+$/.test(component.metadata.id) || component.metadata.id === "transom-window")
    .map((component) => ({
      id: component.metadata.id,
      name: component.metadata.name,
      level: levelFromId(component.metadata.id),
      type: component.metadata.id === "transom-window" ? "transom" : "front-sash",
      remainingRequirements: [
        "dimensioned rough opening",
        "manufacturer and performance data",
        "flashing and air/water barrier integration",
        "egress/safety glazing verification where applicable"
      ]
    }));
}

function productSchedule(components: ModelComponent[]): ProductScheduleRow[] {
  return components
    .filter((component) => Boolean(component.metadata.realProductModel))
    .map((component) => {
      const product = component.metadata.realProductModel!;
      return {
        componentId: component.metadata.id,
        brand: product.brand,
        productName: product.productName,
        articleNumber: product.articleNumber,
        source: product.source,
        verificationRequired: true
      };
    });
}

function categoryCounts(components: ModelComponent[]): Record<string, number> {
  return components.reduce<Record<string, number>>((counts, component) => {
    counts[component.metadata.category] = (counts[component.metadata.category] ?? 0) + 1;
    return counts;
  }, {});
}

function duplicateIds(components: ModelComponent[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const component of components) {
    if (seen.has(component.metadata.id)) {
      duplicates.add(component.metadata.id);
    }
    seen.add(component.metadata.id);
  }
  return [...duplicates];
}

function sheet(id: ConstructionSheet["id"], discipline: ConstructionSheet["discipline"], title: string, sourceComponentIds: string[], missingInputs: string[]): ConstructionSheet {
  return {
    id,
    discipline,
    title,
    modelSupported: sourceComponentIds.length > 0,
    sourceComponentIds,
    missingInputs
  };
}

function buildSheetIndex(model: RowhomeModel): ConstructionSheet[] {
  const ids = new Set(model.components.map((component) => component.metadata.id));
  const has = (...componentIds: string[]) => componentIds.filter((id) => ids.has(id));
  return [
    sheet("G001", "general", "Code basis, drawing index, and project notes", has("architect-code-basis-and-zoning-matrix", "architect-permit-document-index"), ["project address", "zoning confirmation", "code edition confirmation"]),
    sheet("A001", "architectural", "Life safety, egress, and accessibility coordination", has("architect-egress-life-safety-path", "front-door", "rear-exit-door-1", "fire-escape-yard-landing"), ["dimensioned travel distances", "door clear widths", "final occupancy/code analysis"]),
    sheet("A101", "architectural", "Basement and first-floor plan", has("basement-slab", "floor-plate-1", "front-door", "rear-exit-door-1"), ["dimensioned room layout", "partition dimensions", "finish tags"]),
    sheet("A102", "architectural", "Upper-floor plans", has("floor-plate-2", "floor-plate-3", "rear-exit-door-2", "rear-exit-door-3"), ["dimensioned room layout", "bathroom dimensions", "door/window tags"]),
    sheet("A103", "architectural", "Roof plan and roof access details", has("roof-deck", "architect-roof-access-rated-door", "roof-drain-strainer", "roof-overflow-scupper-rear-primary"), ["roof slope dimensions", "membrane manufacturer details", "drain and overflow sizing"]),
    sheet("A201", "architectural", "Exterior elevations", has("front-facade", "rear-wall-lower-left", "front-window-left-1", "front-window-right-1"), ["dimensioned elevation datums", "finish schedule", "window/door tags"]),
    sheet("A301", "architectural", "Stair, guard, roof-opening, and waterproofing sections", has("roof-stair-opening-curb-front", "roof-stair-opening-guard-front", "architect-roof-threshold-transition"), ["stair dimensions", "guard attachment details", "rated assembly listing"]),
    sheet("S001", "structural", "Structural notes, loading, and design criteria", has("structural-code-basis-and-load-schedule", "structural-signed-sealed-drawing-placeholder"), ["load combinations", "material strengths", "site class and soil data"]),
    sheet("S101", "structural", "Foundation and gravity load path plan", has("foundation-slab", "stair-shaft-bearing-pad-front-left", "party-wall-left"), ["foundation sizing", "bearing capacity", "underpinning/shoring design"]),
    sheet("S201", "structural", "Stair opening framing and diaphragm collectors", has("roof-stair-opening-front-header", "floor-1-stair-opening-front-header", "stair-shaft-continuous-load-post-front-left"), ["member sizing", "connection schedule", "fastener schedule"]),
    sheet("M101", "mechanical", "Central AC equipment and duct airflow plan", has("central-ac-condenser", "air-handler", "supply-plenum", "return-plenum"), ["Manual J", "Manual S", "Manual D", "static pressure calculation"]),
    sheet("E101", "electrical", "Electrical service, panel, lighting, PV, and equipment circuits", has("electrical-panel", "central-ac-condenser-branch-circuit", "roof-solar-panel-1", "battery-storage"), ["panel schedule", "load calculation", "PV/battery interconnection details"]),
    sheet("P101", "plumbing", "Plumbing supply, DWV, vent, condensate, and storm drainage", has("water-service-lateral", "sanitary-building-drain", "vent-stack-through-roof", "roof-drain-leader"), ["pipe sizing", "cleanout locations", "fixture schedule", "storm discharge approval"])
  ];
}

export function buildConstructionDocumentPreflightReport(
  generatedAt = new Date().toISOString(),
  model: RowhomeModel = generateRowhome(defaultRowhomeConfig),
  config: RowhomeConfig = defaultRowhomeConfig
): ConstructionDocumentPreflightReport {
  const ids = new Set(model.components.map((component) => component.metadata.id));
  const buildability = buildBuildabilityReadiness(model);
  const materials = buildBom(model).map<MaterialScheduleRow>((line) => ({
    category: line.category,
    material: line.material,
    componentCount: line.components,
    estimatedCostUsd: line.estimatedCostUsd,
    quantity: line.quantity
  }));

  return {
    generatedAt,
    status: "preflight-not-construction-documents",
    purpose: "Automated construction-document preflight package: sheet index, schedules, coordination checks, and remaining technical blockers. This is not a permit set or construction authorization.",
    buildTomorrowReady: false,
    modelSummary: {
      componentCount: model.components.length,
      categoryCounts: categoryCounts(model.components),
      totalEstimatedCostUsd: totalEstimatedCost(model)
    },
    sheetIndex: buildSheetIndex(model),
    schedules: {
      doors: doorSchedule(model.components),
      windows: windowSchedule(model.components),
      materials,
      products: productSchedule(model.components)
    },
    coordinationChecks: {
      allComponentsSourceTraced: model.components.every((component) => component.metadata.source.length > 0),
      uniqueComponentIds: duplicateIds(model.components).length === 0,
      hasArchitecturalPermitIndex: ids.has("architect-permit-document-index"),
      hasStructuralLogicPlaceholders: ids.has("structural-code-basis-and-load-schedule") && ids.has("structural-signed-sealed-drawing-placeholder"),
      hasMepPreflightModels: ids.has("air-handler") && ids.has("electrical-panel") && ids.has("water-service-lateral"),
      hasModeledRoofDrainage: ids.has("roof-drain-strainer") && ids.has("roof-overflow-scupper-rear-primary"),
      hasExteriorEgressDoors: ["front-door", "rear-exit-door-1", "rear-exit-door-2", "rear-exit-door-3"].every((id) => ids.has(id))
    },
    remainingTechnicalBlockers: [
      "dimensioned construction drawings",
      "sealed structural calculations and member schedules",
      "site/foundation/geotechnical design",
      "Manual J/S/D and installable MEP design",
      "BIM-grade clash coordination and trade routing",
      "product specifications, rated assemblies, and submittal requirements",
      "construction sequence, temporary works, and safety plan",
      "discipline certifications and permit approvals"
    ],
    permitReadinessStatus: buildability.status
  };
}
