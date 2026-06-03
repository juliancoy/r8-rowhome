import type { RowhomeModel } from "../core/types";

export function exportModelMetadataJson(model: RowhomeModel): string {
  return JSON.stringify(
    {
      name: model.name,
      units: model.units,
      components: model.components.map((component) => component.metadata),
      structural: model.structural,
      validation: model.validation
    },
    null,
    2
  );
}
