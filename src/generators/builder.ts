import type { ComponentCategory, ComponentMetadata, ModelComponent, RowhomeConfig } from "../core/types";
import { makeBoxComponent } from "../geometry/component";

export function metadata(
  id: string,
  name: string,
  category: ComponentCategory,
  material: string,
  source: string,
  estimatedCostUsd: number,
  printable = true,
  notes: string[] = []
): ComponentMetadata {
  return { id, name, category, material, source, estimatedCostUsd, printable, notes };
}

export function box(
  components: ModelComponent[],
  meta: ComponentMetadata,
  color: string,
  width: number,
  depth: number,
  height: number,
  center: { x: number; y: number; z: number },
  rotationYRadians = 0
): void {
  components.push(makeBoxComponent(meta, color, width, depth, height, center, rotationYRadians));
}

export function bowProjectionAtX(x: number, width: number, bowDepth: number): number {
  const localX = x - width / 2;
  const radius = (width * width) / (8 * bowDepth) + bowDepth / 2;
  const radiusOffset = radius - bowDepth;
  return Math.sqrt(Math.max(0, radius * radius - localX * localX)) - radiusOffset;
}

export function bowTangentAngleAtX(x: number, width: number, bowDepth: number): number {
  const localX = x - width / 2;
  const radius = (width * width) / (8 * bowDepth) + bowDepth / 2;
  const denominator = Math.sqrt(Math.max(0.0001, radius * radius - localX * localX));
  return Math.atan(localX / denominator);
}

export interface WallOpening {
  id: string;
  xCenter: number;
  width: number;
  zBottom: number;
  zTop: number;
}

export interface WallSegment {
  xCenter: number;
  width: number;
  zCenter: number;
  height: number;
}

export function frontWallOpenings(config: RowhomeConfig): WallOpening[] {
  const openings: WallOpening[] = [
    {
      id: "entry-door",
      xCenter: config.buildingWidthFt / 2 - 0.4,
      width: 4.1,
      zBottom: 0.2,
      zTop: 8.35
    }
  ];

  for (let story = 0; story < config.stories; story += 1) {
    const z = story * config.storyHeightFt + 5.25;
    for (const [side, xCenter] of [["left", 3.7], ["right", 14.2]] as const) {
      openings.push({
        id: `front-window-${side}-${story + 1}`,
        xCenter,
        width: 3.9,
        zBottom: z - 2.55,
        zTop: z + 2.55
      });
    }
  }

  return openings;
}

export function rearWallOpenings(config: RowhomeConfig): WallOpening[] {
  const openings: WallOpening[] = [];

  for (let story = 0; story < config.stories; story += 1) {
    openings.push({
      id: `rear-egress-door-${story + 1}`,
      xCenter: config.buildingWidthFt / 2,
      width: 3.8,
      zBottom: story * config.storyHeightFt + 0.25,
      zTop: story * config.storyHeightFt + 7.65
    });
  }

  return openings;
}

export function wallSegmentsAroundOpenings(width: number, height: number, openings: WallOpening[]): WallSegment[] {
  const zCuts = new Set<number>([0, height]);
  for (const opening of openings) {
    zCuts.add(Math.max(0, Math.min(height, opening.zBottom)));
    zCuts.add(Math.max(0, Math.min(height, opening.zTop)));
  }
  const sortedZ = [...zCuts].sort((a, b) => a - b);
  const segments: WallSegment[] = [];

  for (let i = 0; i < sortedZ.length - 1; i += 1) {
    const zBottom = sortedZ[i];
    const zTop = sortedZ[i + 1];
    const segmentHeight = zTop - zBottom;
    if (segmentHeight <= 0.01) {
      continue;
    }

    const midZ = (zBottom + zTop) / 2;
    const activeOpenings = openings
      .filter((opening) => midZ > opening.zBottom && midZ < opening.zTop)
      .map((opening) => ({
        left: Math.max(0, opening.xCenter - opening.width / 2),
        right: Math.min(width, opening.xCenter + opening.width / 2)
      }))
      .sort((a, b) => a.left - b.left);

    let cursor = 0;
    for (const opening of activeOpenings) {
      if (opening.left > cursor + 0.01) {
        segments.push({
          xCenter: (cursor + opening.left) / 2,
          width: opening.left - cursor,
          zCenter: midZ,
          height: segmentHeight
        });
      }
      cursor = Math.max(cursor, opening.right);
    }
    if (cursor < width - 0.01) {
      segments.push({
        xCenter: (cursor + width) / 2,
        width: width - cursor,
        zCenter: midZ,
        height: segmentHeight
      });
    }
  }

  return segments.filter((segment) => segment.width > 0.01 && segment.height > 0.01);
}
