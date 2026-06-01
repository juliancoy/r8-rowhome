import type { BomLine, ComponentCategory, RowhomeModel } from "../core/types";

export function buildBom(model: RowhomeModel): BomLine[] {
  const rows = new Map<string, BomLine>();
  for (const component of model.components) {
    const key = `${component.metadata.category}:${component.metadata.material}`;
    const existing = rows.get(key);
    if (existing) {
      existing.components += 1;
      existing.estimatedCostUsd += component.metadata.estimatedCostUsd;
    } else {
      rows.set(key, {
        material: component.metadata.material,
        category: component.metadata.category as ComponentCategory,
        components: 1,
        estimatedCostUsd: component.metadata.estimatedCostUsd
      });
    }
  }
  return [...rows.values()].sort((a, b) => a.category.localeCompare(b.category) || a.material.localeCompare(b.material));
}

export function totalEstimatedCost(model: RowhomeModel): number {
  return model.components.reduce((sum, component) => sum + component.metadata.estimatedCostUsd, 0);
}

