import type { RowhomeConfig, RowhomeModel, ValidationMessage } from "../core/types";
import { sources } from "../core/sources";

export function validateRowhome(config: RowhomeConfig, model: RowhomeModel): ValidationMessage[] {
  const messages: ValidationMessage[] = [
    {
      severity: "warning",
      code: "professional_review_required",
      message: "Generated geometry is a design and visualization model, not sealed construction documents.",
      source: sources.plan
    }
  ];

  if (config.buildingWidthFt > config.lotWidthFt) {
    messages.push({
      severity: "error",
      code: "building_width_exceeds_lot",
      message: "Building width exceeds configured lot width.",
      source: sources.r8
    });
  }

  if (config.buildingDepthFt > config.lotDepthFt) {
    messages.push({
      severity: "error",
      code: "building_depth_exceeds_lot",
      message: "Building depth exceeds configured lot depth.",
      source: sources.r8
    });
  }

  const hasGas = model.components.some((component) =>
    /gas/i.test(`${component.metadata.name} ${component.metadata.material} ${component.metadata.notes?.join(" ") ?? ""}`)
  );
  if (hasGas) {
    messages.push({
      severity: "error",
      code: "gas_component_present",
      message: "The mission requires no gas-fitted components.",
      source: "mission.md"
    });
  }

  return messages;
}

