import { defaultRowhomeConfig } from "../core/config";
import type { RowhomeConfig, RowhomeModel } from "../core/types";
import { buildBuildabilityReadiness } from "../buildability/readiness";
import { buildElectricalLoadCalculation } from "../calculations/electricalLoad";
import { buildHvacSizingCalculation } from "../calculations/hvacSizing";
import { buildPlumbingFixtureUnitCalculation } from "../calculations/plumbingFixtureUnits";
import { generateRowhome } from "../generators/rowhome";

export function buildPermitReadinessReport(
  generatedAt = new Date().toISOString(),
  model: RowhomeModel = generateRowhome(defaultRowhomeConfig),
  config: RowhomeConfig = defaultRowhomeConfig
) {
  const buildability = buildBuildabilityReadiness(model);
  const electrical = buildElectricalLoadCalculation(model, config);
  const hvac = buildHvacSizingCalculation(model, config);
  const plumbing = buildPlumbingFixtureUnitCalculation(model);

  return {
    generatedAt,
    status: buildability.status,
    purpose: "Permit-readiness handoff report. This is not a permit application, sealed drawing set, or construction authorization.",
    legalProcedure: "legal_procedure.md",
    buildability,
    preliminaryCalculations: {
      electrical,
      hvac,
      plumbing
    },
    requiredNextActions: [
      "commission site survey and property/legal review",
      "engage licensed architect and engineers",
      "prepare permit drawings and specifications",
      "complete structural, electrical, HVAC, plumbing, energy, and site calculations",
      "submit to authority having jurisdiction",
      "build only from approved documents"
    ]
  };
}
