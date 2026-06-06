import type { RowhomeConfig, RowhomeModel, ValidationMessage } from "../core/types";
import { sources } from "../core/sources";
import { buildBuildabilityReadiness } from "../buildability/readiness";

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

  if (model.structural?.status === "conceptual-load-model") {
    messages.push({
      severity: "warning",
      code: "conceptual_structural_model_only",
      message: "Structural data is limited to a conceptual gravity-load model; stiffness, member capacity, foundation bearing, and load combinations are not solved.",
      source: sources.residentialCode
    });
  }

  if (!model.structural || model.structural.supports.length === 0) {
    messages.push({
      severity: "error",
      code: "missing_structural_supports",
      message: "Structural model has no defined support restraints.",
      source: sources.residentialCode
    });
  }

  const buildability = buildBuildabilityReadiness(model);
  if (buildability.status === "not-buildable") {
    messages.push({
      severity: "warning",
      code: "not_buildable_from_model",
      message: `Construction is blocked by ${buildability.blockerCount} buildability requirements; see legal_procedure.md and the buildability readiness register.`,
      source: "legal_procedure.md"
    });
  }

  return messages;
}
