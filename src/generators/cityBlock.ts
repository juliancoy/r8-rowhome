import { Matrix4 } from "three";
import type { BuildingInstance, ComponentOwnership, ModelComponent, ModelHierarchy, RowhomeConfig } from "../core/types";
import { selectedConstructionSystem } from "../core/constructionSystems";
import { sources } from "../core/sources";
import { makeBoxComponent, makeInstancedBoxComponent } from "../geometry/component";

export interface CityBlockLayout {
  totalHomes: number;
  blocks: number;
  blockColumns: number;
  blockRows: number;
  homesPerRow: number;
  rowsPerBlock: number;
  alleyWidthFt: number;
  streetWidthFt: number;
  sidewalkWidthFt: number;
  treeLawnWidthFt: number;
  blockWidthFt: number;
  blockDepthFt: number;
}

export function cityBlockLayout(config: RowhomeConfig): CityBlockLayout | null {
  if (config.urbanScale !== "block-32" && config.urbanScale !== "district-128") {
    return null;
  }
  const totalHomes = config.urbanScale === "block-32" ? 32 : 128;
  const homesPerRow = 16;
  const rowsPerBlock = 2;
  const alleyWidthFt = 24;
  const streetWidthFt = 40;
  const sidewalkWidthFt = 10;
  const treeLawnWidthFt = 5;
  const blocks = totalHomes / (homesPerRow * rowsPerBlock);
  const blockColumns = blocks > 1 ? 2 : 1;
  return {
    totalHomes,
    blocks,
    blockColumns,
    blockRows: Math.ceil(blocks / blockColumns),
    homesPerRow,
    rowsPerBlock,
    alleyWidthFt,
    streetWidthFt,
    sidewalkWidthFt,
    treeLawnWidthFt,
    blockWidthFt: homesPerRow * config.buildingWidthFt,
    blockDepthFt: rowsPerBlock * config.buildingDepthFt + alleyWidthFt
  };
}

interface HomePlacement {
  x: number;
  y: number;
  flipped: boolean;
  block: number;
  row: number;
  position: number;
}

function blockOrigin(layout: CityBlockLayout, block: number): { x: number; y: number } {
  const blockCol = block % layout.blockColumns;
  const blockRow = Math.floor(block / layout.blockColumns);
  return {
    x: blockCol * (layout.blockWidthFt + layout.streetWidthFt),
    y: blockRow * (layout.blockDepthFt + layout.streetWidthFt)
  };
}

export function homePlacements(config: RowhomeConfig): HomePlacement[] {
  const layout = cityBlockLayout(config);
  if (!layout) {
    return [];
  }
  const placements: HomePlacement[] = [];
  for (let block = 0; block < layout.blocks; block += 1) {
    const origin = blockOrigin(layout, block);
    for (let row = 0; row < layout.rowsPerBlock; row += 1) {
      const y = origin.y + (row === 0 ? 0 : config.buildingDepthFt + layout.alleyWidthFt);
      for (let position = 0; position < layout.homesPerRow; position += 1) {
        placements.push({
          x: origin.x + position * config.buildingWidthFt,
          y,
          flipped: row === 1,
          block,
          row,
          position
        });
      }
    }
  }
  return placements;
}

function translation(x: number, planY: number, z: number): Matrix4 {
  return new Matrix4().makeTranslation(x, z, planY);
}

function pushBox(
  components: ModelComponent[],
  id: string,
  name: string,
  material: string,
  color: string,
  width: number,
  depth: number,
  height: number,
  center: { x: number; y: number; z: number },
  notes: string[] = [],
  ownership?: ComponentOwnership
): void {
  const meta = {
    id,
    name,
    category: "site" as const,
    material,
    source: sources.r8,
    estimatedCostUsd: 0,
    printable: false,
    notes,
    ownership
  };
  components.push(makeBoxComponent(meta, color, width, depth, height, center));
}

function pushInstancedBox(
  components: ModelComponent[],
  id: string,
  name: string,
  material: string,
  color: string,
  width: number,
  depth: number,
  height: number,
  transforms: Matrix4[],
  notes: string[],
  ownership?: ComponentOwnership
): void {
  if (transforms.length === 0) {
    return;
  }
  const meta = {
    id,
    name,
    category: "site" as const,
    material,
    source: sources.r8,
    estimatedCostUsd: 0,
    printable: false,
    notes,
    ownership
  };
  components.push(makeInstancedBoxComponent(meta, color, width, depth, height, transforms, { cast: true, receive: true }));
}

function buildingInstanceId(placement: HomePlacement): string {
  return `block-${placement.block + 1}-row-${placement.row + 1}-house-${placement.position + 1}`;
}

function buildingInstancesForPlacements(config: RowhomeConfig, placements: HomePlacement[], componentIds: string[]): BuildingInstance[] {
  return placements.map((placement) => ({
    id: buildingInstanceId(placement),
    block: placement.block + 1,
    row: placement.row + 1,
    position: placement.position + 1,
    xFt: placement.x,
    yFt: placement.y,
    widthFt: config.buildingWidthFt,
    depthFt: config.buildingDepthFt,
    flipped: placement.flipped,
    componentIds
  }));
}

function urbanBuildingOwnership(role: string, buildingInstanceIds: string[], replicatedFromComponentIds: string[] = []): ComponentOwnership {
  return {
    scope: "urban-building-instances",
    role,
    buildingInstanceIds,
    replicatedFromComponentIds
  };
}

function urbanContextOwnership(role: string): ComponentOwnership {
  return { scope: "urban-context", role };
}

function addCityBlockGroundPlane(components: ModelComponent[], config: RowhomeConfig, layout: CityBlockLayout): void {
  const districtWidth = layout.blockColumns * layout.blockWidthFt + (layout.blockColumns - 1) * layout.streetWidthFt;
  const districtDepth = layout.blockRows * layout.blockDepthFt + (layout.blockRows - 1) * layout.streetWidthFt;
  const margin = layout.streetWidthFt / 2 + layout.sidewalkWidthFt + layout.treeLawnWidthFt;
  const notes = [
    "Urban-scale site reads as a rowhouse block: asphalt street grid, continuous sidewalks, rear service alleys, narrow lots, stoops, street trees, lights, crosswalks, and repeated facades.",
    "All block-scale context is schematic and zero-cost; the detailed unit remains the cost and permit basis."
  ];

  pushBox(
    components,
    "city-block-ground-plane",
    "City block neighborhood ground plane",
    "schematic neighborhood ground plane",
    "#516c4a",
    districtWidth + margin * 2,
    districtDepth + margin * 2,
    0.08,
    { x: districtWidth / 2, y: districtDepth / 2, z: -0.18 },
    notes
  );

  for (let col = 0; col < layout.blockColumns - 1; col += 1) {
    const x = (col + 1) * layout.blockWidthFt + col * layout.streetWidthFt + layout.streetWidthFt / 2;
    pushBox(
      components,
      `city-block-north-south-street-${col + 1}`,
      `North-south street ${col + 1}`,
      "asphalt street with centerline",
      "#34383c",
      layout.streetWidthFt,
      districtDepth + margin * 2,
      0.12,
      { x, y: districtDepth / 2, z: -0.08 },
      notes
    );
    pushBox(
      components,
      `city-block-north-south-centerline-${col + 1}`,
      `North-south street centerline ${col + 1}`,
      "double-yellow street marking",
      "#d7b92d",
      0.34,
      districtDepth + margin * 1.4,
      0.035,
      { x, y: districtDepth / 2, z: 0.02 },
      notes
    );
  }

  for (let row = 0; row < layout.blockRows - 1; row += 1) {
    const y = (row + 1) * layout.blockDepthFt + row * layout.streetWidthFt + layout.streetWidthFt / 2;
    pushBox(
      components,
      `city-block-east-west-street-${row + 1}`,
      `East-west street ${row + 1}`,
      "asphalt street with centerline",
      "#34383c",
      districtWidth + margin * 2,
      layout.streetWidthFt,
      0.12,
      { x: districtWidth / 2, y, z: -0.08 },
      notes
    );
    pushBox(
      components,
      `city-block-east-west-centerline-${row + 1}`,
      `East-west street centerline ${row + 1}`,
      "double-yellow street marking",
      "#d7b92d",
      districtWidth + margin * 1.4,
      0.34,
      0.035,
      { x: districtWidth / 2, y, z: 0.02 },
      notes
    );
  }
}

function addBlockStreetEdges(
  components: ModelComponent[],
  layout: CityBlockLayout,
  block: number,
  origin: { x: number; y: number },
  notes: string[]
): void {
  const roadOffset = layout.sidewalkWidthFt + layout.streetWidthFt / 2;
  const frontRoadY = origin.y - roadOffset;
  const backRoadY = origin.y + layout.blockDepthFt + roadOffset;
  const leftRoadX = origin.x - roadOffset;
  const rightRoadX = origin.x + layout.blockWidthFt + roadOffset;
  const roadLengthX = layout.blockWidthFt + layout.streetWidthFt * 2;
  const roadLengthY = layout.blockDepthFt + layout.streetWidthFt * 2;
  const blockId = block + 1;

  pushBox(components, `city-block-front-street-${blockId}`, `City block front street ${blockId}`, "asphalt perimeter street", "#34383c", roadLengthX, layout.streetWidthFt, 0.12, { x: origin.x + layout.blockWidthFt / 2, y: frontRoadY, z: -0.07 }, notes);
  pushBox(components, `city-block-back-street-${blockId}`, `City block back street ${blockId}`, "asphalt perimeter street", "#34383c", roadLengthX, layout.streetWidthFt, 0.12, { x: origin.x + layout.blockWidthFt / 2, y: backRoadY, z: -0.07 }, notes);
  pushBox(components, `city-block-left-street-${blockId}`, `City block left side street ${blockId}`, "asphalt perimeter street", "#34383c", layout.streetWidthFt, roadLengthY, 0.12, { x: leftRoadX, y: origin.y + layout.blockDepthFt / 2, z: -0.07 }, notes);
  pushBox(components, `city-block-right-street-${blockId}`, `City block right side street ${blockId}`, "asphalt perimeter street", "#34383c", layout.streetWidthFt, roadLengthY, 0.12, { x: rightRoadX, y: origin.y + layout.blockDepthFt / 2, z: -0.07 }, notes);

  pushBox(components, `city-block-front-street-centerline-${blockId}`, `City block front street centerline ${blockId}`, "double-yellow street marking", "#d7b92d", roadLengthX - 8, 0.28, 0.035, { x: origin.x + layout.blockWidthFt / 2, y: frontRoadY, z: 0.02 }, notes);
  pushBox(components, `city-block-back-street-centerline-${blockId}`, `City block back street centerline ${blockId}`, "double-yellow street marking", "#d7b92d", roadLengthX - 8, 0.28, 0.035, { x: origin.x + layout.blockWidthFt / 2, y: backRoadY, z: 0.02 }, notes);
  pushBox(components, `city-block-left-street-centerline-${blockId}`, `City block left side street centerline ${blockId}`, "double-yellow street marking", "#d7b92d", 0.28, roadLengthY - 8, 0.035, { x: leftRoadX, y: origin.y + layout.blockDepthFt / 2, z: 0.02 }, notes);
  pushBox(components, `city-block-right-street-centerline-${blockId}`, `City block right side street centerline ${blockId}`, "double-yellow street marking", "#d7b92d", 0.28, roadLengthY - 8, 0.035, { x: rightRoadX, y: origin.y + layout.blockDepthFt / 2, z: 0.02 }, notes);

  const crosswalks = [
    { id: "front-left", x: origin.x - layout.sidewalkWidthFt / 2, y: frontRoadY, width: 2.2, depth: layout.streetWidthFt - 8 },
    { id: "front-right", x: origin.x + layout.blockWidthFt + layout.sidewalkWidthFt / 2, y: frontRoadY, width: 2.2, depth: layout.streetWidthFt - 8 },
    { id: "back-left", x: origin.x - layout.sidewalkWidthFt / 2, y: backRoadY, width: 2.2, depth: layout.streetWidthFt - 8 },
    { id: "back-right", x: origin.x + layout.blockWidthFt + layout.sidewalkWidthFt / 2, y: backRoadY, width: 2.2, depth: layout.streetWidthFt - 8 },
    { id: "left-front", x: leftRoadX, y: origin.y - layout.sidewalkWidthFt / 2, width: layout.streetWidthFt - 8, depth: 2.2 },
    { id: "left-back", x: leftRoadX, y: origin.y + layout.blockDepthFt + layout.sidewalkWidthFt / 2, width: layout.streetWidthFt - 8, depth: 2.2 },
    { id: "right-front", x: rightRoadX, y: origin.y - layout.sidewalkWidthFt / 2, width: layout.streetWidthFt - 8, depth: 2.2 },
    { id: "right-back", x: rightRoadX, y: origin.y + layout.blockDepthFt + layout.sidewalkWidthFt / 2, width: layout.streetWidthFt - 8, depth: 2.2 }
  ];
  for (const crosswalk of crosswalks) {
    pushBox(components, `city-block-crosswalk-${blockId}-${crosswalk.id}`, `City block crosswalk ${blockId} ${crosswalk.id}`, "thermoplastic crosswalk marking", "#f4f2e8", crosswalk.width, crosswalk.depth, 0.035, { x: crosswalk.x, y: crosswalk.y, z: 0.03 }, notes);
  }
}

function hideDetailedModelForUniformUrbanScale(components: ModelComponent[]): void {
  for (const component of components) {
    component.object.userData.forceHiddenInUrbanScale = true;
    component.object.visible = false;
  }
}

/**
 * Adds uniform instanced massing for the city block or district. The detailed
 * rowhome remains in the model for cost, validation, and export metadata, but
 * is hidden in urban-scale views so every visible house in every block uses the
 * same exterior kit and reads as the same rowhome design.
 */
export function addCityBlockMassing(components: ModelComponent[], config: RowhomeConfig): ModelHierarchy | null {
  const layout = cityBlockLayout(config);
  if (!layout) {
    return null;
  }
  const system = selectedConstructionSystem(config);
  const detailedHomes = Math.max(1, Math.min(6, Math.round(config.rowhomeCount || 1)));
  const allPlacements = homePlacements(config);
  const placements = allPlacements;
  if (placements.length === 0) {
    return null;
  }

  const hiddenDetailedComponentIds = components.map((component) => component.metadata.id);
  hideDetailedModelForUniformUrbanScale(components);
  addCityBlockGroundPlane(components, config, layout);

  const buildingHeight = config.stories * config.storyHeightFt;
  const shellTransforms: Matrix4[] = [];
  const solarTransforms: Matrix4[] = [];
  const parapetTransforms: Matrix4[] = [];
  const stoopTransforms: Matrix4[] = [];
  const doorTransforms: Matrix4[] = [];
  const windowTransforms: Matrix4[] = [];
  const windowFrameTransforms: Matrix4[] = [];
  const sideWallTransforms: Matrix4[] = [];
  const rearDoorTransforms: Matrix4[] = [];
  const rearWindowTransforms: Matrix4[] = [];
  const rearWindowFrameTransforms: Matrix4[] = [];
  const partyLineTransforms: Matrix4[] = [];
  const corniceTransforms: Matrix4[] = [];
  const roofColorTransforms: Matrix4[] = [];
  const treeTrunkTransforms: Matrix4[] = [];
  const treeCanopyTransforms: Matrix4[] = [];
  const lampPostTransforms: Matrix4[] = [];
  const lampHeadTransforms: Matrix4[] = [];
  const personTorsoTransforms: Matrix4[] = [];
  const personHeadTransforms: Matrix4[] = [];
  const personLegTransforms: Matrix4[] = [];
  const hvacCondenserTransforms: Matrix4[] = [];
  const hvacDisconnectTransforms: Matrix4[] = [];
  const electricalMeterTransforms: Matrix4[] = [];
  const electricalServiceMastTransforms: Matrix4[] = [];
  const fireEscapePlatformTransforms: Matrix4[] = [];
  const fireEscapeRailTransforms: Matrix4[] = [];
  const fireEscapeLadderTransforms: Matrix4[] = [];
  const buildingInstanceIds = placements.map(buildingInstanceId);
  const perHouseComponentIds = [
    "city-block-massing-shells",
    "city-block-massing-roof-plates",
    "city-block-massing-solar",
    "city-block-party-wall-score-lines",
    "city-block-parapet-caps",
    "city-block-cornice-bands",
    "city-block-stoops",
    "city-block-front-doors",
    "city-block-window-frames",
    "city-block-window-rhythm",
    "city-block-side-walls",
    "city-block-rear-doors",
    "city-block-rear-window-frames",
    "city-block-rear-window-rhythm",
    "city-block-street-tree-trunks",
    "city-block-street-tree-canopies",
    "city-block-street-light-posts",
    "city-block-street-light-heads",
    "city-block-scale-person-legs",
    "city-block-scale-person-torsos",
    "city-block-scale-person-heads",
    "city-block-hvac-condensers",
    "city-block-hvac-disconnects",
    "city-block-electrical-meter-sockets",
    "city-block-electrical-service-masts",
    "city-block-fire-escape-platforms",
    "city-block-fire-escape-rails",
    "city-block-fire-escape-ladders"
  ];

  placements.forEach((placement, index) => {
    const frontY = placement.flipped ? placement.y + config.buildingDepthFt : placement.y;
    const frontSign = placement.flipped ? 1 : -1;
    shellTransforms.push(translation(
      placement.x + config.buildingWidthFt / 2,
      placement.y + config.buildingDepthFt / 2,
      buildingHeight / 2
    ));
    solarTransforms.push(translation(
      placement.x + config.buildingWidthFt / 2,
      placement.y + config.buildingDepthFt / 2,
      buildingHeight + 0.4
    ));
    roofColorTransforms.push(translation(
      placement.x + config.buildingWidthFt / 2,
      placement.y + config.buildingDepthFt / 2,
      buildingHeight + 0.14
    ));
    for (const x of [placement.x + 0.3, placement.x + config.buildingWidthFt - 0.3]) {
      partyLineTransforms.push(translation(x, placement.y + config.buildingDepthFt / 2, buildingHeight / 2));
    }
    sideWallTransforms.push(translation(placement.x + 0.18, placement.y + config.buildingDepthFt / 2, buildingHeight / 2));
    sideWallTransforms.push(translation(placement.x + config.buildingWidthFt - 0.18, placement.y + config.buildingDepthFt / 2, buildingHeight / 2));
    for (const y of [placement.y + 0.35, placement.y + config.buildingDepthFt - 0.35]) {
      parapetTransforms.push(translation(placement.x + config.buildingWidthFt / 2, y, buildingHeight + 1.0));
    }
    corniceTransforms.push(translation(placement.x + config.buildingWidthFt / 2, frontY + frontSign * 0.12, buildingHeight - 0.55));
    stoopTransforms.push(translation(placement.x + config.buildingWidthFt / 2, frontY + frontSign * 2.1, 0.18));
    doorTransforms.push(translation(placement.x + config.buildingWidthFt / 2, frontY + frontSign * 0.18, 4.0));
    const rearY = placement.flipped ? placement.y : placement.y + config.buildingDepthFt;
    const rearSign = placement.flipped ? -1 : 1;
    rearDoorTransforms.push(translation(placement.x + config.buildingWidthFt / 2, rearY + rearSign * 0.18, 3.8));
    hvacCondenserTransforms.push(translation(placement.x + config.buildingWidthFt - 2.8, rearY + rearSign * 4.8, 1.4));
    hvacDisconnectTransforms.push(translation(placement.x + config.buildingWidthFt - 1.2, rearY + rearSign * 0.22, 5.2));
    electricalMeterTransforms.push(translation(placement.x + 1.15, rearY + rearSign * 0.22, 4.8));
    electricalServiceMastTransforms.push(translation(placement.x + 1.15, rearY + rearSign * 0.18, buildingHeight - 2.4));
    const fireEscapeX = placement.x + config.buildingWidthFt / 2;
    const fireEscapeY = rearY + rearSign * 2.1;
    fireEscapeLadderTransforms.push(translation(fireEscapeX - 3.0, rearY + rearSign * 1.85, buildingHeight / 2));
    for (let story = 1; story < config.stories; story += 1) {
      const platformZ = story * config.storyHeightFt + 1.4;
      fireEscapePlatformTransforms.push(translation(fireEscapeX, fireEscapeY, platformZ));
      fireEscapeRailTransforms.push(translation(fireEscapeX, fireEscapeY + rearSign * 1.45, platformZ + 1.7));
    }
    for (let story = 0; story < config.stories; story += 1) {
      const z = story * config.storyHeightFt + 6.0;
      for (const x of [placement.x + 4.2, placement.x + config.buildingWidthFt - 4.2]) {
        windowFrameTransforms.push(translation(x, frontY + frontSign * 0.34, z));
        windowTransforms.push(translation(x, frontY + frontSign * 0.5, z));
        rearWindowFrameTransforms.push(translation(x, rearY + rearSign * 0.34, z));
        rearWindowTransforms.push(translation(x, rearY + rearSign * 0.5, z));
      }
    }
    const treeX = placement.x + config.buildingWidthFt / 2;
    const treeY = frontY + frontSign * (layout.sidewalkWidthFt + 5.5);
    treeTrunkTransforms.push(translation(treeX, treeY, 4.0));
    treeCanopyTransforms.push(translation(treeX, treeY, 10.0));
    const lampX = placement.x + config.buildingWidthFt - 1.2;
    const lampY = frontY + frontSign * (layout.sidewalkWidthFt + 3.0);
    lampPostTransforms.push(translation(lampX, lampY, 7.0));
    lampHeadTransforms.push(translation(lampX + 0.8, lampY, 13.0));
  });

  allPlacements.forEach((placement, index) => {
    const frontY = placement.flipped ? placement.y + config.buildingDepthFt : placement.y;
    const frontSign = placement.flipped ? 1 : -1;
    const personX = placement.x + config.buildingWidthFt / 2 + (index % 8 === 0 ? -1.4 : 1.4);
    const personY = frontY + frontSign * 6.0;
    personLegTransforms.push(translation(personX - 0.18, personY, 1.15));
    personLegTransforms.push(translation(personX + 0.18, personY, 1.15));
    personTorsoTransforms.push(translation(personX, personY, 3.1));
    personHeadTransforms.push(translation(personX, personY, 4.95));
  });

  const massingNotes = [
    `Urban scale ${config.urbanScale}: ${layout.totalHomes} visible homes across ${layout.blocks} block(s), all rendered from the same instanced exterior kit; ${detailedHomes} detailed unit(s) remain hidden for cost and validation basis.`,
    "Block layout: two rows of sixteen homes back to back across a rear alley, facing opposite streets, with sidewalks and street gaps between blocks.",
    "Facade rhythm includes stoops, doors, windows, party-wall score lines, parapets, cornices, roof plates, trees, street lights, and scale people so the block reads as Baltimore rowhouse fabric rather than anonymous building bars.",
    "Replicated houses include schematic HVAC, electrical service, and rear fire-escape elements so urban-scale ownership matches the whole building, not only the facade shell.",
    "Each massing roof carries a solar plate consistent with the all-electric, solar-powered block program.",
    "Massing instances carry zero cost; per-home BOM, statement of work, and pro forma derive from the detailed unit.",
    "Structural, MEP, and validation models cover the detailed unit only."
  ];

  pushInstancedBox(components, "city-block-massing-shells", `City block massing shells (${placements.length} instanced homes)`, "instanced brick rowhome massing shell", system.partyWall.color, config.buildingWidthFt - 0.6, config.buildingDepthFt, buildingHeight, shellTransforms, massingNotes, urbanBuildingOwnership("shell", buildingInstanceIds, ["party-wall-left", "party-wall-right", "front-facade", "rear-wall"]));
  pushInstancedBox(components, "city-block-massing-roof-plates", `City block uniform flat roof plates (${placements.length} instanced)`, "instanced rowhome flat roof surface", "#50565a", config.buildingWidthFt - 1.4, config.buildingDepthFt - 2.2, 0.24, roofColorTransforms, massingNotes, urbanBuildingOwnership("roof-plate", buildingInstanceIds, ["floor-plate-3", "roof-insulation-and-air-barrier"]));
  pushInstancedBox(components, "city-block-massing-solar", `City block massing rooftop solar plates (${placements.length} instanced)`, "instanced rooftop solar massing plate", "#1c2f47", config.buildingWidthFt - 4, config.buildingDepthFt - 10, 0.4, solarTransforms, massingNotes, urbanBuildingOwnership("roof-solar", buildingInstanceIds, ["roof-solar-panel"]));
  pushInstancedBox(components, "city-block-party-wall-score-lines", "City block party-wall score lines", "masonry party-wall reveal lines", "#6b2d24", 0.14, config.buildingDepthFt + 0.2, buildingHeight + 0.3, partyLineTransforms, massingNotes, urbanBuildingOwnership("party-wall-reveals", buildingInstanceIds, ["party-wall-left", "party-wall-right"]));
  pushInstancedBox(components, "city-block-parapet-caps", "City block front and rear parapet caps", "rowhouse parapet coping", "#c9c0ad", config.buildingWidthFt - 0.8, 0.35, 1.2, parapetTransforms, massingNotes, urbanBuildingOwnership("parapet-caps", buildingInstanceIds, ["front-parapet"]));
  pushInstancedBox(components, "city-block-cornice-bands", "City block cornice bands", "pressed-metal rowhouse cornice", "#2d3437", config.buildingWidthFt - 1.0, 0.18, 0.65, corniceTransforms, massingNotes, urbanBuildingOwnership("cornice", buildingInstanceIds, ["cornice", "deep-cornice-cap"]));
  pushInstancedBox(components, "city-block-stoops", "City block repeated front stoops", "concrete stoops and landings", "#aaa79e", 5.0, 3.0, 0.36, stoopTransforms, massingNotes, urbanBuildingOwnership("stoop", buildingInstanceIds, ["stoop"]));
  pushInstancedBox(components, "city-block-front-doors", "City block repeated entry doors", "painted rowhouse entry doors", "#26323d", 3.1, 0.12, 7.2, doorTransforms, massingNotes, urbanBuildingOwnership("front-door", buildingInstanceIds, ["front-door"]));
  pushInstancedBox(components, "city-block-window-frames", "City block repeated front window stone frames", "light stone window frames and lintel surrounds", "#d2c7ae", 3.9, 0.18, 5.2, windowFrameTransforms, massingNotes, urbanBuildingOwnership("front-window-frames", buildingInstanceIds, ["lintel-left-1", "stone-sill-left-1", "lintel-right-1", "stone-sill-right-1"]));
  pushInstancedBox(components, "city-block-window-rhythm", "City block repeated front window glass", "blue glazed rowhouse windows", "#6faed0", 3.0, 0.22, 4.2, windowTransforms, massingNotes, urbanBuildingOwnership("front-window-glass", buildingInstanceIds, ["front-window-left-1", "front-window-right-1"]));
  pushInstancedBox(components, "city-block-side-walls", "City block repeated side walls", "instanced brick rowhome side walls", system.partyWall.color, 0.36, config.buildingDepthFt, buildingHeight, sideWallTransforms, massingNotes, urbanBuildingOwnership("side-walls", buildingInstanceIds, ["party-wall-left", "party-wall-right"]));
  pushInstancedBox(components, "city-block-rear-doors", "City block repeated rear doors", "painted rear egress doors", "#26323d", 3.0, 0.12, 6.8, rearDoorTransforms, massingNotes, urbanBuildingOwnership("rear-door", buildingInstanceIds, ["rear-exit-door-1"]));
  pushInstancedBox(components, "city-block-rear-window-frames", "City block repeated rear window stone frames", "light stone rear window frames and lintel surrounds", "#d2c7ae", 3.7, 0.18, 4.9, rearWindowFrameTransforms, massingNotes, urbanBuildingOwnership("rear-window-frames", buildingInstanceIds, ["rear-wall"]));
  pushInstancedBox(components, "city-block-rear-window-rhythm", "City block repeated rear window glass", "blue glazed rear windows", "#6faed0", 2.8, 0.22, 3.9, rearWindowTransforms, massingNotes, urbanBuildingOwnership("rear-window-glass", buildingInstanceIds, ["rear-wall"]));
  pushInstancedBox(components, "city-block-street-tree-trunks", "City block street tree trunks", "street tree trunks", "#705034", 0.55, 0.55, 8.0, treeTrunkTransforms, massingNotes, urbanBuildingOwnership("street-tree-trunk", buildingInstanceIds, ["street-tree-trunk"]));
  pushInstancedBox(components, "city-block-street-tree-canopies", "City block street tree canopies", "street tree canopy cubes", "#2f6a38", 5.5, 5.5, 5.2, treeCanopyTransforms, massingNotes, urbanBuildingOwnership("street-tree-canopy", buildingInstanceIds, ["street-tree-canopy"]));
  pushInstancedBox(components, "city-block-street-light-posts", "City block street light posts", "painted steel street light poles", "#74797d", 0.28, 0.28, 14.0, lampPostTransforms, massingNotes, urbanBuildingOwnership("street-light-post", buildingInstanceIds, ["street-light-post-corner-nw"]));
  pushInstancedBox(components, "city-block-street-light-heads", "City block street light heads", "LED cobra-head luminaires", "#1d2124", 1.4, 0.55, 0.45, lampHeadTransforms, massingNotes, urbanBuildingOwnership("street-light-head", buildingInstanceIds, ["street-light-head-corner-nw"]));
  pushInstancedBox(components, "city-block-scale-person-legs", "City block instanced scale-person legs", "schematic dummy person scale reference", "#25313a", 0.18, 0.18, 2.2, personLegTransforms, massingNotes, urbanBuildingOwnership("scale-person-legs", buildingInstanceIds, ["house-scale-person-legs"]));
  pushInstancedBox(components, "city-block-scale-person-torsos", "City block instanced scale-person torsos", "schematic dummy person scale reference", "#2f6f91", 0.7, 0.32, 1.65, personTorsoTransforms, massingNotes, urbanBuildingOwnership("scale-person-torso", buildingInstanceIds, ["house-scale-person-torsos"]));
  pushInstancedBox(components, "city-block-scale-person-heads", "City block instanced scale-person heads", "schematic dummy person scale reference", "#b98660", 0.5, 0.5, 0.5, personHeadTransforms, massingNotes, urbanBuildingOwnership("scale-person-head", buildingInstanceIds, ["house-scale-person-heads"]));
  pushInstancedBox(components, "city-block-hvac-condensers", "City block repeated HVAC condensers", "schematic HVAC condenser units", "#3c4a51", 2.6, 2.6, 2.4, hvacCondenserTransforms, massingNotes, urbanBuildingOwnership("hvac-condenser", buildingInstanceIds, ["central-ac-condenser", "condenser-pad"]));
  pushInstancedBox(components, "city-block-hvac-disconnects", "City block repeated HVAC disconnects", "schematic HVAC electrical disconnects", "#d8d0b8", 0.75, 0.12, 1.15, hvacDisconnectTransforms, massingNotes, urbanBuildingOwnership("hvac-disconnect", buildingInstanceIds, ["central-ac-disconnect"]));
  pushInstancedBox(components, "city-block-electrical-meter-sockets", "City block repeated electrical meter sockets", "schematic electrical meter sockets", "#c7ccd0", 0.85, 0.16, 1.1, electricalMeterTransforms, massingNotes, urbanBuildingOwnership("electrical-meter", buildingInstanceIds, ["meter-socket"]));
  pushInstancedBox(components, "city-block-electrical-service-masts", "City block repeated electrical service masts", "schematic electrical service masts", "#52595f", 0.18, 0.18, 5.2, electricalServiceMastTransforms, massingNotes, urbanBuildingOwnership("electrical-service-mast", buildingInstanceIds, ["service-mast"]));
  pushInstancedBox(components, "city-block-fire-escape-platforms", "City block repeated rear fire-escape platforms", "schematic steel fire-escape platforms", "#596165", 7.2, 3.0, 0.22, fireEscapePlatformTransforms, massingNotes, urbanBuildingOwnership("fire-escape-platform", buildingInstanceIds, ["fire-escape-platform-2", "fire-escape-platform-3"]));
  pushInstancedBox(components, "city-block-fire-escape-rails", "City block repeated rear fire-escape rails", "schematic steel fire-escape guardrails", "#353b3f", 7.4, 0.16, 1.35, fireEscapeRailTransforms, massingNotes, urbanBuildingOwnership("fire-escape-rail", buildingInstanceIds, ["fire-escape-platform-2-rear-guard", "fire-escape-platform-3-rear-guard"]));
  pushInstancedBox(components, "city-block-fire-escape-ladders", "City block repeated rear fire-escape ladders", "schematic steel fire-escape ladders", "#2d3337", 0.34, 0.18, Math.max(config.storyHeightFt, buildingHeight - config.storyHeightFt), fireEscapeLadderTransforms, massingNotes, urbanBuildingOwnership("fire-escape-ladder", buildingInstanceIds, ["fire-escape-stair-1-upper", "fire-escape-stair-2-upper"]));

  for (let block = 0; block < layout.blocks; block += 1) {
    const origin = blockOrigin(layout, block);
    const blockNotes = [
      "Parcel covering one 32-home block; assessed value derives from the per-home pro forma in the investor dashboard.",
      "Run npm run investor:dashboard for the current parcel assessment and market-circle comparison.",
      "Parcel includes street-facing sidewalks, narrow rowhouse lots, and a rear service alley to make the city-block scale legible."
    ];
    addBlockStreetEdges(components, layout, block, origin, blockNotes);
    pushBox(components, `city-block-parcel-${block + 1}`, `City block parcel ${block + 1} (32 homes)`, "assessed city-block parcel", "#3d4a3f", layout.blockWidthFt + 8, layout.blockDepthFt + 8, 0.08, { x: origin.x + layout.blockWidthFt / 2, y: origin.y + layout.blockDepthFt / 2, z: -0.12 }, blockNotes, urbanContextOwnership("parcel"));
    pushBox(components, `city-block-rear-alley-${block + 1}`, `City block rear service alley ${block + 1}`, "asphalt rear service alley", "#303336", layout.blockWidthFt + 10, layout.alleyWidthFt, 0.11, { x: origin.x + layout.blockWidthFt / 2, y: origin.y + config.buildingDepthFt + layout.alleyWidthFt / 2, z: -0.04 }, blockNotes, urbanContextOwnership("rear-alley"));
    pushBox(components, `city-block-front-sidewalk-${block + 1}`, `City block front sidewalk ${block + 1}`, "continuous concrete sidewalk", "#b7b5af", layout.blockWidthFt + 10, layout.sidewalkWidthFt, 0.14, { x: origin.x + layout.blockWidthFt / 2, y: origin.y - layout.sidewalkWidthFt / 2, z: 0.0 }, blockNotes, urbanContextOwnership("front-sidewalk"));
    pushBox(components, `city-block-back-sidewalk-${block + 1}`, `City block back sidewalk ${block + 1}`, "continuous concrete sidewalk", "#b7b5af", layout.blockWidthFt + 10, layout.sidewalkWidthFt, 0.14, { x: origin.x + layout.blockWidthFt / 2, y: origin.y + layout.blockDepthFt + layout.sidewalkWidthFt / 2, z: 0.0 }, blockNotes, urbanContextOwnership("back-sidewalk"));
    for (let lot = 1; lot < layout.homesPerRow; lot += 1) {
      pushBox(components, `city-block-lot-line-${block + 1}-${lot}`, `City block parcel lot line ${block + 1}.${lot}`, "narrow rowhouse lot line", "#67765d", 0.08, layout.blockDepthFt, 0.035, { x: origin.x + lot * config.buildingWidthFt, y: origin.y + layout.blockDepthFt / 2, z: 0.05 }, blockNotes, urbanContextOwnership("lot-line"));
    }
  }

  return {
    mode: "urban-block",
    buildingInstances: buildingInstancesForPlacements(config, placements, perHouseComponentIds),
    hiddenDetailedComponentIds,
    notes: [
      "Urban-scale visible buildings are complete replicated building instances.",
      "Each building instance references the same per-house instanced component ids; instance index aligns with buildingInstances order.",
      "Detailed single-building components remain in the model but are hidden in urban-scale view for a uniform block representation."
    ]
  };
}
