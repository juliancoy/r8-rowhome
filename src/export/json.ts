import type { RowhomeModel } from "../core/types";
import { buildPermitReadinessReport } from "../reports/permitReadiness";

export function exportModelMetadataJson(model: RowhomeModel): string {
  return JSON.stringify(
    {
      name: model.name,
      units: model.units,
      components: model.components.map((component) => component.metadata),
      hierarchy: model.hierarchy,
      structural: model.structural,
      permitReadiness: buildPermitReadinessReport("export-generated-at", model),
      validation: model.validation
    },
    null,
    2
  );
}
