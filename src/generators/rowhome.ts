import type { ModelComponent, RowhomeConfig, RowhomeModel } from "../core/types";
import { sources } from "../core/sources";
import { makeCurvedFacadeComponent, makeCylinderComponent } from "../geometry/component";
import { validateRowhome } from "../validation/validate";
import { estimateFacadeMaterialCost, selectedFacadeMaterial } from "../core/facadeMaterials";
import { selectedFacadeStyle } from "../core/facadeStyles";
import { box, bowProjectionAtX, bowTangentAngleAtX, frontWallOpenings, metadata, rearWallOpenings, wallSegmentsAroundOpenings } from "./builder";
import { addAlternatingRunStairFlight, addSpiralStairFlight, frontSpiralStairPlan } from "./stairs";
import { addBasement } from "./basement";
import { addFireAndThermalAssemblies, addFrontWallAssemblyLayers, addInteriorPartitionAssembly } from "./assemblies";
import { addBaltimoreRowhouseEntryAssembly, addBaltimoreRowhouseWindowAssembly } from "./facadeDetails";
import { addRearExitAndFireEscape } from "./fireEscape";
import { addStandardElectricalSystem } from "./electrical";
import { addStandardHvacSystem } from "./hvac";

function addFloorPlateWithStairOpening(
  components: ModelComponent[],
  config: RowhomeConfig,
  floor: number
): void {
  const isRoof = floor === config.stories;
  const w = config.buildingWidthFt;
  const d = config.buildingDepthFt;
  const xMin = 0.45;
  const xMax = w - 0.45;
  const yMin = 0;
  const yMax = d;
  const opening = {
    ...(config.stairImplementation === "spiral"
      ? {
          xMin: frontSpiralStairPlan.centerX - frontSpiralStairPlan.floorOpeningHalfFt,
          xMax: frontSpiralStairPlan.centerX + frontSpiralStairPlan.floorOpeningHalfFt,
          yMin: frontSpiralStairPlan.centerY - frontSpiralStairPlan.floorOpeningHalfFt,
          yMax: frontSpiralStairPlan.centerY + frontSpiralStairPlan.floorOpeningHalfFt
        }
      : {
          xMin: 0.85,
          xMax: 5.15,
          yMin: 6.2,
          yMax: 35.2
        })
  };
  const z = floor * config.storyHeightFt + 0.16;
  const baseId = `floor-plate-${floor}`;
  const material = "engineered wood framing with stairwell rough opening";
  const color = isRoof ? "#746b5a" : "#b89563";
  const cost = isRoof ? 7800 : 9200;
  const notes = [
    "Floor plate is segmented around the stairwell shaft so stairs pass through the floor instead of intersecting a solid slab.",
    config.stairImplementation === "spiral"
      ? "Opening is centered on the front bowed-facade spiral stair shaft."
      : "Opening includes the basement stair and alternating run stair footprint."
  ];

  for (const [segmentId, x0, x1, y0, y1] of [
    ["left", xMin, opening.xMin, yMin, yMax],
    ["right", opening.xMax, xMax, yMin, yMax],
    ["front", opening.xMin, opening.xMax, yMin, opening.yMin],
    ["rear", opening.xMin, opening.xMax, opening.yMax, yMax]
  ] as const) {
    const width = x1 - x0;
    const depth = y1 - y0;
    if (width <= 0.01 || depth <= 0.01) {
      continue;
    }
    box(
      components,
      metadata(
        segmentId === "left" ? baseId : `${baseId}-${segmentId}`,
        isRoof ? `Flat roof deck ${segmentId} of stair opening` : `Floor plate ${floor + 1} ${segmentId} of stair opening`,
        isRoof ? "roof" : "structure",
        material,
        sources.residentialCode,
        segmentId === "left" ? cost : 0,
        true,
        notes
      ),
      color,
      width,
      depth,
      0.32,
      { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z }
    );
  }
}

export function generateRowhome(config: RowhomeConfig): RowhomeModel {
  const components: ModelComponent[] = [];
  const buildingHeight = config.stories * config.storyHeightFt;
  const w = config.buildingWidthFt;
  const d = config.buildingDepthFt;
  const facadeMaterial = selectedFacadeMaterial(config);
  const facadeStyle = selectedFacadeStyle(config.facadeStyleId);
  const isBowedFront = facadeStyle.id === "bowed-front";
  const isBayFront = facadeStyle.id === "bay-front";
  const bowDepth = 1.15;
  const facadeYAt = (x: number, offset = 0.56) => (isBowedFront ? -bowProjectionAtX(x, w, bowDepth) - offset : -offset);
  const facadeAngleAt = (x: number) => (isBowedFront ? bowTangentAngleAtX(x, w, bowDepth) : 0);

  box(
    components,
    metadata("lot", "R-8 lot plane", "site", "site surface", sources.r8, 0, false),
    "#5d7053",
    config.lotWidthFt + 2,
    config.lotDepthFt + 10,
    0.16,
    { x: config.lotWidthFt / 2, y: config.lotDepthFt / 2 - 5, z: -0.08 }
  );
  addBasement(components, config);

  box(
    components,
    metadata("party-wall-left", "Left party wall", "structure", "8 in brick or CMU masonry party wall", sources.residentialCode, 8800),
    "#9f422f",
    0.45,
    d,
    buildingHeight,
    { x: 0.225, y: d / 2, z: buildingHeight / 2 }
  );
  box(
    components,
    metadata("party-wall-right", "Right party wall", "structure", "8 in brick or CMU masonry party wall", sources.residentialCode, 8800),
    "#9f422f",
    0.45,
    d,
    buildingHeight,
    { x: w - 0.225, y: d / 2, z: buildingHeight / 2 }
  );
  const facadeMeta = metadata(
      "front-facade",
      `${facadeStyle.label} ${facadeMaterial.label} facade`,
      "facade",
      facadeMaterial.material,
      isBowedFront ? sources.biaCurvedBrick : sources.r8,
      estimateFacadeMaterialCost(config, facadeMaterial, facadeStyle),
      true,
      [facadeMaterial.notes, facadeStyle.notes, "Intentional architectural swell front; not a structural wall bowing defect."]
    );
  for (const [index, segment] of wallSegmentsAroundOpenings(w, buildingHeight, frontWallOpenings(config)).entries()) {
    const segmentMeta = index === 0
      ? facadeMeta
      : metadata(
          `front-facade-segment-${index + 1}`,
          `${facadeStyle.label} ${facadeMaterial.label} facade segment ${index + 1}`,
          "facade",
          facadeMaterial.material,
          isBowedFront ? sources.biaCurvedBrick : sources.r8,
          0,
          true,
          [facadeMaterial.notes, facadeStyle.notes, "Segmented around doors and windows so openings are visible through the wall."]
        );
    if (isBowedFront) {
      components.push(makeCurvedFacadeComponent(
        segmentMeta,
        facadeMaterial.color,
        segment.width,
        facadeMaterial.claddingThicknessFt,
        segment.height,
        Math.min(bowDepth, Math.max(0.08, segment.width * 0.08)),
        { x: segment.xCenter, y: facadeYAt(segment.xCenter, 0), z: segment.zCenter - segment.height / 2 },
        8
      ));
    } else {
      box(
        components,
        segmentMeta,
        facadeMaterial.color,
        segment.width,
        facadeMaterial.claddingThicknessFt,
        segment.height,
        { x: segment.xCenter, y: facadeYAt(segment.xCenter, facadeMaterial.claddingThicknessFt / 2), z: segment.zCenter },
        facadeAngleAt(segment.xCenter)
      );
    }
  }
  addFrontWallAssemblyLayers(components, config, buildingHeight, facadeYAt);
  for (const [index, segment] of wallSegmentsAroundOpenings(w, buildingHeight, rearWallOpenings(config)).entries()) {
    box(
      components,
      metadata(
        index === 0 ? "rear-wall" : `rear-wall-segment-${index + 1}`,
        index === 0 ? "Rear wall" : `Rear wall segment ${index + 1}`,
        "structure",
        "8 in brick or CMU masonry rear wall segmented around rear exits",
        sources.residentialCode,
        index === 0 ? 9600 : 0,
        true,
        ["Rear wall is segmented around egress door rough openings so the rear exits are passable."]
      ),
      "#7e382d",
      segment.width,
      0.36,
      segment.height,
      { x: segment.xCenter, y: d + 0.18, z: segment.zCenter }
    );
  }
  addRearExitAndFireEscape(components, config);

  for (let floor = 0; floor <= config.stories; floor += 1) {
    addFloorPlateWithStairOpening(components, config, floor);
  }
  addFireAndThermalAssemblies(components, config, buildingHeight);

  box(
    components,
    metadata("front-parapet", "Front parapet and coping", "roof", "masonry coping", sources.residentialCode, 2200),
    "#6c3026",
    w,
    0.6,
    2.2,
    { x: w / 2, y: -0.22, z: buildingHeight + 1.1 }
  );
  box(
    components,
    metadata("cornice", "Facade cornice band", "facade", "formed metal cornice", sources.r8, 3600),
    "#2c343a",
    w,
    0.8,
    1.0,
    { x: w / 2, y: -0.55, z: buildingHeight - 0.8 }
  );
  box(
    components,
    metadata("deep-cornice-cap", "Deep projecting cornice cap", "facade", "formed metal cornice", sources.r8, 2100),
    "#1f272d",
    w + 0.9,
    1.05,
    0.35,
    { x: w / 2, y: facadeYAt(w / 2, 0.62), z: buildingHeight - 0.05 }
  );
  for (const [label, z] of [["second-floor", config.storyHeightFt], ["third-floor", config.storyHeightFt * 2]] as const) {
    box(
      components,
      metadata(`belt-course-${label}`, `Stone belt course at ${label}`, "facade", "stone belt course", sources.r8, 850),
      "#c8bea8",
      w + 0.25,
      0.34,
      0.28,
      { x: w / 2, y: facadeYAt(w / 2, 0.48), z }
    );
  }
  box(
    components,
    metadata("stoop", "Front stoop", "facade", "concrete", sources.r8, 4200),
    "#8b8e8b",
    6.8,
    4.8,
    1.4,
    { x: w / 2, y: -2.8, z: 0.7 }
  );
  box(
    components,
    metadata(
      "front-door",
      "Baltimore rowhouse paneled front entry door",
      "facade",
      "painted insulated wood entry door",
      sources.baltimoreRowhouseAnatomy,
      1800,
      true,
      ["Base door leaf for rowhouse entry anatomy: rails, stiles, panels, jamb, threshold, knob, and transom are modeled separately."]
    ),
    "#111820",
    3.1,
    0.18,
    7.2,
    { x: w / 2 - 0.4, y: facadeYAt(w / 2 - 0.4, 0.66), z: 3.8 },
    facadeAngleAt(w / 2 - 0.4)
  );
  box(
    components,
    metadata("transom-window", "Entry transom window", "facade", "transom glazing", sources.baltimoreRowhouseAnatomy, 950),
    "#98d3ee",
    3.2,
    0.16,
    0.8,
    { x: w / 2 - 0.4, y: facadeYAt(w / 2 - 0.4, 0.58), z: 7.85 },
    facadeAngleAt(w / 2 - 0.4)
  );
  addBaltimoreRowhouseEntryAssembly(components, w / 2 - 0.4, facadeYAt, facadeAngleAt);
  box(
    components,
    metadata("arched-entry-surround", "Arched entry surround", "facade", "stone entry surround", sources.r8, 2400),
    "#d1c5ad",
    4.3,
    0.28,
    0.45,
    { x: w / 2 - 0.4, y: facadeYAt(w / 2 - 0.4, 0.72), z: 7.7 },
    facadeAngleAt(w / 2 - 0.4)
  );
  box(
    components,
    metadata("left-entry-pilaster", "Left entry pilaster", "facade", "stone entry surround", sources.r8, 900),
    "#d1c5ad",
    0.38,
    0.28,
    7.1,
    { x: w / 2 - 2.15, y: facadeYAt(w / 2 - 2.15, 0.72), z: 3.75 },
    facadeAngleAt(w / 2 - 2.15)
  );
  box(
    components,
    metadata("right-entry-pilaster", "Right entry pilaster", "facade", "stone entry surround", sources.r8, 900),
    "#d1c5ad",
    0.38,
    0.28,
    7.1,
    { x: w / 2 + 1.35, y: facadeYAt(w / 2 + 1.35, 0.72), z: 3.75 },
    facadeAngleAt(w / 2 + 1.35)
  );

  for (const [side, x] of [["left", w / 2 - 3.2], ["right", w / 2 + 2.4]] as const) {
    box(
      components,
      metadata(`stoop-rail-${side}`, `Marble stoop rail ${side}`, "facade", "painted metal rail", sources.baltimoreRowhouseAnatomy, 600),
      "#22282c",
      0.18,
      4.0,
      2.2,
      { x, y: -3.05, z: 2.2 }
    );
  }

  if (isBayFront) {
    box(
      components,
      metadata("upper-box-bay", "Two-story projecting box bay", "facade", "window bay assembly", sources.r8, 9800),
      "#6f8791",
      5.4,
      2.0,
      config.storyHeightFt * 2 - 1.0,
      { x: w / 2, y: -1.25, z: config.storyHeightFt * 2 }
    );
  }

  for (let story = 0; story < config.stories; story += 1) {
    const z = story * config.storyHeightFt + 5.25;
    for (const [side, x] of [["left", 3.7], ["right", 14.2]] as const) {
      const windowInsertY = facadeYAt(x, -0.04);
      const windowAngle = facadeAngleAt(x);
      box(
        components,
        metadata(
          `front-window-${side}-${story + 1}`,
          `Front ${side} divided-light sash window story ${story + 1}`,
          "facade",
          "transparent double-hung window glazing",
          sources.baltimoreRowhouseAnatomy,
          1100,
          true,
          ["Base transparent glazing for rowhouse window anatomy; brick mold, casing, sash, jambs, muntins, lintel, and sill are modeled separately."]
        ),
        "#8cc8e8",
        3.2,
        0.2,
        4.5,
        { x, y: windowInsertY, z },
        windowAngle
      );
      box(
        components,
        metadata(`lintel-${side}-${story + 1}`, `Masonry lintel ${side} story ${story + 1}`, "facade", "stone lintel", sources.baltimoreRowhouseAnatomy, 450),
        "#c2b9a4",
        3.8,
        0.28,
        0.32,
        { x, y: facadeYAt(x, 0.72), z: z + 2.42 },
        windowAngle
      );
      box(
        components,
        metadata(`stone-sill-${side}-${story + 1}`, `Projecting stone sill ${side} story ${story + 1}`, "facade", "stone sill", sources.baltimoreRowhouseAnatomy, 260),
        "#d1c5ad",
        3.7,
        0.42,
        0.22,
        { x, y: facadeYAt(x, 0.82), z: z - 2.38 },
        windowAngle
      );
      addBaltimoreRowhouseWindowAssembly(components, `front-window-${side}`, x, story, z, facadeYAt, facadeAngleAt);
      if (story === 0) {
        box(
          components,
          metadata(`window-planter-${side}`, `Window planter ${side}`, "facade", "painted metal planter", sources.baltimoreRowhouseAnatomy, 325),
          "#26392d",
          3.2,
          0.55,
          0.45,
          { x, y: facadeYAt(x, 1.06), z: z - 2.85 },
          windowAngle
        );
      }
    }
  }

  if (isBowedFront) {
    for (let i = 1; i < 8; i += 1) {
      const x = (w / 8) * i;
      box(
        components,
        metadata(`swell-front-vertical-joint-${i}`, `Swell-front vertical masonry joint ${i}`, "facade", "tooled masonry joint", sources.biaCurvedBrick, 75, false),
        "#4d2118",
        0.055,
        0.08,
        buildingHeight,
        { x, y: facadeYAt(x, 0.37), z: buildingHeight / 2 },
        facadeAngleAt(x)
      );
    }
  }

  for (let run = 0; run < config.stories; run += 1) {
    if (config.stairImplementation === "spiral") {
      addSpiralStairFlight(components, run, run * config.storyHeightFt, config.storyHeightFt, sources.spiralStairCode);
    } else {
      addAlternatingRunStairFlight(components, run, run * config.storyHeightFt, sources.residentialCode);
    }
  }

  for (const [id, name, y, depth] of [
    ["living-room", "Front living room", 8.5, 14.0],
    ["dining-room", "Middle dining room", 24.0, 11.0],
    ["kitchen-room", "Rear kitchen", 39.0, 12.0],
    ["primary-bedroom", "Primary bedroom", 8.5, 14.0],
    ["second-bedroom", "Second bedroom", 34.0, 14.0],
    ["third-floor-bedroom", "Third floor bedroom", 10.0, 16.0],
    ["office-room", "Third floor office", 34.0, 12.0]
  ] as const) {
    const floor = id === "primary-bedroom" || id === "second-bedroom" ? 1 : id === "third-floor-bedroom" || id === "office-room" ? 2 : 0;
    box(
      components,
      metadata(`${id}-zone`, name, "interior", "room zone marker", sources.residentialCode, 0, false),
      floor === 0 ? "#2d4551" : "#3c4158",
      w - 1.4,
      depth,
      0.08,
      { x: w / 2, y, z: floor * config.storyHeightFt + 0.42 }
    );
  }

  for (const [id, y] of [["first-floor-partition", 31.0], ["second-floor-front-partition", 17.0], ["second-floor-rear-partition", 29.5], ["third-floor-partition", 25.0]] as const) {
    const floor = id.startsWith("second") ? 1 : id.startsWith("third") ? 2 : 0;
    addInteriorPartitionAssembly(components, id, y, floor, config);
  }

  box(
    components,
    metadata("living-room-couch", "Living room couch", "interior", "upholstered sofa", sources.plan, 1800),
    "#4f6f77",
    7.0,
    3.0,
    2.2,
    { x: 10.2, y: 13.2, z: 1.1 }
  );
  box(
    components,
    metadata("living-room-coffee-table", "Living room coffee table", "interior", "wood coffee table", sources.plan, 450),
    "#7b5736",
    4.2,
    2.1,
    1.0,
    { x: 10.0, y: 9.2, z: 0.5 }
  );
  box(
    components,
    metadata("living-room-tv", "Wall mounted TV", "interior", "television", sources.plan, 900),
    "#111315",
    5.0,
    0.16,
    2.8,
    { x: 9.7, y: 3.25, z: 3.8 }
  );

  for (const [id, name, floor, x, y, rotation] of [
    ["primary-bed", "Primary bed", 1, 11.0, 8.4, 0],
    ["second-bedroom-bed", "Second bedroom bed", 1, 11.0, 37.0, 0],
    ["third-bedroom-bed", "Third floor bed", 2, 11.2, 10.0, 0]
  ] as const) {
    box(
      components,
      metadata(id, name, "interior", "bed frame and mattress", sources.plan, 1400),
      "#c9d2d8",
      5.0,
      6.6,
      1.4,
      { x, y, z: floor * config.storyHeightFt + 1.0 },
      rotation
    );
    box(
      components,
      metadata(`${id}-headboard`, `${name} headboard`, "interior", "wood headboard", sources.plan, 350),
      "#755334",
      5.3,
      0.35,
      3.0,
      { x, y: y - 3.45, z: floor * config.storyHeightFt + 2.0 },
      rotation
    );
  }

  box(
    components,
    metadata("kitchen-base-cabinets", "Kitchen base cabinets", "interior", "cabinetry", sources.electricalCode, 7600),
    "#d8ca9c",
    7.0,
    5.5,
    3.2,
    { x: 13.7, y: 7.75, z: 1.6 }
  );
  box(
    components,
    metadata("kitchen-island", "Kitchen island", "interior", "cabinetry and countertop", sources.plan, 5200),
    "#c3b07a",
    5.8,
    2.8,
    3.0,
    { x: 8.5, y: 39.0, z: 1.5 }
  );
  box(
    components,
    metadata("electric-range", "Electric range and oven", "interior", "electric appliance", sources.electricalCode, 2400),
    "#2b3034",
    2.6,
    2.4,
    3.1,
    { x: 15.0, y: 36.2, z: 1.55 }
  );
  box(
    components,
    metadata("refrigerator", "Refrigerator", "interior", "electric appliance", sources.electricalCode, 2600),
    "#d7dde0",
    3.0,
    2.8,
    6.7,
    { x: 15.0, y: 42.0, z: 3.35 }
  );
  box(
    components,
    metadata("kitchen-sink", "Kitchen sink", "interior", "sink and faucet", sources.plan, 1200),
    "#cbd5d8",
    2.4,
    1.5,
    0.45,
    { x: 12.2, y: 35.4, z: 3.25 }
  );
  addStandardElectricalSystem(components, config, buildingHeight);

  addStandardHvacSystem(components, config, buildingHeight);

  box(
    components,
    metadata("rear-yard", "Rear yard service area", "site", "pervious yard surface", sources.naturalResources, 0, false),
    "#427d40",
    config.lotWidthFt,
    Math.max(0, config.lotDepthFt - d),
    0.08,
    { x: config.lotWidthFt / 2, y: d + (config.lotDepthFt - d) / 2, z: 0.02 }
  );

  if (config.includeTree) {
    components.push(makeCylinderComponent(
      metadata("street-tree-trunk", "Street tree trunk", "landscape", "urban tree", sources.completeStreets, 650),
      "#6c3f20",
      0.3,
      8,
      { x: 1.5, y: -7.7, z: 4 }
    ));
    box(
      components,
      metadata("street-tree-canopy", "Street tree canopy", "landscape", "urban tree canopy", sources.completeStreets, 0, false),
      "#2b7135",
      6,
      6,
      5,
      { x: 1.5, y: -7.7, z: 10.5 }
    );
  }

  const model: RowhomeModel = {
    name: "Baltimore R-8 Rowhome Concept Model",
    units: "feet",
    components,
    validation: []
  };
  model.validation = validateRowhome(config, model);
  return model;
}
