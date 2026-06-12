import type { RowhomeConfig } from "./types";

export const defaultRowhomeConfig: RowhomeConfig = {
  rowhomeCount: 1,
  lotWidthFt: 18,
  lotDepthFt: 90,
  buildingWidthFt: 18,
  buildingDepthFt: 48,
  stories: 3,
  storyHeightFt: 10,
  includeBasement: true,
  basementDepthFt: 8,
  includeTree: true,
  facadeMaterialId: "brick-veneer",
  facadeStyleId: "flat-front",
  stairImplementation: "alternating-run",
  structuralSupportScheme: "masonry-bearing",
  brickDetailMode: "solid-textured",
  constructionSystem: "masonry-wood",
  urbanScale: "single"
};
