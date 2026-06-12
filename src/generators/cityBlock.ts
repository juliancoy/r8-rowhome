import { BoxGeometry, InstancedMesh, Matrix4, Mesh, MeshLambertMaterial } from "three";
import type { ModelComponent, RowhomeConfig } from "../core/types";
import { selectedConstructionSystem } from "../core/constructionSystems";
import { sources } from "../core/sources";

export interface CityBlockLayout {
  totalHomes: number;
  blocks: number;
  blockColumns: number;
  homesPerRow: number;
  rowsPerBlock: number;
  alleyWidthFt: number;
  streetWidthFt: number;
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
  const blocks = totalHomes / (homesPerRow * rowsPerBlock);
  return {
    totalHomes,
    blocks,
    blockColumns: blocks > 1 ? 2 : 1,
    homesPerRow,
    rowsPerBlock,
    alleyWidthFt,
    streetWidthFt,
    blockWidthFt: homesPerRow * config.buildingWidthFt,
    blockDepthFt: rowsPerBlock * config.buildingDepthFt + alleyWidthFt
  };
}

interface HomePlacement {
  x: number;
  y: number;
  flipped: boolean;
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
          flipped: row === 1
        });
      }
    }
  }
  return placements;
}

/**
 * Adds instanced massing for the city block or district: every home beyond the
 * detailed row is one InstancedMesh instance (shell plus rooftop solar plate),
 * arranged two rows of sixteen back to back across a rear alley per block, with
 * street gaps between blocks. The detailed rowhome(s) stand in for unit design;
 * massing instances carry no cost so BOM, SOW, and pro forma stay per-home based.
 */
export function addCityBlockMassing(components: ModelComponent[], config: RowhomeConfig): void {
  const layout = cityBlockLayout(config);
  if (!layout) {
    return;
  }
  const system = selectedConstructionSystem(config);
  const detailedHomes = Math.max(1, Math.min(6, Math.round(config.rowhomeCount || 1)));
  const placements = homePlacements(config).slice(detailedHomes);
  if (placements.length === 0) {
    return;
  }

  const buildingHeight = config.stories * config.storyHeightFt;
  const shellGeometry = new BoxGeometry(1, 1, 1);
  const shellMaterial = new MeshLambertMaterial({ color: system.partyWall.color });
  const shells = new InstancedMesh(shellGeometry, shellMaterial, placements.length);
  const solarMaterial = new MeshLambertMaterial({ color: "#1c2f47" });
  const solarPlates = new InstancedMesh(shellGeometry, solarMaterial, placements.length);

  // setMatrixAt copies the values into the instance buffer, so one scratch matrix serves every instance.
  const matrix = new Matrix4();
  placements.forEach((placement, index) => {
    matrix.makeScale(config.buildingWidthFt - 0.6, config.buildingDepthFt, buildingHeight);
    matrix.setPosition(
      placement.x + config.buildingWidthFt / 2,
      placement.y + config.buildingDepthFt / 2,
      buildingHeight / 2
    );
    shells.setMatrixAt(index, matrix);
    matrix.makeScale(config.buildingWidthFt - 4, config.buildingDepthFt - 10, 0.4);
    matrix.setPosition(
      placement.x + config.buildingWidthFt / 2,
      placement.y + config.buildingDepthFt / 2,
      buildingHeight + 0.4
    );
    solarPlates.setMatrixAt(index, matrix);
  });
  shells.instanceMatrix.needsUpdate = true;
  solarPlates.instanceMatrix.needsUpdate = true;

  const massingNotes = [
    `Urban scale ${config.urbanScale}: ${layout.totalHomes} homes total across ${layout.blocks} block(s); ${detailedHomes} fully detailed, ${placements.length} instanced massing shells.`,
    "Block layout: two rows of sixteen homes back to back across a rear alley, facing opposite streets, with street gaps between blocks.",
    "Each massing roof carries a solar plate consistent with the all-electric, solar-powered block program.",
    "Massing instances carry zero cost; per-home BOM, statement of work, and pro forma derive from the detailed unit.",
    "Structural, MEP, and validation models cover the detailed unit only."
  ];

  const shellsMetadata = {
    id: "city-block-massing-shells",
    name: `City block massing shells (${placements.length} instanced homes)`,
    category: "site" as const,
    material: "instanced rowhome massing shell",
    source: sources.r8,
    estimatedCostUsd: 0,
    printable: false,
    notes: massingNotes
  };
  shells.userData = shellsMetadata;
  components.push({ metadata: shellsMetadata, object: shells });

  const solarMetadata = {
    id: "city-block-massing-solar",
    name: `City block massing rooftop solar plates (${placements.length} instanced)`,
    category: "site" as const,
    material: "instanced rooftop solar massing plate",
    source: sources.r8,
    estimatedCostUsd: 0,
    printable: false,
    notes: massingNotes
  };
  solarPlates.userData = solarMetadata;
  components.push({ metadata: solarMetadata, object: solarPlates });

  for (let block = 0; block < layout.blocks; block += 1) {
    const origin = blockOrigin(layout, block);
    const parcel = new Mesh(
      new BoxGeometry(layout.blockWidthFt + 8, layout.blockDepthFt + 8, 0.08),
      new MeshLambertMaterial({ color: "#3d4a3f" })
    );
    parcel.position.set(origin.x + layout.blockWidthFt / 2, origin.y + layout.blockDepthFt / 2, -0.21);
    const parcelMetadata = {
      id: `city-block-parcel-${block + 1}`,
      name: `City block parcel ${block + 1} (32 homes)`,
      category: "site" as const,
      material: "assessed city-block parcel",
      source: sources.r8,
      estimatedCostUsd: 0,
      printable: false,
      notes: [
        "Parcel covering one 32-home block; assessed value derives from the per-home pro forma in the investor dashboard.",
        "Run npm run investor:dashboard for the current parcel assessment and market-circle comparison."
      ]
    };
    parcel.userData = parcelMetadata;
    components.push({ metadata: parcelMetadata, object: parcel });
  }
}
