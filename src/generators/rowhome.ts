import { Matrix4 } from "three";
import type { BuildingInstance, ModelComponent, ModelHierarchy, RowhomeConfig, RowhomeModel } from "../core/types";
import { sources } from "../core/sources";
import { makeCurvedFacadeComponent, makeCylinderComponent, makeInstancedBoxComponent } from "../geometry/component";
import { validateRowhome } from "../validation/validate";
import { estimateFacadeMaterialCost, selectedFacadeMaterial } from "../core/facadeMaterials";
import { selectedFacadeStyle } from "../core/facadeStyles";
import { selectedConstructionSystem } from "../core/constructionSystems";
import { addCityBlockMassing } from "./cityBlock";
import { box, bowProjectionAtX, bowTangentAngleAtX, frontWallOpenings, metadata, rearWallOpenings, wallSegmentsAroundOpenings } from "./builder";
import { addAlternatingRunStairEgressBridge, addAlternatingRunStairFlight, addSpiralStairFlight, frontSpiralStairPlan } from "./stairs";
import { addBasement } from "./basement";
import { addFireAndThermalAssemblies, addFrontWallAssemblyLayers, addInteriorPartitionAssembly } from "./assemblies";
import { addBaltimoreRowhouseEntryAssembly, addBaltimoreRowhouseWindowAssembly } from "./facadeDetails";
import { addRearExitAndFireEscape } from "./fireEscape";
import { addStandardElectricalSystem } from "./electrical";
import { addStandardHvacSystem } from "./hvac";
import { addStandardPlumbingSystem } from "./plumbing";
import { buildStructuralModel } from "../structure/gravity";
import { addSteelSupportSystem } from "./steelSupport";
import { addRoofSolarArray } from "./solar";
import { addRoofGarden } from "./roofGarden";
import { attachRealAsset } from "./realAssets";
import { addBrickCountSummary, addInstancedBrickWall, brickCountForWall, standardBrick } from "./brickwork";

function rowhomeCount(config: RowhomeConfig): number {
  return Math.max(1, Math.min(6, Math.round(config.rowhomeCount || 1)));
}

function buildingInstanceForUnit(config: RowhomeConfig, unitIndex: number, componentIds: string[]): BuildingInstance {
  return {
    id: `detailed-house-${unitIndex + 1}`,
    block: 1,
    row: 1,
    position: unitIndex + 1,
    xFt: unitIndex * config.buildingWidthFt,
    yFt: 0,
    widthFt: config.buildingWidthFt,
    depthFt: config.buildingDepthFt,
    flipped: false,
    componentIds
  };
}

function modelHierarchyForDetailedBuildings(config: RowhomeConfig, components: ModelComponent[], count: number): ModelHierarchy {
  if (count === 1) {
    return {
      mode: "single-building",
      buildingInstances: [buildingInstanceForUnit(config, 0, components.map((component) => component.metadata.id))],
      hiddenDetailedComponentIds: [],
      notes: ["Single-building mode owns all generated components as one complete detailed house."]
    };
  }
  return {
    mode: "row-assembly",
    buildingInstances: Array.from({ length: count }, (_, index) => {
      const prefix = `unit-${index + 1}-`;
      const sharedIds = components
        .filter((component) => !component.metadata.id.startsWith("unit-"))
        .map((component) => component.metadata.id);
      const unitIds = components
        .filter((component) => component.metadata.id.startsWith(prefix))
        .map((component) => component.metadata.id);
      return buildingInstanceForUnit(config, index, [...sharedIds, ...unitIds]);
    }),
    hiddenDetailedComponentIds: [],
    notes: ["Row-assembly mode keeps each detailed house instance explicit while sharing row-level site and party-wall components."]
  };
}

function prefixUnitComponent(component: ModelComponent, unitIndex: number, xOffset: number): ModelComponent {
  const prefix = `unit-${unitIndex + 1}`;
  component.metadata = {
    ...component.metadata,
    id: `${prefix}-${component.metadata.id}`,
    name: `Unit ${unitIndex + 1} ${component.metadata.name}`,
    realProductModel: component.metadata.realProductModel
      ? {
          ...component.metadata.realProductModel,
          hideComponentIds: component.metadata.realProductModel.hideComponentIds?.map((id) => `${prefix}-${id}`)
        }
      : undefined
  };
  component.object.position.x += xOffset;
  return component;
}

function isUnitComponentReplacedByRowAssembly(component: ModelComponent): boolean {
  return [
    "lot",
    "front-sidewalk",
    "front-curb",
    "front-roadway",
    "side-roadway",
    "side-sidewalk",
    "front-crosswalk-stripe-1",
    "front-crosswalk-stripe-2",
    "front-crosswalk-stripe-3",
    "front-crosswalk-stripe-4",
    "front-crosswalk-stripe-5",
    "front-crosswalk-stripe-6",
    "side-crosswalk-stripe-1",
    "side-crosswalk-stripe-2",
    "side-crosswalk-stripe-3",
    "side-crosswalk-stripe-4",
    "side-crosswalk-stripe-5",
    "rear-yard",
    "brick-takeoff-summary",
    "party-wall-left",
    "party-wall-right",
    "party-wall-left-standard-bricks",
    "party-wall-right-standard-bricks",
    "basement-party-wall-left",
    "basement-party-wall-right",
    "house-scale-person-legs",
    "house-scale-person-torsos",
    "house-scale-person-heads"
  ].includes(component.metadata.id);
}

function addStreetFrontage(components: ModelComponent[], rowWidth: number): void {
  const frontLotLineY = -5.0;
  const privateForecourtDepthFt = 5.0;
  const sidewalkDepth = 14.0;
  const sidewalkCenterY = frontLotLineY - sidewalkDepth / 2;
  const curbCenterY = -19.2;
  const roadwayDepth = 30.0;
  const roadwayFrontEdgeY = curbCenterY - 0.4;
  const roadwayCenterY = roadwayFrontEdgeY - roadwayDepth / 2;
  const sideStreetCenterX = -20.0;
  const sideStreetWidth = 24.0;
  const sideStreetDepth = 120.0;
  const cornerCrosswalkCenterX = 1.8;
  const frontRoadCenterlineY = roadwayCenterY;
  const sideRoadCenterlineX = sideStreetCenterX;

  box(
    components,
    metadata("front-sidewalk", "Front public sidewalk", "site", "cast-in-place concrete sidewalk", sources.completeStreets, 5400, false, [
      `Sidewalk terminates at the front lot line so the private front plot begins at y=${frontLotLineY.toFixed(1)} ft.`,
      `Frontage preserves an approximately ${privateForecourtDepthFt.toFixed(0)} ft private forecourt consistent with the R-8 character statement of rowhouses built to or only modestly set back from the street.`
    ]),
    "#b7b5af",
    rowWidth + 10,
    sidewalkDepth,
    0.22,
    { x: rowWidth / 2, y: sidewalkCenterY, z: 0.11 }
  );
  box(
    components,
    metadata("front-curb", "Front street curb", "site", "concrete curb and gutter", sources.completeStreets, 1600, false),
    "#a7a49b",
    rowWidth + 10,
    0.8,
    0.5,
    { x: rowWidth / 2, y: curbCenterY, z: 0.25 }
  );
  box(
    components,
    metadata("front-roadway", "Front street roadway", "site", "asphalt street pavement", sources.completeStreets, 0, false, [
      "Frontage is pulled off the rowhouse face to preserve a modest urban setback condition for the stoop and public walk."
    ]),
    "#35383c",
    rowWidth + 42,
    roadwayDepth,
    0.18,
    { x: rowWidth / 2, y: roadwayCenterY, z: 0.01 }
  );
  for (const [index, offset] of [-0.32, 0.32].entries()) {
    box(
      components,
      metadata(`front-road-centerline-${index + 1}`, `Front road double-yellow line ${index + 1}`, "site", "thermoplastic double-yellow centerline marking", sources.completeStreets, index === 0 ? 420 : 0, false),
      "#d8b72c",
      rowWidth + 36,
      0.14,
      0.03,
      { x: rowWidth / 2, y: frontRoadCenterlineY + offset, z: 0.12 }
    );
  }
  box(
    components,
    metadata("side-roadway", "Corner side street roadway", "site", "asphalt street pavement", sources.completeStreets, 0, false, [
      "Secondary roadway runs along the side lot line and intersects the front street at the corner."
    ]),
    "#35383c",
    sideStreetWidth,
    sideStreetDepth,
    0.18,
    { x: sideStreetCenterX, y: 14.0, z: 0.01 }
  );
  for (const [index, offset] of [-0.32, 0.32].entries()) {
    box(
      components,
      metadata(`side-road-centerline-${index + 1}`, `Side road double-yellow line ${index + 1}`, "site", "thermoplastic double-yellow centerline marking", sources.completeStreets, index === 0 ? 420 : 0, false),
      "#d8b72c",
      0.14,
      sideStreetDepth - 8,
      0.03,
      { x: sideRoadCenterlineX + offset, y: 14.0, z: 0.12 }
    );
  }
  box(
    components,
    metadata("side-sidewalk", "Corner side street sidewalk", "site", "cast-in-place concrete sidewalk", sources.completeStreets, 3600, false),
    "#b7b5af",
    7.0,
    sideStreetDepth,
    0.22,
    { x: -4.5, y: 14.0, z: 0.11 }
  );

  const crosswalkCenterX = rowWidth / 2;
  for (let stripe = 0; stripe < 6; stripe += 1) {
    box(
      components,
      metadata(`front-crosswalk-stripe-${stripe + 1}`, `Front crosswalk stripe ${stripe + 1}`, "site", "thermoplastic crosswalk marking", sources.completeStreets, stripe === 0 ? 650 : 0, false),
      "#f4f2e8",
      2.2,
      1.1,
      0.03,
      { x: crosswalkCenterX, y: curbCenterY - 2.6 - stripe * 2.1, z: 0.12 }
    );
  }
  for (let stripe = 0; stripe < 5; stripe += 1) {
    box(
      components,
      metadata(`side-crosswalk-stripe-${stripe + 1}`, `Side street crosswalk stripe ${stripe + 1}`, "site", "thermoplastic crosswalk marking", sources.completeStreets, stripe === 0 ? 580 : 0, false),
      "#f4f2e8",
      1.1,
      2.2,
      0.03,
      { x: cornerCrosswalkCenterX - stripe * 2.0, y: sidewalkCenterY, z: 0.12 }
    );
  }

  const stopSignLocations = [
    { id: "side-north", x: -8.8, y: sidewalkCenterY + 10.5 },
    { id: "side-south", x: -8.8, y: sidewalkCenterY - 9.5 }
  ];
  for (const sign of stopSignLocations) {
    components.push(makeCylinderComponent(
      metadata(`stop-sign-post-${sign.id}`, `Stop sign post ${sign.id}`, "site", "galvanized steel sign post", sources.completeStreets, 120, false),
      "#8c9094",
      0.08,
      8.0,
      { x: sign.x, y: sign.y, z: 4.0 }
    ));
    const signFace = makeCylinderComponent(
      metadata(`stop-sign-face-${sign.id}`, `Stop sign ${sign.id}`, "site", "retroreflective octagonal stop sign", sources.completeStreets, 180, false, [
        "Conceptual side-street stop control for the modeled corner intersection."
      ]),
      "#b7221f",
      0.95,
      0.08,
      { x: sign.x, y: sign.y, z: 7.1 },
      8
    );
    signFace.object.rotation.x = Math.PI / 2;
    components.push(signFace);
  }

  const streetLightLocations = [
    { id: "corner-nw", x: -8.6, y: curbCenterY + 1.1 },
    { id: "corner-se", x: 2.0, y: sidewalkCenterY + 1.4 }
  ];
  for (const light of streetLightLocations) {
    components.push(makeCylinderComponent(
      metadata(`street-light-post-${light.id}`, `Street light pole ${light.id}`, "site", "painted steel street light pole", sources.completeStreets, 1400, false),
      "#74797d",
      0.14,
      14.0,
      { x: light.x, y: light.y, z: 7.0 }
    ));
    box(
      components,
      metadata(`street-light-head-${light.id}`, `Street light luminaire ${light.id}`, "site", "LED cobra-head street light luminaire", sources.completeStreets, 950, false, [
        "Conceptual corner street lighting for the modeled intersection."
      ]),
      "#1d2124",
      1.2,
      0.4,
      0.5,
      { x: light.x + 0.6, y: light.y + 0.2, z: 13.3 }
    );
  }
}

function addRowSiteComponents(components: ModelComponent[], config: RowhomeConfig, count: number): void {
  const rowWidth = config.buildingWidthFt * count;
  box(
    components,
    metadata("row-lot", `${count}-home R-8 row lot plane`, "site", "site surface", sources.r8, 0, false),
    "#5d7053",
    rowWidth + 2,
    config.lotDepthFt + 10,
    0.16,
    { x: rowWidth / 2, y: config.lotDepthFt / 2 - 5, z: -0.08 }
  );
  addStreetFrontage(components, rowWidth);
  box(
    components,
    metadata("row-rear-yard", `${count}-home rear yard service area`, "site", "pervious yard surface", sources.naturalResources, 0, false),
    "#427d40",
    rowWidth,
    Math.max(0, config.lotDepthFt - config.buildingDepthFt),
    0.08,
    { x: rowWidth / 2, y: config.buildingDepthFt + (config.lotDepthFt - config.buildingDepthFt) / 2, z: 0.02 }
  );
}

function houseScalePersonTransforms(config: RowhomeConfig, xOffset = 0): {
  legs: Matrix4[];
  torsos: Matrix4[];
  heads: Matrix4[];
} {
  const x = xOffset + config.buildingWidthFt / 2 + 2.1;
  const y = -6.0;
  const transform = (px: number, planY: number, z: number) => new Matrix4().makeTranslation(px, z, planY);
  return {
    legs: [
      transform(x - 0.18, y, 1.15),
      transform(x + 0.18, y, 1.15)
    ],
    torsos: [transform(x, y, 3.1)],
    heads: [transform(x, y, 4.95)]
  };
}

function addHouseScalePeople(components: ModelComponent[], config: RowhomeConfig, count = 1): void {
  const notes = [
    "Instanced schematic dummy person tied to the house model for human scale at the stoop and sidewalk.",
    "Zero-cost, non-printable context only; the animated walkthrough person remains a separate browser overlay."
  ];
  const transforms = Array.from({ length: count }, (_, unit) => houseScalePersonTransforms(config, unit * config.buildingWidthFt));
  const makeMeta = (id: string, name: string) => metadata(id, name, "site", "instanced schematic dummy person scale reference", sources.plan, 0, false, notes);
  components.push(makeInstancedBoxComponent(
    makeMeta("house-scale-person-legs", "House instanced scale-person legs"),
    "#25313a",
    0.18,
    0.18,
    2.2,
    transforms.flatMap((item) => item.legs),
    { cast: true, receive: true }
  ));
  components.push(makeInstancedBoxComponent(
    makeMeta("house-scale-person-torsos", "House instanced scale-person torsos"),
    "#2f6f91",
    0.7,
    0.32,
    1.65,
    transforms.flatMap((item) => item.torsos),
    { cast: true, receive: true }
  ));
  components.push(makeInstancedBoxComponent(
    makeMeta("house-scale-person-heads", "House instanced scale-person heads"),
    "#b98660",
    0.5,
    0.5,
    0.5,
    transforms.flatMap((item) => item.heads),
    { cast: true, receive: true }
  ));
}

function partyWallCenterX(boundaryIndex: number, config: RowhomeConfig, count: number): number {
  if (boundaryIndex === 0) return 0.225;
  if (boundaryIndex === count) return config.buildingWidthFt * count - 0.225;
  return config.buildingWidthFt * boundaryIndex;
}

function addSharedPartyWalls(components: ModelComponent[], config: RowhomeConfig, count: number, buildingHeight: number, renderIndividualBricks: boolean): number {
  const system = selectedConstructionSystem(config);
  let brickCount = 0;
  for (let boundary = 0; boundary <= count; boundary += 1) {
    const isShared = boundary > 0 && boundary < count;
    const id = isShared ? `shared-party-wall-${boundary}` : boundary === 0 ? "row-left-party-wall" : "row-right-party-wall";
    const name = isShared
      ? `Shared party wall between rowhomes ${boundary} and ${boundary + 1}`
      : boundary === 0 ? "Left end party wall" : "Right end party wall";
    const x = partyWallCenterX(boundary, config, count);
    const notes = [
      isShared
        ? "Single shared party-wall core at the common boundary; adjacent rowhomes do not duplicate side-wall structure."
        : "End party-wall core for the row assembly.",
      system.notes
    ];
    box(
      components,
      metadata(id, name, "structure", `shared ${system.partyWall.material}`, system.source, system.partyWall.costUsd, true, notes),
      system.partyWall.color,
      0.45,
      config.buildingDepthFt,
      buildingHeight,
      { x, y: config.buildingDepthFt / 2, z: buildingHeight / 2 }
    );
    if (config.includeBasement) {
      box(
        components,
        metadata(`${id}-basement-foundation`, `${name} basement foundation wall`, "structure", "shared reinforced concrete foundation wall", sources.residentialCode, 9400, true, notes),
        "#85867f",
        0.55,
        config.buildingDepthFt,
        config.basementDepthFt,
        { x, y: config.buildingDepthFt / 2, z: -config.basementDepthFt / 2 }
      );
    }
    if (system.usesBrickTakeoff) {
      const brickWall = {
        id: `${id}-standard-bricks`,
        name: `${name} standard brick wythes`,
        category: "structure",
        color: "#9f422f",
        lengthFt: config.buildingDepthFt,
        heightFt: buildingHeight,
        center: { x, y: config.buildingDepthFt / 2, z: buildingHeight / 2 },
        orientation: "party",
        wytheCount: 2,
        source: sources.residentialCode,
        notes
      } as const;
      brickCount += brickCountForWall(brickWall);
      if (renderIndividualBricks) {
        addInstancedBrickWall(components, brickWall);
      }
    }
  }
  return brickCount;
}

function singleUnitBrickSummary(model: RowhomeModel): number {
  return model.components.find((component) => component.metadata.id === "brick-takeoff-summary")?.metadata.quantity?.count ?? 0;
}

function buildRowAssembly(config: RowhomeConfig, count: number): RowhomeModel {
  const singleUnitConfig = { ...config, rowhomeCount: 1, includeTree: false };
  const buildingHeight = config.stories * config.storyHeightFt;
  const renderIndividualBricks = config.brickDetailMode === "individual-bricks";
  const components: ModelComponent[] = [];
  addRowSiteComponents(components, config, count);
  addHouseScalePeople(components, config, count);

  let unitFrontRearBrickCount = 0;
  for (let unit = 0; unit < count; unit += 1) {
    const unitModel = generateSingleRowhome(singleUnitConfig);
    if (unit === 0) {
      const singleSummary = singleUnitBrickSummary(unitModel);
      const singlePartyBoundaryCount = selectedConstructionSystem(config).usesBrickTakeoff
        ? brickCountForWall({
            lengthFt: config.buildingDepthFt,
            heightFt: buildingHeight,
            wytheCount: 2
          })
        : 0;
      unitFrontRearBrickCount = Math.max(0, singleSummary - singlePartyBoundaryCount * 2);
    }
    const xOffset = unit * config.buildingWidthFt;
    for (const component of unitModel.components) {
      if (!isUnitComponentReplacedByRowAssembly(component)) {
        components.push(prefixUnitComponent(component, unit, xOffset));
      }
    }
  }

  const sharedPartyBrickCount = addSharedPartyWalls(components, config, count, buildingHeight, renderIndividualBricks);
  addBrickCountSummary(components, unitFrontRearBrickCount * count + sharedPartyBrickCount);

  const model: RowhomeModel = {
    name: `Baltimore R-8 ${count}-Rowhome Shared-Party-Wall Concept Model`,
    units: "feet",
    components,
    structural: buildStructuralModel(config),
    hierarchy: modelHierarchyForDetailedBuildings(config, components, count),
    validation: []
  };
  model.validation = validateRowhome(config, model);
  return model;
}

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
  const system = selectedConstructionSystem(config);
  const z = floor * config.storyHeightFt + 0.16;
  const baseId = `floor-plate-${floor}`;
  const plateElement = isRoof ? system.roof : system.floor;
  const material = `${plateElement.material} with stairwell rough opening`;
  const color = plateElement.color;
  const cost = plateElement.costUsd;
  const notes = [
    "Floor plate is segmented around the stairwell shaft so stairs pass through the floor instead of intersecting a solid slab.",
    config.stairImplementation === "spiral"
      ? "Opening is centered on the front bowed-facade spiral stair shaft."
      : "Opening includes the basement stair and alternating run stair footprint.",
    system.notes
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

function stairOpeningBounds(config: RowhomeConfig): { xMin: number; xMax: number; yMin: number; yMax: number } {
  if (config.stairImplementation === "spiral") {
    return {
      xMin: frontSpiralStairPlan.centerX - frontSpiralStairPlan.floorOpeningHalfFt,
      xMax: frontSpiralStairPlan.centerX + frontSpiralStairPlan.floorOpeningHalfFt,
      yMin: frontSpiralStairPlan.centerY - frontSpiralStairPlan.floorOpeningHalfFt,
      yMax: frontSpiralStairPlan.centerY + frontSpiralStairPlan.floorOpeningHalfFt
    };
  }
  return { xMin: 0.85, xMax: 5.15, yMin: 6.2, yMax: 35.2 };
}

function addStairShaftAndRoofOpeningDetails(
  components: ModelComponent[],
  config: RowhomeConfig,
  buildingHeight: number
): void {
  const opening = stairOpeningBounds(config);
  const centerX = (opening.xMin + opening.xMax) / 2;
  const centerY = (opening.yMin + opening.yMax) / 2;
  const openingWidth = opening.xMax - opening.xMin;
  const openingDepth = opening.yMax - opening.yMin;
  const notes = [
    "Schematic stair shaft detail showing rough-opening framing, rated enclosure surfaces, guards, waterproofed roof curb, and continuous load path.",
    "Final stair, guard, shaft enclosure, roof penetration, connection, and fire-resistance design requires licensed architectural and structural review."
  ];
  const structuralLogicNotes = [
    ...notes,
    "Implements the structural-logic workflow as traceable model scope: code basis, load tracing, opening framing, diaphragm continuity, bearing pads, guard attachments, waterproofing coordination, fire separation, and inspection hold points.",
    "Component dimensions are coordination placeholders; final member sizes, reactions, fasteners, bearing pressures, and signed/sealed documents remain outside this conceptual model."
  ];

  box(
    components,
    metadata(
      "structural-code-basis-and-load-schedule",
      "Structural code basis and design-load schedule",
      "structure",
      "non-buildable structural notes plaque",
      sources.residentialCode,
      0,
      false,
      [
        ...structuralLogicNotes,
        "Lists governing code basis and preliminary dead, live, roof live/snow, guard, stair, roof-garden, wind uplift, and seismic/lateral design inputs for licensed review."
      ]
    ),
    "#d8d0bd",
    5.8,
    0.08,
    3.2,
    { x: config.buildingWidthFt + 2.8, y: 7.0, z: 5.4 }
  );
  box(
    components,
    metadata(
      "structural-field-survey-hold-point",
      "Structural field survey and concealed-condition hold point",
      "structure",
      "non-buildable field verification marker",
      sources.residentialCode,
      0,
      false,
      [
        ...structuralLogicNotes,
        "Requires verification of existing joist direction, party wall condition, foundation bearing, moisture damage, prior alterations, and rated assemblies before final detailing."
      ]
    ),
    "#b8a066",
    5.8,
    0.08,
    2.4,
    { x: config.buildingWidthFt + 2.8, y: 11.0, z: 4.8 }
  );

  for (let floor = 1; floor <= config.stories; floor += 1) {
    const levelZ = floor * config.storyHeightFt;
    const idPrefix = floor === config.stories ? "roof" : `floor-${floor}`;
    for (const [edge, x, y, width, depth] of [
      ["front-header", centerX, opening.yMin - 0.13, openingWidth + 0.52, 0.26],
      ["rear-header", centerX, opening.yMax + 0.13, openingWidth + 0.52, 0.26],
      ["left-trimmer", opening.xMin - 0.13, centerY, 0.26, openingDepth + 0.52],
      ["right-trimmer", opening.xMax + 0.13, centerY, 0.26, openingDepth + 0.52]
    ] as const) {
      box(
        components,
        metadata(
          `${idPrefix}-stair-opening-${edge}`,
          `${idPrefix.replace("-", " ")} stair opening ${edge.replace("-", " ")}`,
          "structure",
          "engineered wood stair-opening header and trimmer framing",
          sources.residentialCode,
          floor === 1 && edge === "front-header" ? 1800 : 0,
          true,
          [...structuralLogicNotes, "Headers and trimmers represent the rough-opening load path around the stair shaft."]
        ),
        "#6c482c",
        width,
        depth,
        0.42,
        { x, y, z: levelZ + 0.42 }
      );
    }
    for (const [edge, x, y, width, depth] of [
      ["front-collector", centerX, opening.yMin - 0.48, openingWidth + 1.2, 0.18],
      ["rear-collector", centerX, opening.yMax + 0.48, openingWidth + 1.2, 0.18],
      ["left-diaphragm-blocking", opening.xMin - 0.48, centerY, 0.18, openingDepth + 1.2],
      ["right-diaphragm-blocking", opening.xMax + 0.48, centerY, 0.18, openingDepth + 1.2]
    ] as const) {
      box(
        components,
        metadata(
          `${idPrefix}-stair-opening-${edge}`,
          `${idPrefix.replace("-", " ")} stair opening ${edge.replace("-", " ")}`,
          "structure",
          "wood diaphragm collector and edge blocking around stair opening",
          sources.residentialCode,
          floor === 1 && edge === "front-collector" ? 1250 : 0,
          true,
          [
            ...structuralLogicNotes,
            "Collector and blocking pieces preserve diaphragm continuity around the rough opening; final nailing, straps, chord forces, and drag connections require structural design."
          ]
        ),
        "#4f3320",
        width,
        depth,
        0.3,
        { x, y, z: levelZ + 0.7 }
      );
    }
  }

  for (const [corner, x, y] of [
    ["front-left", opening.xMin + 0.22, opening.yMin + 0.22],
    ["front-right", opening.xMax - 0.22, opening.yMin + 0.22],
    ["rear-left", opening.xMin + 0.22, opening.yMax - 0.22],
    ["rear-right", opening.xMax - 0.22, opening.yMax - 0.22]
  ] as const) {
    box(
      components,
      metadata(
        `stair-shaft-continuous-load-post-${corner}`,
        `Stair shaft continuous load-path post ${corner}`,
        "structure",
        "built-up wood post transferring stair opening loads to foundation",
        sources.residentialCode,
        corner === "front-left" ? 2200 : 0,
        true,
        [...structuralLogicNotes, "Continuous posts show a schematic gravity load path from roof/floor opening headers down to foundation bearing."]
      ),
      "#5f3d24",
      0.32,
      0.32,
      buildingHeight,
      { x, y, z: buildingHeight / 2 }
    );
    box(
      components,
      metadata(
        `stair-shaft-post-cap-plate-${corner}`,
        `Stair shaft post cap plate ${corner}`,
        "structure",
        "galvanized post cap and header bearing connector",
        sources.residentialCode,
        corner === "front-left" ? 520 : 0,
        true,
        [
          ...structuralLogicNotes,
          "Cap plate marks the required connection from headers/trimmers into the continuous load-path post; final connector model and fastener schedule require engineering."
        ]
      ),
      "#8e979a",
      0.58,
      0.58,
      0.1,
      { x, y, z: buildingHeight + 0.15 }
    );
    box(
      components,
      metadata(
        `stair-shaft-post-base-plate-${corner}`,
        `Stair shaft post base plate ${corner}`,
        "structure",
        "galvanized post base and anchor plate",
        sources.residentialCode,
        corner === "front-left" ? 520 : 0,
        true,
        [
          ...structuralLogicNotes,
          "Base plate marks the required anchored transfer from post to foundation or basement support; final anchor design requires support reactions and foundation capacity."
        ]
      ),
      "#8e979a",
      0.62,
      0.62,
      0.1,
      { x, y, z: 0.08 }
    );
    box(
      components,
      metadata(
        `stair-shaft-bearing-pad-${corner}`,
        `Stair shaft foundation bearing pad ${corner}`,
        "structure",
        "reinforced concrete bearing pad below stair shaft post",
        sources.residentialCode,
        corner === "front-left" ? 1400 : 0,
        true,
        [
          ...structuralLogicNotes,
          "Bearing pad makes the post load path explicit below grade; final footing size, reinforcement, soil bearing, and settlement checks require structural design."
        ]
      ),
      "#8d8b83",
      1.05,
      1.05,
      0.24,
      { x, y, z: config.includeBasement ? -config.basementDepthFt + 0.12 : 0.12 }
    );
  }

  for (const [side, x, y, width, depth] of [
    ["left", opening.xMin - 0.04, centerY, 0.08, openingDepth],
    ["right", opening.xMax + 0.04, centerY, 0.08, openingDepth],
    ["front", centerX, opening.yMin - 0.04, openingWidth, 0.08],
    ["rear", centerX, opening.yMax + 0.04, openingWidth, 0.08]
  ] as const) {
    box(
      components,
      metadata(
        `stair-shaft-${side}-type-x-gypsum`,
        `Stair shaft ${side} Type X gypsum fire separation`,
        "structure",
        "5/8 in Type X gypsum stair-shaft fire separation layer",
        sources.residentialCode,
        side === "left" ? 1900 : 0,
        true,
        [...structuralLogicNotes, "Rated shaft surfaces are schematic and must be coordinated with doors, penetrations, continuity, and tested assemblies."]
      ),
      "#efe9dd",
      width,
      depth,
      buildingHeight,
      { x, y, z: buildingHeight / 2 }
    );
  }

  for (const [edge, x, y, width, depth] of [
    ["front", centerX, opening.yMin - 0.18, openingWidth + 0.72, 0.36],
    ["rear", centerX, opening.yMax + 0.18, openingWidth + 0.72, 0.36],
    ["left", opening.xMin - 0.18, centerY, 0.36, openingDepth + 0.72],
    ["right", opening.xMax + 0.18, centerY, 0.36, openingDepth + 0.72]
  ] as const) {
    box(
      components,
      metadata(
        `roof-stair-opening-curb-${edge}`,
        `Roof stair opening raised curb ${edge}`,
        "roof",
        "raised framed roof curb at stair opening",
        sources.residentialCode,
        edge === "front" ? 2600 : 0,
        true,
        [...structuralLogicNotes, "Raised curb keeps waterproofing and roof access detailing explicit around the stair opening."]
      ),
      "#7d6346",
      width,
      depth,
      1.05,
      { x, y, z: buildingHeight + 0.78 }
    );
    box(
      components,
      metadata(
        `roof-stair-opening-flashing-${edge}`,
        `Roof stair opening metal flashing ${edge}`,
        "roof",
        "sheet-metal counterflashing and waterproof membrane termination",
        sources.residentialCode,
        edge === "front" ? 1100 : 0,
        true,
        [...structuralLogicNotes, "Flashing and membrane returns are schematic; final detailing must coordinate slope, drainage, fasteners, and membrane manufacturer requirements."]
      ),
      "#9ba6aa",
      width + 0.18,
      depth + 0.18,
      0.08,
      { x, y, z: buildingHeight + 1.34 }
    );
    box(
      components,
      metadata(
        `roof-stair-opening-uplift-strap-${edge}`,
        `Roof stair opening curb uplift strap ${edge}`,
        "structure",
        "galvanized uplift strap from curb to roof framing",
        sources.residentialCode,
        edge === "front" ? 780 : 0,
        true,
        [
          ...structuralLogicNotes,
          "Uplift strap marks required curb anchorage into roof framing; final wind uplift demand, strap model, fasteners, and load path require engineering."
        ]
      ),
      "#6f777b",
      edge === "front" || edge === "rear" ? 0.14 : width + 0.08,
      edge === "front" || edge === "rear" ? depth + 0.08 : 0.14,
      1.35,
      { x, y, z: buildingHeight + 0.72 }
    );
  }

  for (const [edge, x, y, width, depth] of [
    ["front", centerX, opening.yMin - 0.38, openingWidth + 1.0, 0.16],
    ["rear", centerX, opening.yMax + 0.38, openingWidth + 1.0, 0.16],
    ["left", opening.xMin - 0.38, centerY, 0.16, openingDepth + 1.0]
  ] as const) {
    box(
      components,
      metadata(
        `roof-stair-opening-guard-${edge}`,
        `Roof stair opening guard ${edge}`,
        "circulation",
        "roof guardrail around stair opening",
        sources.residentialCode,
        edge === "front" ? 1850 : 0,
        true,
        [...structuralLogicNotes, "Guard layout leaves the right-side bridge/access route open and must be finalized for code-compliant height, openings, loads, and attachment."]
      ),
      "#31383d",
      width,
      depth,
      3.5,
      { x, y, z: buildingHeight + 2.15 }
    );
    for (const offset of [-0.42, 0.42]) {
      const baseX = edge === "left" ? x : centerX + (width / 2 - 0.38) * offset;
      const baseY = edge === "left" ? centerY + (openingDepth / 2 - 0.38) * offset : y;
      box(
        components,
        metadata(
          `roof-stair-opening-guard-base-${edge}-${offset < 0 ? "a" : "b"}`,
          `Roof stair opening guard base attachment ${edge} ${offset < 0 ? "A" : "B"}`,
          "structure",
          "guard post base plate with waterproofed blocking",
          sources.residentialCode,
          edge === "front" && offset < 0 ? 420 : 0,
          true,
          [
            ...structuralLogicNotes,
            "Guard base marks the required post anchorage, backing/blocking, lateral load transfer, and waterproofed penetration coordination."
          ]
        ),
        "#1f2529",
        0.46,
        0.46,
        0.16,
        { x: baseX, y: baseY, z: buildingHeight + 0.72 }
      );
    }
  }

  box(
    components,
    metadata(
      "structural-special-inspection-hold-point",
      "Structural special inspection and pre-cover hold point",
      "structure",
      "non-buildable inspection marker",
      sources.residentialCode,
      0,
      false,
      [
        ...structuralLogicNotes,
        "Requires inspection of exposed framing, post bases/caps, guard backing, firestopping, waterproofing terminations, and field deviations before concealment."
      ]
    ),
    "#c8b46d",
    5.8,
    0.08,
    2.4,
    { x: config.buildingWidthFt + 2.8, y: 15.0, z: 4.8 }
  );
  box(
    components,
    metadata(
      "structural-signed-sealed-drawing-placeholder",
      "Signed and sealed structural drawing placeholder",
      "structure",
      "non-buildable structural drawing placeholder",
      sources.residentialCode,
      0,
      false,
      [
        ...structuralLogicNotes,
        "Represents the required final plans, sections, member schedules, connection details, calculations, permit responses, and sealed construction documents."
      ]
    ),
    "#e3dfd2",
    5.8,
    0.08,
    3.0,
    { x: config.buildingWidthFt + 2.8, y: 19.2, z: 5.2 }
  );
}

function addArchitecturalLogicDetails(
  components: ModelComponent[],
  config: RowhomeConfig,
  buildingHeight: number
): void {
  const opening = stairOpeningBounds(config);
  const centerX = (opening.xMin + opening.xMax) / 2;
  const centerY = (opening.yMin + opening.yMax) / 2;
  const openingWidth = opening.xMax - opening.xMin;
  const openingDepth = opening.yMax - opening.yMin;
  const w = config.buildingWidthFt;
  const d = config.buildingDepthFt;
  const architectNotes = [
    "Implements the architect-logic workflow as traceable model scope: code basis, existing conditions, egress, stair geometry, roof access, waterproofing, fire separation, envelope continuity, MEP/life-safety coordination, permit documents, construction administration, and closeout.",
    "Architectural components are schematic coordination placeholders; final dimensions, code analysis, schedules, specifications, AHJ responses, and signed/sealed documents require a licensed architect."
  ];

  for (const [id, name, source, y, height, note] of [
    [
      "architect-code-basis-and-zoning-matrix",
      "Architect code basis, occupancy, zoning, accessibility, and preservation matrix",
      sources.permitDocuments,
      6.0,
      3.1,
      "Tracks occupancy, construction type, zoning, local amendments, fire code, energy code, accessibility, historic district triggers, and rowhome party-wall constraints."
    ],
    [
      "architect-existing-conditions-survey-marker",
      "Architect existing-conditions survey marker",
      sources.permitDocuments,
      9.8,
      2.4,
      "Requires field documentation of stair location, floor-to-floor heights, parapets, drainage, exterior walls, party walls, openings, finishes, rated assemblies, and selective demolition scope."
    ],
    [
      "architect-permit-document-index",
      "Architect permit drawing and specification index",
      sources.permitDocuments,
      28.2,
      3.1,
      "Represents code analysis, life-safety plans, demolition plans, floor plans, roof plans, reflected ceiling plans, wall sections, stair sections, details, schedules, specifications, and coordinated notes."
    ],
    [
      "architect-ahj-review-response-log",
      "Architect AHJ review and response log",
      sources.permitDocuments,
      32.0,
      2.4,
      "Tracks permit submission, plan-review comments, code interpretations, inspection coordination, and jurisdiction-required revisions."
    ],
    [
      "architect-construction-administration-log",
      "Architect construction administration log",
      sources.permitDocuments,
      35.4,
      2.4,
      "Tracks submittals, shop drawings, product data, waterproofing details, guardrail details, rated assembly documentation, RFIs, and milestone site observations."
    ],
    [
      "architect-closeout-records",
      "Architect closeout records and maintenance handoff",
      sources.permitDocuments,
      38.8,
      2.4,
      "Collects warranties, roof membrane documentation, firestopping records, inspection approvals, as-built updates, maintenance instructions, roof-access procedures, drainage maintenance, and guard/handrail upkeep."
    ]
  ] as const) {
    box(
      components,
      metadata(
        id,
        name,
        "facade",
        "non-buildable architectural coordination marker",
        source,
        0,
        false,
        [...architectNotes, note]
      ),
      "#d7d2c4",
      6.0,
      0.08,
      height,
      { x: -3.2, y, z: 5.0 }
    );
  }

  box(
    components,
    metadata(
      "architect-egress-life-safety-path",
      "Architect life-safety egress path marker",
      "circulation",
      "non-buildable egress travel path and landing clearance marker",
      sources.residentialCode,
      0,
      false,
      [
        ...architectNotes,
        "Verifies front entry, stair landings, rear exits, roof access route, fire escape, handrails, guards, headroom, travel distance, door swing, thresholds, and required separation as architectural review scope."
      ]
    ),
    "#6aa0a8",
    0.16,
    d + 8.0,
    0.08,
    { x: centerX + 0.75, y: d / 2 - 2.0, z: 0.62 }
  );

  for (let floor = 1; floor <= config.stories; floor += 1) {
    const z = (floor - 1) * config.storyHeightFt + 6.7;
    box(
      components,
      metadata(
        `architect-stair-headroom-envelope-${floor}`,
        `Architect stair headroom envelope floor ${floor}`,
        "circulation",
        "non-buildable stair headroom and clearance envelope",
        sources.residentialCode,
        0,
        false,
        [
          ...architectNotes,
          "Coordinates stair width, risers, treads, landings, guard locations, usable circulation, finish build-ups, and clear headroom in plan and section."
        ]
      ),
      "#9ed6d2",
      openingWidth + 0.8,
      Math.min(8.4, openingDepth),
      6.8,
      { x: centerX, y: opening.yMin + Math.min(4.2, openingDepth / 2), z }
    );
  }

  box(
    components,
    metadata(
      "architect-roof-access-bulkhead-weatherhood",
      "Architect roof access bulkhead weatherhood",
      "roof",
      "schematic weather-protected stair bulkhead enclosure",
      sources.residentialCode,
      4800,
      true,
      [
        ...architectNotes,
        "Defines roof access condition with weather protection, landing clearance, guard coordination, parapet relationship, hatch/door operation, and maintenance access."
      ]
    ),
    "#b9c1c2",
    openingWidth + 1.2,
    3.1,
    2.2,
    { x: centerX, y: opening.yMin - 1.05, z: buildingHeight + 2.55 }
  );
  box(
    components,
    metadata(
      "architect-roof-access-rated-door",
      "Architect roof access rated door and threshold",
      "facade",
      "schematic insulated rated roof-access door with threshold",
      sources.residentialCode,
      1800,
      true,
      [
        ...architectNotes,
        "Coordinates door swing, threshold, landing clearance, hardware, weather seals, rated separation, and roof access operation."
      ]
    ),
    "#26323a",
    2.9,
    0.16,
    6.8,
    { x: centerX, y: opening.yMin - 2.62, z: buildingHeight + 3.3 }
  );

  for (const [id, name, y, depth, z, material, color, note] of [
    [
      "architect-roof-membrane-turnup",
      "Architect roof membrane turn-up at stair curb",
      opening.yMin - 0.55,
      0.18,
      buildingHeight + 1.22,
      "continuous roof membrane turn-up and counterflashing termination",
      "#6f8388",
      "Details curb height, membrane termination, counterflashing, vapor control, air barrier continuity, and manufacturer-required roof opening conditions."
    ],
    [
      "architect-roof-protection-walk-pad",
      "Architect roof protection walk pad",
      centerY + 5.8,
      9.2,
      buildingHeight + 0.58,
      "roof protection walk pad on membrane",
      "#727a63",
      "Coordinates maintenance walk path, protection board, roof garden access, service route, membrane protection, and guard/rail penetration avoidance."
    ],
    [
      "architect-roof-overflow-scupper",
      "Architect roof overflow scupper marker",
      d - 1.0,
      0.18,
      buildingHeight + 0.92,
      "overflow scupper and secondary drainage marker",
      "#4f7f95",
      "Coordinates roof slope, primary drainage, overflow drainage, scupper elevation, and water management with the roof opening and roof garden."
    ]
  ] as const) {
    box(
      components,
      metadata(id, name, "roof", material, sources.residentialCode, id === "architect-roof-membrane-turnup" ? 1100 : 0, true, [...architectNotes, note]),
      color,
      id === "architect-roof-overflow-scupper" ? 2.0 : openingWidth + 1.8,
      depth,
      id === "architect-roof-overflow-scupper" ? 0.5 : 0.1,
      { x: id === "architect-roof-overflow-scupper" ? w - 1.2 : centerX, y, z }
    );
  }

  for (const [side, x, y, width, depth] of [
    ["front", centerX, opening.yMin - 0.72, openingWidth + 1.3, 0.08],
    ["rear", centerX, opening.yMax + 0.72, openingWidth + 1.3, 0.08],
    ["left", opening.xMin - 0.72, centerY, 0.08, openingDepth + 1.3],
    ["right", opening.xMax + 0.72, centerY, 0.08, openingDepth + 1.3]
  ] as const) {
    box(
      components,
      metadata(
        `architect-curb-air-vapor-control-${side}`,
        `Architect curb air and vapor control ${side}`,
        "roof",
        "continuous air barrier, vapor control, and thermal transition at stair curb",
        sources.energyCode,
        side === "front" ? 1500 : 0,
        true,
        [
          ...architectNotes,
          "Maintains continuous insulation, air barrier, water-resistive barrier, vapor control, and thermal continuity at the roof opening and stair enclosure."
        ]
      ),
      "#d8e0ca",
      width,
      depth,
      1.15,
      { x, y, z: buildingHeight + 0.9 }
    );
  }

  for (const [id, x, y, z, note] of [
    ["architect-rated-penetration-firestop-roof-vent", 13.9, 28.0, buildingHeight + 0.72, "Coordinates protected membrane penetration and firestopping at the plumbing vent through the roof assembly."],
    ["architect-rated-penetration-firestop-exhaust", 6.6, d + 0.26, 9.2, "Coordinates protected duct penetration, rated separation, exterior termination, and fire/smoke continuity at the rear wall."],
    ["architect-rated-penetration-firestop-electrical", 12.7, 4.0, buildingHeight + 0.72, "Coordinates protected electrical/solar raceway penetrations through rated or waterproofed assemblies."]
  ] as const) {
    box(
      components,
      metadata(
        id,
        id.replace(/-/g, " "),
        "systems",
        "rated firestopping and protected penetration coordination marker",
        sources.residentialCode,
        0,
        false,
        [...architectNotes, note]
      ),
      "#d55d4a",
      0.7,
      0.7,
      0.7,
      { x, y, z }
    );
  }

  for (const [id, x, y, z, width, depth, height, note] of [
    ["architect-stair-finish-nosing-schedule", centerX, opening.yMin + 2.2, 1.05, openingWidth, 0.34, 0.18, "Coordinates finish build-up, nosings, slip resistance, riser/tread dimensions, and stair finish transitions."],
    ["architect-roof-threshold-transition", centerX, opening.yMin - 2.05, buildingHeight + 0.64, 3.4, 0.42, 0.16, "Coordinates weather threshold, landing transition, roof membrane termination, door sweep, and accessibility/maintenance use."],
    ["architect-rated-access-panel", opening.xMax + 0.55, centerY, config.storyHeightFt + 4.8, 0.12, 2.4, 2.4, "Coordinates access for concealed rated assemblies, MEP valves, inspection, and finish continuity around the stair shaft."]
  ] as const) {
    box(
      components,
      metadata(
        id,
        id.replace(/-/g, " "),
        "interior",
        "architectural finish transition and access coordination marker",
        sources.residentialCode,
        0,
        false,
        [...architectNotes, note]
      ),
      "#c9a46d",
      width,
      depth,
      height,
      { x, y, z }
    );
  }

  for (const [id, x, y, z, note] of [
    ["architect-smoke-co-alarm-stair-hall", centerX + 1.6, opening.yMin + 1.2, config.storyHeightFt + 8.4, "Coordinates smoke/CO detection with stair hall circulation and life-safety plans."],
    ["architect-emergency-lighting-stair-hall", centerX + 1.6, opening.yMin + 2.5, buildingHeight - 1.1, "Coordinates emergency lighting, switching, egress illumination, and electrical documentation where required."],
    ["architect-mep-roof-penetration-coordination-zone", 13.2, 28.0, buildingHeight + 0.85, "Coordinates drains, vents, conduits, ducts, exhaust, sprinklers if present, alarms, and waterproofed/rated roof penetrations."]
  ] as const) {
    box(
      components,
      metadata(
        id,
        id.replace(/-/g, " "),
        "systems",
        "architectural MEP and life-safety coordination marker",
        sources.residentialCode,
        0,
        false,
        [...architectNotes, note]
      ),
      "#f0d45a",
      0.65,
      0.65,
      0.2,
      { x, y, z }
    );
  }

  box(
    components,
    metadata(
      "architect-temporary-weather-protection-plan",
      "Architect constructability and temporary weather protection plan",
      "roof",
      "non-buildable construction sequencing and weather protection marker",
      sources.permitDocuments,
      0,
      false,
      [
        ...architectNotes,
        "Coordinates demolition sequencing, temporary weather protection, roof membrane sequencing, stair installation access, protection of existing finishes, tolerances, field verification, and trade coordination."
      ]
    ),
    "#b3a17a",
    4.8,
    0.12,
    2.0,
    { x: w + 2.4, y: d - 5.0, z: buildingHeight + 1.5 }
  );
}

function addRoofRunoffManagementDetails(
  components: ModelComponent[],
  config: RowhomeConfig,
  buildingHeight: number
): void {
  const opening = stairOpeningBounds(config);
  const w = config.buildingWidthFt;
  const d = config.buildingDepthFt;
  const drain = { x: w - 1.2, y: d - 2.0 };
  const notes = [
    "Flat roof runoff is modeled with tapered insulation/slope zones, crickets around the stair bulkhead, a primary drain sump, overflow scuppers, and keep-clear service zones.",
    "Final roof drainage requires code rainfall intensity, primary/secondary drain sizing, overflow elevation, structural ponding checks, membrane manufacturer details, and licensed design."
  ];

  for (const [id, name, x, y, width, depth, z, note] of [
    ["roof-drainage-high-point-front", "Roof drainage high-point tapered insulation zone", w / 2, 8.0, w - 1.2, 13.5, buildingHeight + 0.72, "High-side tapered insulation starts runoff toward the rear-right primary drain."],
    ["roof-drainage-mid-slope-field", "Roof drainage mid-slope tapered insulation field", w / 2 + 1.2, 25.0, w - 3.0, 18.0, buildingHeight + 0.61, "Intermediate slope field carries water around the stair opening and roof garden service path."],
    ["roof-drainage-low-sump-field", "Roof drainage low-point sump field", drain.x - 1.8, drain.y - 1.4, 4.8, 5.0, buildingHeight + 0.50, "Lowest tapered field forms the primary sump around the roof drain inlet."]
  ] as const) {
    box(
      components,
      metadata(id, name, "roof", "tapered polyiso roof insulation creating positive drainage slope", sources.residentialCode, id === "roof-drainage-high-point-front" ? 2400 : 0, true, [...notes, note]),
      "#7f8f78",
      width,
      depth,
      0.08,
      { x, y, z }
    );
    components[components.length - 1].object.userData.roofDrainage = {
      kind: "tapered-slope-zone",
      target: "roof-drain",
      designSlopeInPerFt: 0.25
    };
  }

  for (const [side, x, y, width, depth, note] of [
    ["front", (opening.xMin + opening.xMax) / 2, opening.yMin - 1.15, opening.xMax - opening.xMin + 1.8, 0.42, "Front cricket splits runoff around the stair bulkhead curb instead of trapping it against the up-slope side."],
    ["rear", (opening.xMin + opening.xMax) / 2, opening.yMax + 1.15, opening.xMax - opening.xMin + 1.8, 0.42, "Rear cricket turns water back toward the main low-point drain field."],
    ["right", opening.xMax + 0.92, (opening.yMin + opening.yMax) / 2, 0.42, opening.yMax - opening.yMin + 1.8, "Right-side cricket protects the open roof access route and directs runoff away from the stair curb."]
  ] as const) {
    box(
      components,
      metadata(
        `roof-drainage-cricket-${side}`,
        `Roof drainage cricket ${side} of stair bulkhead`,
        "roof",
        "tapered roof cricket diverting water around stair curb",
        sources.residentialCode,
        side === "front" ? 1600 : 0,
        true,
        [...notes, note]
      ),
      "#91a184",
      width,
      depth,
      0.18,
      { x, y, z: buildingHeight + 0.86 }
    );
    components[components.length - 1].object.userData.roofDrainage = {
      kind: "cricket",
      target: "roof-drain",
      avoids: "stair-bulkhead-curb"
    };
  }

  box(
    components,
    metadata(
      "roof-drain-sump-pan",
      "Primary roof drain sump pan",
      "roof",
      "recessed roof drain sump pan integrated with membrane",
      sources.plumbingCode,
      900,
      true,
      [...notes, "Sump pan is the low point for the tapered roof field and must be flashed into the primary roof drain assembly."]
    ),
    "#4e6671",
    2.4,
    2.4,
    0.12,
    { x: drain.x, y: drain.y, z: buildingHeight + 0.48 }
  );
  components[components.length - 1].object.userData.roofDrainage = { kind: "primary-sump", drainsTo: "roof-drain-leader" };

  box(
    components,
    metadata(
      "roof-drain-strainer",
      "Primary roof drain dome strainer",
      "systems",
      "cast aluminum dome strainer at primary roof drain",
      sources.plumbingCode,
      420,
      true,
      [...notes, "Dome strainer keeps leaves and roof-garden debris out of the storm leader while preserving inspection access."]
    ),
    "#9aa5a8",
    1.1,
    1.1,
    0.55,
    { x: drain.x, y: drain.y, z: buildingHeight + 0.86 }
  );
  components[components.length - 1].object.userData.roofDrainage = { kind: "primary-drain-inlet", drainsTo: "roof-drain-leader" };

  for (const [id, y, z, note] of [
    ["roof-overflow-scupper-rear-primary", d + 0.28, buildingHeight + 0.78, "Rear overflow scupper sits above the primary drain sump and provides a visible emergency discharge path if the roof drain blocks."],
    ["roof-overflow-scupper-side-secondary", d - 6.0, buildingHeight + 0.86, "Side overflow scupper gives a second high-water route away from the stair curb and roof garden."]
  ] as const) {
    box(
      components,
      metadata(id, id.replace(/-/g, " "), "roof", "secondary overflow scupper through parapet", sources.plumbingCode, id.endsWith("primary") ? 650 : 0, true, [...notes, note]),
      "#426f83",
      1.6,
      0.22,
      0.5,
      { x: w - 1.2, y, z }
    );
    components[components.length - 1].object.userData.roofDrainage = { kind: "overflow-scupper", trigger: "blocked-primary-drain" };
  }

  box(
    components,
    metadata(
      "roof-drain-keep-clear-zone",
      "Roof drain keep-clear maintenance zone",
      "roof",
      "non-printable roof drain maintenance clearance marker",
      sources.plumbingCode,
      0,
      false,
      [...notes, "No planter, PV rack, paver pedestal, guard base, or service equipment should block access to the drain sump and overflow route."]
    ),
    "#6fb3c8",
    5.0,
    5.0,
    0.05,
    { x: drain.x, y: drain.y, z: buildingHeight + 0.46 }
  );
  components[components.length - 1].object.userData.roofDrainage = { kind: "maintenance-clearance", protects: "roof-drain" };
}

function generateSingleRowhome(config: RowhomeConfig): RowhomeModel {
  const components: ModelComponent[] = [];
  const buildingHeight = config.stories * config.storyHeightFt;
  const w = config.buildingWidthFt;
  const d = config.buildingDepthFt;
  const facadeMaterial = selectedFacadeMaterial(config);
  const facadeStyle = selectedFacadeStyle(config.facadeStyleId);
  const isBowedFront = facadeStyle.id === "bowed-front";
  const isBayFront = facadeStyle.id === "bay-front";
  const renderIndividualBricks = config.brickDetailMode === "individual-bricks";
  let calculatedBrickCount = 0;
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
  addStreetFrontage(components, config.buildingWidthFt);
  addHouseScalePeople(components, config);
  addBasement(components, config);

  const constructionSystem = selectedConstructionSystem(config);
  box(
    components,
    metadata("party-wall-left", "Left party wall", "structure", constructionSystem.partyWall.material, constructionSystem.source, constructionSystem.partyWall.costUsd),
    constructionSystem.partyWall.color,
    0.45,
    d,
    buildingHeight,
    { x: 0.225, y: d / 2, z: buildingHeight / 2 }
  );
  box(
    components,
    metadata("party-wall-right", "Right party wall", "structure", constructionSystem.partyWall.material, constructionSystem.source, constructionSystem.partyWall.costUsd),
    constructionSystem.partyWall.color,
    0.45,
    d,
    buildingHeight,
    { x: w - 0.225, y: d / 2, z: buildingHeight / 2 }
  );
  if (constructionSystem.usesBrickTakeoff) {
    const leftPartyBrickWall = {
      id: "party-wall-left-standard-bricks",
      name: "Left party wall standard brick wythe",
      category: "structure",
      color: "#9f422f",
      lengthFt: d,
      heightFt: buildingHeight,
      center: { x: 0.45 + standardBrick.actualDepthFt / 2, y: d / 2, z: buildingHeight / 2 },
      orientation: "party",
      wytheCount: 2,
      source: sources.residentialCode,
      notes: ["Two wythes are counted for the schematic masonry party wall; the structural wall mass remains as a backing volume for collision and layer filtering."]
    } as const;
    calculatedBrickCount += brickCountForWall(leftPartyBrickWall);
    if (renderIndividualBricks) {
      addInstancedBrickWall(components, leftPartyBrickWall);
    }
    const rightPartyBrickWall = {
      id: "party-wall-right-standard-bricks",
      name: "Right party wall standard brick wythe",
      category: "structure",
      color: "#9f422f",
      lengthFt: d,
      heightFt: buildingHeight,
      center: { x: w - 0.45 - standardBrick.actualDepthFt / 2, y: d / 2, z: buildingHeight / 2 },
      orientation: "party",
      wytheCount: 2,
      source: sources.residentialCode,
      notes: ["Two wythes are counted for the schematic masonry party wall; the structural wall mass remains as a backing volume for collision and layer filtering."]
    } as const;
    calculatedBrickCount += brickCountForWall(rightPartyBrickWall);
    if (renderIndividualBricks) {
      addInstancedBrickWall(components, rightPartyBrickWall);
    }
  }
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
  const frontWallSegments = wallSegmentsAroundOpenings(w, buildingHeight, frontWallOpenings(config));
  for (const [index, segment] of frontWallSegments.entries()) {
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
  if (/brick|masonry/i.test(facadeMaterial.material)) {
    for (const [index, segment] of frontWallSegments.entries()) {
      const frontBrickWall = {
        id: index === 0 ? "front-facade-standard-bricks" : `front-facade-standard-bricks-${index + 1}`,
        name: index === 0 ? "Front facade standard brick wythe" : `Front facade standard brick wythe segment ${index + 1}`,
        category: "facade",
        color: facadeMaterial.color,
        lengthFt: segment.width,
        heightFt: segment.height,
        center: {
          x: segment.xCenter,
          y: facadeYAt(segment.xCenter, facadeMaterial.claddingThicknessFt + standardBrick.actualDepthFt / 2),
          z: segment.zCenter
        },
        orientation: "front-rear",
        source: isBowedFront ? sources.biaCurvedBrick : sources.r8,
        notes: ["Segmented around the front door and window rough openings."]
      } as const;
      calculatedBrickCount += brickCountForWall(frontBrickWall);
      if (renderIndividualBricks) {
        addInstancedBrickWall(components, frontBrickWall);
      }
    }
  }
  addFrontWallAssemblyLayers(components, config, buildingHeight, facadeYAt);
  const rearWallSegments = wallSegmentsAroundOpenings(w, buildingHeight, rearWallOpenings(config));
  for (const [index, segment] of rearWallSegments.entries()) {
    box(
      components,
      metadata(
        index === 0 ? "rear-wall" : `rear-wall-segment-${index + 1}`,
        index === 0 ? "Rear wall" : `Rear wall segment ${index + 1}`,
        "structure",
        `${constructionSystem.rearWall.material} segmented around rear exits`,
        constructionSystem.source,
        index === 0 ? constructionSystem.rearWall.costUsd : 0,
        true,
        ["Rear wall is segmented around egress door rough openings so the rear exits are passable."]
      ),
      constructionSystem.rearWall.color,
      segment.width,
      0.36,
      segment.height,
      { x: segment.xCenter, y: d + 0.18, z: segment.zCenter }
    );
  }
  if (constructionSystem.usesBrickTakeoff) {
    for (const [index, segment] of rearWallSegments.entries()) {
      const rearBrickWall = {
        id: index === 0 ? "rear-wall-standard-bricks" : `rear-wall-standard-bricks-${index + 1}`,
        name: index === 0 ? "Rear wall standard brick wythe" : `Rear wall standard brick wythe segment ${index + 1}`,
        category: "structure",
        color: "#7e382d",
        lengthFt: segment.width,
        heightFt: segment.height,
        center: { x: segment.xCenter, y: d + 0.36 + standardBrick.actualDepthFt / 2, z: segment.zCenter },
        orientation: "front-rear",
        source: sources.residentialCode,
        notes: ["Segmented around rear egress door rough openings."]
      } as const;
      calculatedBrickCount += brickCountForWall(rearBrickWall);
      if (renderIndividualBricks) {
        addInstancedBrickWall(components, rearBrickWall);
      }
    }
  }
  addBrickCountSummary(components, calculatedBrickCount);
  addRearExitAndFireEscape(components, config);

  for (let floor = 0; floor <= config.stories; floor += 1) {
    addFloorPlateWithStairOpening(components, config, floor);
  }
  addStairShaftAndRoofOpeningDetails(components, config, buildingHeight);
  addArchitecturalLogicDetails(components, config, buildingHeight);
  addRoofRunoffManagementDetails(components, config, buildingHeight);
  addFireAndThermalAssemblies(components, config, buildingHeight);
  if (config.structuralSupportScheme === "steel-post-beam" || constructionSystem.includesSteelFrame) {
    addSteelSupportSystem(components, config, buildingHeight);
  }
  addRoofSolarArray(components, config, buildingHeight);
  addRoofGarden(components, config, buildingHeight);

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
  components[components.length - 1].object.visible = false;
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
      addAlternatingRunStairEgressBridge(components, run, run * config.storyHeightFt, sources.residentialCode);
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
    attachRealAsset(metadata("living-room-couch", "Living room couch", "interior", "upholstered sofa", sources.plan, 1800), "loungeSofa", "Lounge sofa"),
    "#4f6f77",
    7.0,
    3.0,
    2.2,
    { x: 10.2, y: 13.2, z: 1.1 }
  );
  box(
    components,
    attachRealAsset(metadata("living-room-coffee-table", "Living room coffee table", "interior", "wood coffee table", sources.plan, 450), "tableCoffee", "Coffee table"),
    "#7b5736",
    4.2,
    2.1,
    1.0,
    { x: 10.0, y: 9.2, z: 0.5 }
  );
  box(
    components,
    attachRealAsset(metadata("living-room-tv", "Wall mounted TV", "interior", "television", sources.plan, 900), "televisionModern", "Modern television"),
    "#111315",
    5.0,
    0.16,
    2.8,
    { x: 9.7, y: 3.25, z: 3.8 }
  );
  const fiddleLeafFigMetadata = metadata(
    "living-room-fiddle-leaf-fig",
    "IKEA FEJKA fiddle-leaf fig",
    "interior",
    "IKEA FEJKA artificial potted fiddle-leaf fig",
    sources.plan,
    99,
    true,
    [
      "Buyable product reference: IKEA FEJKA artificial potted plant, indoor/outdoor fiddle-leaf fig, article 805.688.90.",
      "Loaded from a local Draco-compressed GLB asset when runtime product models are available; box geometry remains as fallback."
    ]
  );
  fiddleLeafFigMetadata.realProductModel = {
    url: "/models/ikea-fejka-80568890-fiddle-leaf-fig.glb",
    productUrl: "https://www.ikea.com/us/en/p/fejka-artificial-potted-plant-indoor-outdoor-fiddle-leaf-fig-80568890/",
    brand: "IKEA",
    productName: "FEJKA Artificial potted plant, indoor/outdoor fiddle-leaf fig",
    articleNumber: "805.688.90",
    source: "IKEA product page public 3D GLB asset",
    usageNote: "Use for owner planning/reference in this project; verify IKEA asset terms before redistribution or commercial reuse.",
    replacePlaceholder: true
  };
  box(
    components,
    fiddleLeafFigMetadata,
    "#2e6b3c",
    2.2,
    2.2,
    6.0,
    { x: 3.6, y: 13.6, z: 3.0 }
  );

  for (const [id, name, floor, x, y, rotation] of [
    ["primary-bed", "Primary bed", 1, 11.0, 8.4, 0],
    ["second-bedroom-bed", "Second bedroom bed", 1, 11.0, 37.0, 0],
    ["third-bedroom-bed", "Third floor bed", 2, 11.2, 10.0, 0]
  ] as const) {
    box(
      components,
      attachRealAsset(metadata(id, name, "interior", "bed frame and mattress", sources.plan, 1400), id === "second-bedroom-bed" ? "bedSingle" : "bedDouble", id === "second-bedroom-bed" ? "Single bed" : "Double bed"),
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
    attachRealAsset(metadata("office-desk", "Third floor office desk", "interior", "office desk", sources.plan, 780), "desk", "Desk"),
    "#8b6844",
    4.6,
    2.2,
    2.6,
    { x: 9.5, y: 34.0, z: 2 * config.storyHeightFt + 1.3 }
  );
  box(
    components,
    attachRealAsset(metadata("office-chair", "Third floor office chair", "interior", "desk chair", sources.plan, 360), "chairDesk", "Desk chair"),
    "#59636d",
    2.1,
    2.1,
    3.2,
    { x: 9.5, y: 31.6, z: 2 * config.storyHeightFt + 1.6 }
  );
  box(
    components,
    attachRealAsset(metadata("office-computer-screen", "Third floor office computer screen", "interior", "computer monitor", sources.plan, 260), "computerScreen", "Computer screen"),
    "#111315",
    1.7,
    0.16,
    1.2,
    { x: 9.5, y: 33.0, z: 2 * config.storyHeightFt + 3.0 }
  );
  box(
    components,
    attachRealAsset(metadata("office-keyboard", "Third floor office keyboard", "interior", "computer keyboard", sources.plan, 95), "computerKeyboard", "Computer keyboard"),
    "#262c31",
    1.5,
    0.55,
    0.12,
    { x: 9.5, y: 32.75, z: 2 * config.storyHeightFt + 2.72 }
  );

  box(
    components,
    attachRealAsset(metadata("kitchen-base-cabinets", "Kitchen base cabinets", "interior", "cabinetry", sources.electricalCode, 7600), "kitchenCabinet", "Kitchen cabinet"),
    "#d8ca9c",
    7.0,
    5.5,
    3.2,
    { x: 13.7, y: 7.75, z: 1.6 }
  );
  box(
    components,
    attachRealAsset(metadata("kitchen-island", "Kitchen island", "interior", "cabinetry and countertop", sources.plan, 5200), "kitchenCabinetDrawer", "Kitchen cabinet drawer"),
    "#c3b07a",
    5.8,
    2.8,
    3.0,
    { x: 8.5, y: 39.0, z: 1.5 }
  );
  box(
    components,
    attachRealAsset(metadata("electric-range", "Electric range and oven", "interior", "electric appliance", sources.electricalCode, 2400), "kitchenStoveElectric", "Electric kitchen stove"),
    "#2b3034",
    2.6,
    2.4,
    3.1,
    { x: 15.0, y: 36.2, z: 1.55 }
  );
  const refrigeratorMetadata = metadata(
    "refrigerator",
    "IKEA LAGAN top-freezer refrigerator",
    "interior",
    "IKEA LAGAN 18.0 cu.ft electric refrigerator-freezer appliance",
    sources.electricalCode,
    749,
    true,
    [
      "Buyable product reference: IKEA LAGAN top-freezer refrigerator, article 305.876.26.",
      "Loaded from a local GLB asset when the browser supports runtime product models; box geometry remains as fallback."
    ]
  );
  refrigeratorMetadata.realProductModel = {
    url: "/models/ikea-lagan-30587626-refrigerator.glb",
    productUrl: "https://www.ikea.com/us/en/p/lagan-top-freezer-refrigerator-white-30587626/",
    brand: "IKEA",
    productName: "LAGAN Top-freezer refrigerator, white, 18.0 cu.ft",
    articleNumber: "305.876.26",
    source: "IKEA product page public 3D GLB asset",
    license: "IKEA product asset; verify IKEA terms before redistribution or commercial reuse",
    usageNote: "Use for owner planning/reference in this project; verify IKEA asset terms before redistribution or commercial reuse.",
    replacePlaceholder: true
  };
  box(
    components,
    refrigeratorMetadata,
    "#d7dde0",
    3.0,
    2.8,
    6.7,
    { x: 15.0, y: 42.0, z: 3.35 }
  );
  box(
    components,
    attachRealAsset(metadata("kitchen-sink", "Kitchen sink", "interior", "sink and faucet", sources.plan, 1200), "kitchenSink", "Kitchen sink"),
    "#cbd5d8",
    2.4,
    1.5,
    0.45,
    { x: 12.2, y: 35.4, z: 3.25 }
  );
  addStandardElectricalSystem(components, config, buildingHeight);

  addStandardHvacSystem(components, config, buildingHeight);
  addStandardPlumbingSystem(components, config, buildingHeight);

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
      0.34,
      8.4,
      { x: 1.5, y: -7.7, z: 4 }
    ));
    components.push(makeCylinderComponent(
      metadata("street-tree-canopy", "Street tree canopy", "landscape", "urban tree canopy", sources.completeStreets, 0, false),
      "#2b7135",
      3.25,
      6.4,
      { x: 1.5, y: -7.7, z: 10.9 }
    ));
    const treeModelMetadata = metadata(
      "street-tree-real-model-bounds",
      "Street tree model bounds",
      "landscape",
      "street tree visual asset placement bounds",
      sources.completeStreets,
      0,
      false,
      [
        "Runtime replacement is the local CC0 GLB tree asset.",
        "This placeholder sets the physical scale and position for the imported tree model."
      ]
    );
    treeModelMetadata.realProductModel = {
      url: "/models/cc0/tree_01_art.glb",
      productUrl: "https://github.com/ToxSam/cc0-models-Polygonal-Mind/tree/main/projects/MomusPark",
      brand: "Polygonal Mind",
      productName: "MomusPark Tree_01_Art",
      source: "OpenSource3DAssets / Polygonal Mind CC0 model",
      license: "CC0",
      usageNote: "Free CC0 visual model used as a realistic street-tree replacement.",
      replacePlaceholder: true,
      hideComponentIds: ["street-tree-trunk", "street-tree-canopy"]
    };
    box(
      components,
      treeModelMetadata,
      "#2f6d37",
      7.0,
      7.0,
      14.0,
      { x: 1.5, y: -7.7, z: 7.0 }
    );
  }

  const model: RowhomeModel = {
    name: "Baltimore R-8 Rowhome Concept Model",
    units: "feet",
    components,
    structural: buildStructuralModel(config),
    hierarchy: modelHierarchyForDetailedBuildings(config, components, 1),
    validation: []
  };
  model.validation = validateRowhome(config, model);
  return model;
}

export function generateRowhome(config: RowhomeConfig): RowhomeModel {
  const count = rowhomeCount(config);
  const model = count === 1 ? generateSingleRowhome({ ...config, rowhomeCount: 1 }) : buildRowAssembly(config, count);
  const urbanHierarchy = addCityBlockMassing(model.components, config);
  if (urbanHierarchy) {
    model.hierarchy = urbanHierarchy;
  }
  return model;
}
