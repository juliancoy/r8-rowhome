import type { RowhomeConfig } from "./types";
import type { FacadeStyleOption } from "./facadeStyles";
import { selectedFacadeStyle } from "./facadeStyles";

export interface FacadeMaterialOption {
  id: string;
  label: string;
  material: string;
  color: string;
  claddingThicknessFt: number;
  backupMaterial: string;
  unitCostUsdPerSf: number;
  notes: string;
}

export const facadeMaterialOptions: FacadeMaterialOption[] = [
  {
    id: "brick-veneer",
    label: "Brick veneer",
    material: "brick veneer and masonry",
    color: "#96311f",
    claddingThicknessFt: 0.36,
    backupMaterial: "wood stud backup wall with sheathing and weather-resistive barrier",
    unitCostUsdPerSf: 55,
    notes: "Default Baltimore rowhouse expression; use project review for existing or historic facades."
  },
  {
    id: "painted-brick",
    label: "Painted brick",
    material: "painted brick masonry",
    color: "#d8d1bf",
    claddingThicknessFt: 0.36,
    backupMaterial: "load-bearing masonry wall with interior furring and gypsum",
    unitCostUsdPerSf: 42,
    notes: "Lower first cost than new veneer; long-term maintenance depends on paint system and substrate."
  },
  {
    id: "formstone",
    label: "Formstone",
    material: "cast stone/formstone veneer",
    color: "#b8aa91",
    claddingThicknessFt: 0.22,
    backupMaterial: "masonry backup wall with lath, mortar bed, and interior gypsum finish",
    unitCostUsdPerSf: 48,
    notes: "Common Baltimore retrofit language; suitability depends on preservation context."
  },
  {
    id: "fiber-cement",
    label: "Fiber cement lap siding",
    material: "fiber cement siding",
    color: "#6f8791",
    claddingThicknessFt: 0.08,
    backupMaterial: "wood stud backup wall with structural sheathing, rainscreen gap, and WRB",
    unitCostUsdPerSf: 32,
    notes: "Often more economical, but may be inappropriate for some attached rowhouse facades."
  },
  {
    id: "stucco",
    label: "Stucco over masonry",
    material: "stucco finish system",
    color: "#c8bfa9",
    claddingThicknessFt: 0.12,
    backupMaterial: "masonry or cementitious backer assembly with lath, base coat, and finish coat",
    unitCostUsdPerSf: 36,
    notes: "Moderate cost finish; detailing and water management are critical."
  },
  {
    id: "metal-panel",
    label: "Metal panel",
    material: "architectural metal panel",
    color: "#4d5a60",
    claddingThicknessFt: 0.10,
    backupMaterial: "wood stud backup wall with sheathing, WRB, and ventilated metal-panel subframing",
    unitCostUsdPerSf: 68,
    notes: "Contemporary expression with higher unit cost and more specialized detailing."
  }
];

export function selectedFacadeMaterial(config: RowhomeConfig): FacadeMaterialOption {
  return facadeMaterialOptions.find((option) => option.id === config.facadeMaterialId) ?? facadeMaterialOptions[0];
}

export function grossFacadeAreaSf(config: RowhomeConfig): number {
  return config.buildingWidthFt * config.stories * config.storyHeightFt;
}

export function estimateFacadeMaterialCost(
  config: RowhomeConfig,
  material: FacadeMaterialOption,
  style: FacadeStyleOption = selectedFacadeStyle(config.facadeStyleId)
): number {
  return grossFacadeAreaSf(config) * material.unitCostUsdPerSf * style.costMultiplier;
}
