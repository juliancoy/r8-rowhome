import { sources } from "../core/sources";
import type {
  RowhomeConfig,
  StructuralAreaLoad,
  StructuralDemandSurface,
  StructuralDesignCheck,
  StructuralLoadCase,
  StructuralLoadCombination,
  StructuralMaterial,
  StructuralMember,
  StructuralModel,
  StructuralNode,
  StructuralSection,
  StructuralSupport
} from "../core/types";
import { steelSupportGrid } from "../generators/steelSupport";
import { selectedConstructionSystem } from "../core/constructionSystems";

const floorLiveLoadPsf = 40;
const roofLiveLoadPsf = 20;
const roofGardenSaturatedDeadLoadPsf = 35;
const facadeSurfaceDeadLoadPsf = 45;
const steelSupportAllowanceKips = 18;

function round(value: number, places = 3): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function fixedSupport(nodeId: string): StructuralSupport {
  return {
    nodeId,
    restraint: { x: true, y: true, z: true, rx: true, ry: true, rz: true },
    source: sources.residentialCode
  };
}

function loadKips(areaSqFt: number, loadPsf: number): number {
  return round((areaSqFt * loadPsf) / 1000);
}

function demandPsf(demandKips: number, areaSqFt: number): number {
  return round((demandKips * 1000) / Math.max(1, areaSqFt), 1);
}

function cumulativeHeightFactor(zMidFt: number, buildingHeightFt: number): number {
  return Math.max(0, Math.min(1, (buildingHeightFt - zMidFt) / Math.max(1, buildingHeightFt)));
}

function stairOpeningArea(config: RowhomeConfig): number {
  if (config.stairImplementation === "spiral") {
    return 6.4 * 6.4;
  }
  return 4.3 * 29.0;
}

function stairOpeningBounds(config: RowhomeConfig): { xMin: number; xMax: number; yMin: number; yMax: number } {
  if (config.stairImplementation === "spiral") {
    const centerX = 4.1;
    const centerY = 8.0;
    const half = 3.2;
    return { xMin: centerX - half, xMax: centerX + half, yMin: centerY - half, yMax: centerY + half };
  }
  return { xMin: 0.85, xMax: 5.15, yMin: 6.2, yMax: 35.2 };
}

function addNode(nodes: StructuralNode[], id: string, xFt: number, yFt: number, zFt: number): void {
  nodes.push({ id, xFt: round(xFt), yFt: round(yFt), zFt: round(zFt) });
}

function addMember(
  members: StructuralMember[],
  member: Omit<StructuralMember, "source">
): void {
  members.push({ ...member, source: sources.residentialCode });
}

function buildLoadCombinations(
  floorDeadKips: number,
  roofDeadKips: number,
  wallDeadLoadKips: number,
  steelSupportDeadLoadKips: number,
  floorLiveKips: number,
  roofLiveKips: number
): StructuralLoadCombination[] {
  const deadKips = round(floorDeadKips + roofDeadKips + wallDeadLoadKips + steelSupportDeadLoadKips);
  const combinations: StructuralLoadCombination[] = [
    {
      id: "service-dead",
      name: "Service dead load",
      method: "service",
      expression: "1.0D",
      totalKips: deadKips,
      status: "computed-gravity-only",
      source: sources.residentialCode,
      notes: ["Includes floor, roof, wall, and selected steel support self-weight allowances."]
    },
    {
      id: "service-floor-live",
      name: "Service floor gravity",
      method: "service",
      expression: "1.0D + 1.0L",
      totalKips: round(deadKips + floorLiveKips),
      status: "computed-gravity-only",
      source: sources.residentialCode,
      notes: ["Conceptual floor live load included; roof live or snow allowance excluded."]
    },
    {
      id: "service-roof-live",
      name: "Service roof gravity",
      method: "service",
      expression: "1.0D + 1.0Lr",
      totalKips: round(deadKips + roofLiveKips),
      status: "computed-gravity-only",
      source: sources.residentialCode,
      notes: ["Conceptual roof live or snow allowance included; floor live load excluded."]
    },
    {
      id: "strength-floor-live",
      name: "Strength floor gravity",
      method: "strength",
      expression: "1.2D + 1.6L",
      totalKips: round(deadKips * 1.2 + floorLiveKips * 1.6),
      status: "computed-gravity-only",
      source: sources.residentialCode,
      notes: ["Preliminary gravity-only strength combination for member sizing workflow."]
    },
    {
      id: "strength-roof-live",
      name: "Strength roof gravity",
      method: "strength",
      expression: "1.2D + 1.6Lr",
      totalKips: round(deadKips * 1.2 + roofLiveKips * 1.6),
      status: "computed-gravity-only",
      source: sources.residentialCode,
      notes: ["Preliminary gravity-only roof strength combination for member sizing workflow."]
    },
    {
      id: "lateral-required",
      name: "Wind and seismic required",
      method: "strength",
      expression: "D, L, Lr, W, and E combinations required",
      totalKips: 0,
      status: "blocked-requires-lateral-model",
      source: sources.residentialCode,
      notes: ["Wind, seismic, diaphragm, collector, anchorage, and load-path data are not modeled yet."]
    }
  ];
  return combinations;
}

function buildDesignChecks(config: RowhomeConfig, members: StructuralMember[]): StructuralDesignCheck[] {
  const steelMemberIds = members
    .filter((member) => member.kind === "steel-column" || member.kind === "steel-beam")
    .map((member) => member.id);
  const checkTargets = {
    gravityMembers: members.filter((member) => member.kind !== "foundation-line").map((member) => member.id),
    supports: members.filter((member) => member.kind === "foundation-line").map((member) => member.id),
    steel: steelMemberIds
  };
  const stairOpeningMembers = members
    .filter((member) => member.kind === "stair-opening-header" || member.kind === "stair-shaft-post" || member.kind === "bearing-pad")
    .map((member) => member.id);
  const collectorMembers = members
    .filter((member) => member.kind === "diaphragm-collector")
    .map((member) => member.id);
  const checks: StructuralDesignCheck[] = [
    {
      id: "global-stability",
      label: "Global stability and load path",
      category: "stability",
      targetIds: checkTargets.gravityMembers,
      status: "blocked-requires-solver",
      source: sources.residentialCode,
      requirement: "Verify complete gravity and lateral load paths from roof/floors through supports to foundation.",
      missingInputs: ["solver reactions", "diaphragm/collector model", "lateral load model", "connection load paths"]
    },
    {
      id: "gravity-member-strength",
      label: "Gravity member strength",
      category: "strength",
      targetIds: checkTargets.gravityMembers,
      status: "blocked-requires-solver",
      source: sources.residentialCode,
      requirement: "Check axial, shear, and bending demands against selected member capacities.",
      missingInputs: ["member forces", "selected member sizes", "unbraced lengths", "capacity factors"]
    },
    {
      id: "floor-roof-deflection",
      label: "Floor and roof deflection",
      category: "serviceability",
      targetIds: members.filter((member) => member.kind === "floor-diaphragm" || member.kind === "roof-diaphragm").map((member) => member.id),
      status: "blocked-requires-solver",
      source: sources.residentialCode,
      requirement: "Check service-load deflections and vibration-sensitive spans.",
      missingInputs: ["member stiffness", "span continuity", "service load deflections", "deflection limits"]
    },
    {
      id: "foundation-bearing",
      label: "Foundation bearing and settlement",
      category: "foundation",
      targetIds: checkTargets.supports,
      status: "blocked-requires-design-input",
      source: sources.residentialCode,
      requirement: "Verify bearing pressure, footing size, settlement, basement wall lateral loads, and support reactions.",
      missingInputs: ["soil bearing capacity", "footing geometry", "support reactions", "basement lateral soil/water loads"]
    },
    {
      id: "wind-seismic-lateral",
      label: "Wind and seismic lateral system",
      category: "lateral",
      targetIds: checkTargets.gravityMembers,
      status: "blocked-requires-design-input",
      source: sources.residentialCode,
      requirement: "Model wind/seismic forces, diaphragms, collectors, shear walls/frames, anchorage, and overturning.",
      missingInputs: ["site wind speed", "exposure", "seismic parameters", "diaphragm stiffness", "anchorage details"]
    },
    {
      id: "stair-opening-load-path",
      label: "Stair opening load path",
      category: "connection",
      targetIds: stairOpeningMembers,
      status: "blocked-requires-solver",
      source: sources.residentialCode,
      requirement: "Verify headers, trimmers, post caps, post bases, bearing pads, and transferred reactions around the stair opening.",
      missingInputs: ["header reactions", "post axial forces", "hanger/connector schedule", "bearing stresses", "fastener edge distances"]
    },
    {
      id: "diaphragm-collector-continuity",
      label: "Diaphragm collector continuity",
      category: "lateral",
      targetIds: collectorMembers,
      status: "blocked-requires-design-input",
      source: sources.residentialCode,
      requirement: "Verify floor and roof diaphragm continuity around the stair opening with collectors, blocking, straps, and nailing schedules.",
      missingInputs: ["diaphragm shear demand", "chord/collector forces", "sheathing nailing", "strap schedule", "drag connection details"]
    },
    {
      id: "guard-attachment-loads",
      label: "Guard and handrail attachment loads",
      category: "connection",
      targetIds: ["roof-stair-opening-guard-front", "roof-stair-opening-guard-rear", "roof-stair-opening-guard-left"],
      status: "blocked-requires-design-input",
      source: sources.residentialCode,
      requirement: "Design guard post bases, blocking, anchors, corrosion protection, and waterproofed penetrations for required lateral and infill loads.",
      missingInputs: ["guard live load criteria", "post spacing", "base plate geometry", "blocking layout", "waterproofed penetration detail"]
    },
    {
      id: "roof-curb-uplift-waterproofing",
      label: "Roof curb uplift and waterproofing coordination",
      category: "connection",
      targetIds: ["roof-stair-opening-curb-front", "roof-stair-opening-flashing-front", "roof-stair-opening-uplift-strap-front"],
      status: "blocked-requires-design-input",
      source: sources.residentialCode,
      requirement: "Coordinate curb anchorage, wind uplift restraint, membrane terminations, counterflashing, drainage, and manufacturer-required heights.",
      missingInputs: ["wind uplift pressure", "curb attachment schedule", "roof membrane system", "counterflashing detail", "roof drainage design"]
    }
  ];

  if (steelMemberIds.length > 0) {
    checks.push(
      {
        id: "steel-column-buckling",
        label: "Steel column buckling",
        category: "strength",
        targetIds: checkTargets.steel,
        status: "blocked-requires-solver",
        source: sources.residentialCode,
        requirement: "Check compression, bending, combined interaction, effective length, and story stability.",
        missingInputs: ["selected HSS/W-shape sizes", "effective length factors", "member forces", "bracing conditions"]
      },
      {
        id: "steel-beam-ltb",
        label: "Steel beam flexure and lateral bracing",
        category: "strength",
        targetIds: checkTargets.steel,
        status: "blocked-requires-solver",
        source: sources.residentialCode,
        requirement: "Check bending, shear, bearing, lateral-torsional buckling, web crippling, and camber/deflection as applicable.",
        missingInputs: ["selected beam sizes", "unbraced lengths", "connection/bearing details", "member forces"]
      },
      {
        id: "steel-connections",
        label: "Steel connections and base plates",
        category: "connection",
        targetIds: checkTargets.steel,
        status: "blocked-requires-design-input",
        source: sources.residentialCode,
        requirement: "Design beam-column connections, base plates, anchors, bearing plates, and load transfer into existing masonry/foundations.",
        missingInputs: ["connection type", "anchor design", "base plate geometry", "existing masonry capacity", "erection constraints"]
      },
      {
        id: "steel-fire-protection",
        label: "Steel fire protection",
        category: "fire-protection",
        targetIds: checkTargets.steel,
        status: "blocked-requires-design-input",
        source: sources.residentialCode,
        requirement: "Coordinate required fire-resistance rating, encasement/intumescent protection, penetrations, and inspection requirements.",
        missingInputs: ["required rating", "approved fireproofing assembly", "exposure conditions", "inspection requirements"]
      }
    );
  }

  return checks;
}

export function buildStructuralModel(config: RowhomeConfig): StructuralModel {
  const constructionSystem = selectedConstructionSystem(config);
  const usesSteelSupport = config.structuralSupportScheme === "steel-post-beam" || constructionSystem.includesSteelFrame;
  const floorDeadLoadPsf = constructionSystem.structural.floorDeadLoadPsf;
  const roofDeadLoadPsf = constructionSystem.structural.roofDeadLoadPsf;
  const wallDensityPcf = constructionSystem.structural.wallDensityPcf;
  const wallMaterialId = constructionSystem.structural.wallMaterialId;
  const floorMaterialId = constructionSystem.structural.floorMaterialId;
  const framingMaterialId = constructionSystem.structural.framingMaterialId;
  const rowhomeCount = Math.max(1, Math.round(config.rowhomeCount || 1));
  const totalBuildingWidthFt = config.buildingWidthFt * rowhomeCount;
  const buildingHeight = config.stories * config.storyHeightFt;
  const basementZ = config.includeBasement ? -config.basementDepthFt : 0;
  const opening = stairOpeningBounds(config);
  const floorPlateAreaSqFt = round(Math.max(0, totalBuildingWidthFt * config.buildingDepthFt - stairOpeningArea(config) * rowhomeCount));
  const roofAreaSqFt = round(totalBuildingWidthFt * config.buildingDepthFt);
  const roofGardenAreaSqFt = round(Math.min(210, roofAreaSqFt * 0.25));
  const floorCount = config.stories;
  const totalFloorAreaSqFt = round(floorPlateAreaSqFt * floorCount);
  const partyWallVolumeCf = (rowhomeCount + 1) * 0.45 * config.buildingDepthFt * buildingHeight;
  const rearWallVolumeCf = 0.36 * totalBuildingWidthFt * buildingHeight;
  const wallDeadLoadKips = round(((partyWallVolumeCf + rearWallVolumeCf) * wallDensityPcf + totalBuildingWidthFt * buildingHeight * facadeSurfaceDeadLoadPsf) / 1000);
  const steelSupportDeadLoadKips = usesSteelSupport ? steelSupportAllowanceKips : 0;

  const nodes: StructuralNode[] = [];
  for (const [key, x, y] of [
    ["fl", 0, 0],
    ["fr", totalBuildingWidthFt, 0],
    ["rl", 0, config.buildingDepthFt],
    ["rr", totalBuildingWidthFt, config.buildingDepthFt]
  ] as const) {
    addNode(nodes, `${key}-foundation`, x, y, basementZ);
    for (let story = 0; story <= config.stories; story += 1) {
      addNode(nodes, `${key}-level-${story}`, x, y, story * config.storyHeightFt);
    }
  }
  for (let story = 0; story <= config.stories; story += 1) {
    addNode(nodes, `floor-${story}-centerline-left`, 0.45, config.buildingDepthFt / 2, story * config.storyHeightFt + 0.16);
    addNode(nodes, `floor-${story}-centerline-right`, totalBuildingWidthFt - 0.45, config.buildingDepthFt / 2, story * config.storyHeightFt + 0.16);
  }
  for (const [corner, x, y] of [
    ["front-left", opening.xMin + 0.22, opening.yMin + 0.22],
    ["front-right", opening.xMax - 0.22, opening.yMin + 0.22],
    ["rear-left", opening.xMin + 0.22, opening.yMax - 0.22],
    ["rear-right", opening.xMax - 0.22, opening.yMax - 0.22]
  ] as const) {
    addNode(nodes, `stair-shaft-${corner}-foundation`, x, y, basementZ);
    for (let story = 0; story <= config.stories; story += 1) {
      addNode(nodes, `stair-shaft-${corner}-level-${story}`, x, y, story * config.storyHeightFt);
    }
  }
  if (usesSteelSupport) {
    for (const point of steelSupportGrid) {
      addNode(nodes, `steel-${point.id}-foundation`, point.x, point.y, basementZ);
      for (let story = 0; story <= config.stories; story += 1) {
        addNode(nodes, `steel-${point.id}-level-${story}`, point.x, point.y, story * config.storyHeightFt);
      }
    }
  }

  const members: StructuralMember[] = [];
  for (const key of ["fl", "fr", "rl", "rr"] as const) {
    addMember(members, {
      id: `${key}-foundation-line`,
      name: `${key.toUpperCase()} basement-to-grade foundation line`,
      kind: "foundation-line",
      startNodeId: `${key}-foundation`,
      endNodeId: `${key}-level-0`,
      materialId: wallMaterialId === "masonry" ? "masonry" : "reinforced-concrete",
      sectionId: "foundation-wall-line",
      componentIds: ["basement-party-wall-left", "basement-party-wall-right", "basement-front-foundation-wall", "basement-rear-foundation-wall"]
    });
    for (let story = 0; story < config.stories; story += 1) {
      addMember(members, {
        id: `${key}-wall-line-${story + 1}`,
        name: `${key.toUpperCase()} wall load path story ${story + 1}`,
        kind: "wall-line",
        startNodeId: `${key}-level-${story}`,
        endNodeId: `${key}-level-${story + 1}`,
        materialId: wallMaterialId,
        sectionId: "masonry-wall-line",
        componentIds: ["party-wall-left", "party-wall-right", "rear-wall", "front-facade"]
      });
    }
  }
  for (let story = 0; story <= config.stories; story += 1) {
    addMember(members, {
      id: story === config.stories ? "roof-diaphragm" : `floor-${story + 1}-diaphragm`,
      name: story === config.stories ? "Roof gravity diaphragm" : `Floor ${story + 1} gravity diaphragm`,
      kind: story === config.stories ? "roof-diaphragm" : "floor-diaphragm",
      startNodeId: `floor-${story}-centerline-left`,
      endNodeId: `floor-${story}-centerline-right`,
      materialId: floorMaterialId,
      sectionId: "schematic-floor-diaphragm",
      componentIds: story === config.stories ? [`floor-plate-${story}`] : [`floor-plate-${story}`]
    });
  }
  for (const corner of ["front-left", "front-right", "rear-left", "rear-right"] as const) {
    addMember(members, {
      id: `stair-shaft-${corner}-bearing-pad`,
      name: `Stair shaft ${corner} foundation bearing pad`,
      kind: "bearing-pad",
      startNodeId: `stair-shaft-${corner}-foundation`,
      endNodeId: `stair-shaft-${corner}-level-0`,
      materialId: "reinforced-concrete",
      sectionId: "schematic-bearing-pad",
      componentIds: [`stair-shaft-bearing-pad-${corner}`, `stair-shaft-post-base-plate-${corner}`]
    });
    addMember(members, {
      id: `stair-shaft-${corner}-continuous-post`,
      name: `Stair shaft ${corner} continuous load-path post`,
      kind: "stair-shaft-post",
      startNodeId: `stair-shaft-${corner}-level-0`,
      endNodeId: `stair-shaft-${corner}-level-${config.stories}`,
      materialId: framingMaterialId,
      sectionId: "schematic-built-up-post",
      componentIds: [`stair-shaft-continuous-load-post-${corner}`, `stair-shaft-post-cap-plate-${corner}`]
    });
  }
  for (let level = 1; level <= config.stories; level += 1) {
    const idPrefix = level === config.stories ? "roof" : `floor-${level}`;
    for (const [edge, start, end, componentId] of [
      ["front", "front-left", "front-right", `${idPrefix}-stair-opening-front-header`],
      ["rear", "rear-left", "rear-right", `${idPrefix}-stair-opening-rear-header`],
      ["left", "front-left", "rear-left", `${idPrefix}-stair-opening-left-trimmer`],
      ["right", "front-right", "rear-right", `${idPrefix}-stair-opening-right-trimmer`]
    ] as const) {
      addMember(members, {
        id: `${idPrefix}-stair-opening-${edge}-load-transfer`,
        name: `${idPrefix} stair opening ${edge} load-transfer framing`,
        kind: "stair-opening-header",
        startNodeId: `stair-shaft-${start}-level-${level}`,
        endNodeId: `stair-shaft-${end}-level-${level}`,
        materialId: framingMaterialId,
        sectionId: "schematic-opening-header",
        componentIds: [componentId]
      });
    }
    for (const [edge, start, end, componentId] of [
      ["front", "front-left", "front-right", `${idPrefix}-stair-opening-front-collector`],
      ["rear", "rear-left", "rear-right", `${idPrefix}-stair-opening-rear-collector`],
      ["left", "front-left", "rear-left", `${idPrefix}-stair-opening-left-diaphragm-blocking`],
      ["right", "front-right", "rear-right", `${idPrefix}-stair-opening-right-diaphragm-blocking`]
    ] as const) {
      addMember(members, {
        id: `${idPrefix}-stair-opening-${edge}-diaphragm-continuity`,
        name: `${idPrefix} stair opening ${edge} diaphragm continuity member`,
        kind: "diaphragm-collector",
        startNodeId: `stair-shaft-${start}-level-${level}`,
        endNodeId: `stair-shaft-${end}-level-${level}`,
        materialId: framingMaterialId,
        sectionId: "schematic-diaphragm-collector",
        componentIds: [componentId]
      });
    }
  }
  if (usesSteelSupport) {
    for (const point of steelSupportGrid) {
      addMember(members, {
        id: `steel-${point.id}-foundation-column`,
        name: `Steel ${point.id} foundation-to-grade column segment`,
        kind: "steel-column",
        startNodeId: `steel-${point.id}-foundation`,
        endNodeId: `steel-${point.id}-level-0`,
        materialId: "structural-steel",
        sectionId: "schematic-steel-column",
        componentIds: [`steel-column-${point.id}`]
      });
      for (let story = 0; story < config.stories; story += 1) {
        addMember(members, {
          id: `steel-${point.id}-column-story-${story + 1}`,
          name: `Steel ${point.id} column story ${story + 1}`,
          kind: "steel-column",
          startNodeId: `steel-${point.id}-level-${story}`,
          endNodeId: `steel-${point.id}-level-${story + 1}`,
          materialId: "structural-steel",
          sectionId: "schematic-steel-column",
          componentIds: [`steel-column-${point.id}`]
        });
      }
    }
    for (let level = 1; level <= config.stories; level += 1) {
      for (const [id, left, right] of [
        ["front", "front-left", "front-right"],
        ["rear", "rear-left", "rear-right"]
      ] as const) {
        addMember(members, {
          id: `steel-beam-${id}-level-${level}`,
          name: `Steel beam ${id} level ${level}`,
          kind: "steel-beam",
          startNodeId: `steel-${left}-level-${level}`,
          endNodeId: `steel-${right}-level-${level}`,
          materialId: "structural-steel",
          sectionId: "schematic-steel-beam",
          componentIds: [`steel-beam-${id}-level-${level}`]
        });
      }
      for (const [id, front, rear] of [
        ["left", "front-left", "rear-left"],
        ["right", "front-right", "rear-right"]
      ] as const) {
        addMember(members, {
          id: `steel-girder-${id}-level-${level}`,
          name: `Steel girder ${id} level ${level}`,
          kind: "steel-beam",
          startNodeId: `steel-${front}-level-${level}`,
          endNodeId: `steel-${rear}-level-${level}`,
          materialId: "structural-steel",
          sectionId: "schematic-steel-beam",
          componentIds: [`steel-girder-${id}-level-${level}`]
        });
      }
    }
  }

  const materials: StructuralMaterial[] = [
    {
      id: "masonry",
      name: "Conceptual masonry wall material",
      densityPcf: 120,
      elasticModulusKsi: 1800,
      source: sources.residentialCode
    },
    {
      id: "wood-framing",
      name: "Conceptual wood floor and roof framing",
      densityPcf: 35,
      elasticModulusKsi: 1400,
      source: sources.residentialCode
    },
    {
      id: "concrete-metal-deck",
      name: "Conceptual concrete slab on steel metal deck",
      densityPcf: 145,
      elasticModulusKsi: 3600,
      source: sources.residentialCode
    },
    {
      id: "structural-steel",
      name: "Conceptual structural steel support members",
      densityPcf: 490,
      elasticModulusKsi: 29000,
      source: sources.residentialCode
    },
    {
      id: "reinforced-concrete",
      name: "Conceptual reinforced concrete bearing material",
      densityPcf: 145,
      elasticModulusKsi: 3600,
      source: sources.residentialCode
    }
  ];
  const sections: StructuralSection[] = [
    {
      id: "masonry-wall-line",
      name: "Schematic wall line section",
      areaSqFt: 0.45,
      momentOfInertiaFt4: 0.008,
      source: sources.residentialCode
    },
    {
      id: "foundation-wall-line",
      name: "Schematic foundation line section",
      areaSqFt: 0.6,
      momentOfInertiaFt4: 0.018,
      source: sources.residentialCode
    },
    {
      id: "schematic-floor-diaphragm",
      name: "Schematic floor diaphragm line",
      areaSqFt: 0.32,
      momentOfInertiaFt4: 0.003,
      source: sources.residentialCode
    },
    {
      id: "schematic-opening-header",
      name: "Schematic stair opening header/trimmer",
      areaSqFt: 0.11,
      momentOfInertiaFt4: 0.006,
      source: sources.residentialCode
    },
    {
      id: "schematic-diaphragm-collector",
      name: "Schematic diaphragm collector/blocking",
      areaSqFt: 0.05,
      momentOfInertiaFt4: 0.002,
      source: sources.residentialCode
    },
    {
      id: "schematic-built-up-post",
      name: "Schematic built-up wood post",
      areaSqFt: 0.102,
      momentOfInertiaFt4: 0.0009,
      source: sources.residentialCode
    },
    {
      id: "schematic-bearing-pad",
      name: "Schematic reinforced concrete bearing pad",
      areaSqFt: 1.1,
      momentOfInertiaFt4: 0.013,
      source: sources.residentialCode
    },
    {
      id: "schematic-steel-column",
      name: "Schematic steel column placeholder",
      areaSqFt: 0.028,
      momentOfInertiaFt4: 0.0015,
      source: sources.residentialCode
    },
    {
      id: "schematic-steel-beam",
      name: "Schematic steel beam placeholder",
      areaSqFt: 0.038,
      momentOfInertiaFt4: 0.009,
      source: sources.residentialCode
    }
  ];
  const supports = [
    ...["fl", "fr", "rl", "rr"].map((key) => fixedSupport(`${key}-foundation`)),
    ...["front-left", "front-right", "rear-left", "rear-right"].map((corner) => fixedSupport(`stair-shaft-${corner}-foundation`))
  ];
  if (usesSteelSupport) {
    supports.push(...steelSupportGrid.map((point) => fixedSupport(`steel-${point.id}-foundation`)));
  }
  const loadCases: StructuralLoadCase[] = [
    { id: "dead", name: "Dead load", category: "dead", source: sources.residentialCode },
    { id: "floor-live", name: "Residential floor live load", category: "live", source: sources.residentialCode },
    { id: "roof-live", name: "Roof live or snow allowance", category: "roof-live", source: sources.residentialCode }
  ];
  const areaLoads: StructuralAreaLoad[] = [];
  for (let story = 0; story < config.stories; story += 1) {
    const memberId = `floor-${story + 1}-diaphragm`;
    areaLoads.push({
      id: `floor-${story + 1}-dead`,
      loadCaseId: "dead",
      targetMemberId: memberId,
      description: `Floor ${story + 1} dead load over diaphragm area, reduced by schematic stair opening.`,
      areaSqFt: floorPlateAreaSqFt,
      loadPsf: floorDeadLoadPsf,
      totalKips: loadKips(floorPlateAreaSqFt, floorDeadLoadPsf),
      source: sources.residentialCode
    });
    areaLoads.push({
      id: `floor-${story + 1}-live`,
      loadCaseId: "floor-live",
      targetMemberId: memberId,
      description: `Floor ${story + 1} residential live load over diaphragm area, reduced by schematic stair opening.`,
      areaSqFt: floorPlateAreaSqFt,
      loadPsf: floorLiveLoadPsf,
      totalKips: loadKips(floorPlateAreaSqFt, floorLiveLoadPsf),
      source: sources.residentialCode
    });
  }
  areaLoads.push({
    id: "roof-dead",
    loadCaseId: "dead",
    targetMemberId: "roof-diaphragm",
    description: "Flat roof dead load over full building footprint.",
    areaSqFt: roofAreaSqFt,
    loadPsf: roofDeadLoadPsf,
    totalKips: loadKips(roofAreaSqFt, roofDeadLoadPsf),
    source: sources.residentialCode
  });
  areaLoads.push({
    id: "roof-garden-saturated-dead",
    loadCaseId: "dead",
    targetMemberId: "roof-diaphragm",
    description: "Raised roof garden saturated dead-load allowance over the coordinated roof garden review zone.",
    areaSqFt: roofGardenAreaSqFt,
    loadPsf: roofGardenSaturatedDeadLoadPsf,
    totalKips: loadKips(roofGardenAreaSqFt, roofGardenSaturatedDeadLoadPsf),
    source: sources.residentialCode
  });
  areaLoads.push({
    id: "roof-live",
    loadCaseId: "roof-live",
    targetMemberId: "roof-diaphragm",
    description: "Roof live or snow allowance over full building footprint.",
    areaSqFt: roofAreaSqFt,
    loadPsf: roofLiveLoadPsf,
    totalKips: loadKips(roofAreaSqFt, roofLiveLoadPsf),
    source: sources.residentialCode
  });

  const floorDeadKips = loadKips(totalFloorAreaSqFt, floorDeadLoadPsf);
  const floorLiveKips = loadKips(totalFloorAreaSqFt, floorLiveLoadPsf);
  const roofDeadKips = round(loadKips(roofAreaSqFt, roofDeadLoadPsf) + loadKips(roofGardenAreaSqFt, roofGardenSaturatedDeadLoadPsf));
  const roofLiveKips = loadKips(roofAreaSqFt, roofLiveLoadPsf);
  const totalDeadLoadKips = round(floorDeadKips + roofDeadKips + wallDeadLoadKips + steelSupportDeadLoadKips);
  const totalLiveLoadKips = round(floorLiveKips + roofLiveKips);
  const floorTotalLoadKips = loadKips(floorPlateAreaSqFt, floorDeadLoadPsf + floorLiveLoadPsf);
  const roofTotalLoadKips = loadKips(roofAreaSqFt, roofDeadLoadPsf + roofLiveLoadPsf);
  const wallDemandPsf = demandPsf(wallDeadLoadKips, Math.max(1, (totalBuildingWidthFt * 2 + config.buildingDepthFt * (rowhomeCount + 1)) * buildingHeight));
  const rawDemandSurfaces: Array<Omit<StructuralDemandSurface, "intensity">> = [];
  for (let story = 0; story < config.stories; story += 1) {
    rawDemandSurfaces.push({
      id: `floor-${story + 1}-gravity-demand`,
      label: `Floor ${story + 1} gravity demand`,
      kind: "floor-area",
      demandKips: floorTotalLoadKips,
      areaSqFt: floorPlateAreaSqFt,
      demandPsf: demandPsf(floorTotalLoadKips, floorPlateAreaSqFt),
      bounds: {
        xMinFt: 0.45,
        xMaxFt: totalBuildingWidthFt - 0.45,
        yMinFt: 0,
        yMaxFt: config.buildingDepthFt,
        zMinFt: story * config.storyHeightFt + 0.18,
        zMaxFt: story * config.storyHeightFt + 0.42
      },
      source: sources.residentialCode,
      note: "Floor area color represents conceptual combined dead plus live gravity demand, not solved stress."
    });
  }
  rawDemandSurfaces.push({
    id: "roof-gravity-demand",
    label: "Roof gravity demand",
    kind: "roof-area",
    demandKips: roofTotalLoadKips,
    areaSqFt: roofAreaSqFt,
    demandPsf: demandPsf(roofTotalLoadKips, roofAreaSqFt),
    bounds: {
      xMinFt: 0.45,
      xMaxFt: totalBuildingWidthFt - 0.45,
      yMinFt: 0,
      yMaxFt: config.buildingDepthFt,
      zMinFt: buildingHeight + 0.18,
      zMaxFt: buildingHeight + 0.44
    },
    source: sources.residentialCode,
    note: "Roof color represents conceptual dead plus roof live or snow allowance, not solved stress."
  });
  for (const wall of [
    { id: "left-party-wall-demand", label: "Left party wall demand", xMin: 0, xMax: 0.45, yMin: 0, yMax: config.buildingDepthFt, share: 0.34 / rowhomeCount },
    { id: "right-party-wall-demand", label: "Right party wall demand", xMin: totalBuildingWidthFt - 0.45, xMax: totalBuildingWidthFt, yMin: 0, yMax: config.buildingDepthFt, share: 0.34 / rowhomeCount },
    ...Array.from({ length: Math.max(0, rowhomeCount - 1) }, (_, index) => {
      const x = config.buildingWidthFt * (index + 1);
      return { id: `shared-party-wall-${index + 1}-demand`, label: `Shared party wall ${index + 1} demand`, xMin: x - 0.225, xMax: x + 0.225, yMin: 0, yMax: config.buildingDepthFt, share: 0.34 / rowhomeCount };
    }),
    { id: "rear-wall-demand", label: "Rear wall demand", xMin: 0, xMax: totalBuildingWidthFt, yMin: config.buildingDepthFt, yMax: config.buildingDepthFt + 0.36, share: 0.18 },
    { id: "front-facade-demand", label: "Front facade demand", xMin: 0, xMax: totalBuildingWidthFt, yMin: -0.36, yMax: 0, share: 0.14 }
  ]) {
    const xLengthFt = wall.xMax - wall.xMin;
    const yLengthFt = wall.yMax - wall.yMin;
    const samplesAlongLength = Math.max(1, Math.ceil(Math.max(xLengthFt, yLengthFt) / 6));
    const samplesPerStory = 5;
    const totalElementArea = Math.max(1, (xLengthFt + yLengthFt) * buildingHeight);

    for (let alongIndex = 0; alongIndex < samplesAlongLength; alongIndex += 1) {
      const alongStart = alongIndex / samplesAlongLength;
      const alongEnd = (alongIndex + 1) / samplesAlongLength;
      const xMin = xLengthFt >= yLengthFt ? wall.xMin + xLengthFt * alongStart : wall.xMin;
      const xMax = xLengthFt >= yLengthFt ? wall.xMin + xLengthFt * alongEnd : wall.xMax;
      const yMin = yLengthFt > xLengthFt ? wall.yMin + yLengthFt * alongStart : wall.yMin;
      const yMax = yLengthFt > xLengthFt ? wall.yMin + yLengthFt * alongEnd : wall.yMax;
      const sampleLength = (xMax - xMin) + (yMax - yMin);

      for (let story = 0; story < config.stories; story += 1) {
        for (let verticalIndex = 0; verticalIndex < samplesPerStory; verticalIndex += 1) {
          const zMin = (story + verticalIndex / samplesPerStory) * config.storyHeightFt;
          const zMax = (story + (verticalIndex + 1) / samplesPerStory) * config.storyHeightFt;
          const zMid = (zMin + zMax) / 2;
          const heightFactor = cumulativeHeightFactor(zMid, buildingHeight);
          const sampleArea = Math.max(0.5, sampleLength * (zMax - zMin));
          const tributaryShare = sampleArea / totalElementArea;
          const demandKips = round(wallDeadLoadKips * wall.share * heightFactor * tributaryShare, 4);
          rawDemandSurfaces.push({
            id: `${wall.id}-continuous-${alongIndex + 1}-${story + 1}-${verticalIndex + 1}`,
            label: `${wall.label} continuous gravity sample ${alongIndex + 1}.${story + 1}.${verticalIndex + 1}`,
            kind: "wall-line",
            demandKips,
            areaSqFt: round(sampleArea),
            demandPsf: demandPsf(demandKips, sampleArea),
            bounds: {
              xMinFt: xMin,
              xMaxFt: xMax,
              yMinFt: yMin,
              yMaxFt: yMax,
              zMinFt: zMin,
              zMaxFt: zMax
            },
            source: sources.residentialCode,
            note: "Wall color represents a continuous sampled gravity-demand field along the load-bearing element; values remain conceptual tributary demand, not solved stress or capacity."
          });
        }
      }
    }
  }
  const minDemandPsf = Math.min(...rawDemandSurfaces.map((surface) => surface.demandPsf));
  const maxDemandPsf = Math.max(...rawDemandSurfaces.map((surface) => surface.demandPsf), 1);
  const demandRangePsf = Math.max(0.001, maxDemandPsf - minDemandPsf);
  const demandSurfaces = rawDemandSurfaces.map((surface) => ({
    ...surface,
    intensity: round((surface.demandPsf - minDemandPsf) / demandRangePsf)
  }));
  const loadCombinations = buildLoadCombinations(floorDeadKips, roofDeadKips, wallDeadLoadKips, steelSupportDeadLoadKips, floorLiveKips, roofLiveKips);
  const designChecks = buildDesignChecks(config, members);

  return {
    units: "feet-kips",
    status: "conceptual-load-model",
    nodes,
    members,
    materials,
    sections,
    supports,
    loadCases,
    areaLoads,
    assumptions: [
      "This is a conceptual gravity-load model, not a solved structural analysis model.",
      `Construction system is ${constructionSystem.label}: ${constructionSystem.notes}`,
      `Floor dead load is ${floorDeadLoadPsf} psf and floor live load is ${floorLiveLoadPsf} psf.`,
      `Roof dead load is ${roofDeadLoadPsf} psf and roof live or snow allowance is ${roofLiveLoadPsf} psf.`,
      `Raised roof garden saturated dead-load allowance is ${roofGardenSaturatedDeadLoadPsf} psf over ${roofGardenAreaSqFt} sf.`,
      "Floor diaphragm area is reduced by a schematic stair opening.",
      "Stair opening headers, trimmers, collectors, continuous posts, base/cap plates, and bearing pads are represented as load-path members for coordination.",
      "Walls are represented as line load paths; wall openings and lintel behavior are not solved.",
      usesSteelSupport
        ? "Steel support option adds schematic interior columns, beams, and girders with a placeholder steel self-weight allowance."
        : "Structural support scheme uses the current masonry bearing-wall and wood diaphragm layout.",
      "Support fixity is schematic and requires licensed structural engineering review."
    ],
    warnings: [
      "No stiffness matrix has been solved yet.",
      "No member demand/capacity ratios, drift checks, or foundation bearing checks are produced yet.",
      "Gravity-only service and strength load combinations are reported for traceability, but lateral combinations are blocked until wind/seismic modeling is added.",
      "Structural results are limited to source-traced gravity load takeoff and schema validation.",
      "Heat-map colors are normalized to the current conceptual demand surface range, not an absolute code utilization ratio."
    ],
    gravityReport: {
      totalDeadLoadKips,
      totalLiveLoadKips,
      totalGravityLoadKips: round(totalDeadLoadKips + totalLiveLoadKips),
      floorDeadLoadKips: floorDeadKips,
      floorLiveLoadKips: floorLiveKips,
      roofDeadLoadKips: roofDeadKips,
      roofLiveLoadKips: roofLiveKips,
      floorAreaSqFt: totalFloorAreaSqFt,
      roofAreaSqFt,
      wallDeadLoadKips,
      steelSupportDeadLoadKips
    },
    demandSurfaces,
    loadCombinations,
    designChecks,
    solverStatus: {
      selectedSolver: "none",
      readyForSolver: false,
      requiredNextStep: "Select and validate a frame/FEM solver, then map structural members to solver elements with boundary conditions and load combinations.",
      missingInputs: [
        "member sizes and section properties selected for design",
        "validated support and connection boundary conditions",
        "wind and seismic lateral load model",
        "foundation and soil design inputs",
        "benchmark verification against known structural examples"
      ]
    }
  };
}
