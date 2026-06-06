import { describe, expect, it } from "vitest";
import { defaultRowhomeConfig } from "../src/core/config";
import { generateRowhome } from "../src/generators/rowhome";
import { buildElectricalLoadCalculation } from "../src/calculations/electricalLoad";
import { buildHvacSizingCalculation } from "../src/calculations/hvacSizing";
import { buildPlumbingFixtureUnitCalculation } from "../src/calculations/plumbingFixtureUnits";
import { buildPermitReadinessReport } from "../src/reports/permitReadiness";

describe("permit readiness and preliminary calculations", () => {
  it("builds preliminary electrical load tracking without claiming permit design", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const calculation = buildElectricalLoadCalculation(model);

    expect(calculation.status).toBe("preliminary-not-for-permit");
    expect(calculation.dwellingAreaSqFt).toBeGreaterThan(2000);
    expect(calculation.totalConnectedVoltAmps).toBeGreaterThan(25000);
    expect(calculation.recommendedServiceAmps).toBeGreaterThanOrEqual(150);
    expect(calculation.lines.some((line) => line.id === "electric-range" && line.voltAmps > 0)).toBe(true);
    expect(calculation.lines.some((line) => line.id === "pv-battery-storage-interconnection")).toBe(true);
    expect(calculation.missingInputs).toContain("panel schedule");
    expect(calculation.missingInputs).toContain("PV and battery energy-storage interconnection calculation");
  });

  it("builds preliminary HVAC sizing and airflow checks without claiming Manual J", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const calculation = buildHvacSizingCalculation(model);

    expect(calculation.status).toBe("preliminary-not-manual-j");
    expect(calculation.conditionedAreaSqFt).toBeGreaterThan(2000);
    expect(calculation.coolingTons).toBeGreaterThan(3);
    expect(calculation.heatingZones).toHaveLength(defaultRowhomeConfig.stories);
    expect(calculation.heatingZones.every((zone) => zone.heaterId.includes("heat-pump-indoor-unit"))).toBe(true);
    expect(calculation.modeledSupplyCfm).toBeGreaterThan(900);
    expect(calculation.modeledReturnCfm).toBeGreaterThan(900);
    expect(calculation.missingInputs).toContain("Manual J room-by-room heating and cooling load");
    expect(calculation.missingInputs).toContain("floor-by-floor heat-loss and heat-gain allocation");
  });

  it("builds preliminary plumbing fixture-unit tracking without claiming permit sizing", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const calculation = buildPlumbingFixtureUnitCalculation(model);

    expect(calculation.status).toBe("preliminary-not-for-permit");
    expect(calculation.fixtureCount).toBe(10);
    expect(calculation.waterSupplyFixtureUnits).toBeGreaterThan(15);
    expect(calculation.drainageFixtureUnits).toBeGreaterThanOrEqual(20);
    expect(calculation.hotWaterFixtureCount).toBe(7);
    expect(calculation.missingInputs).toContain("vent sizing and wet-vent rules");
  });

  it("builds a permit-readiness report that stays blocked", () => {
    const report = buildPermitReadinessReport("test-generated-at");

    expect(report.generatedAt).toBe("test-generated-at");
    expect(report.status).toBe("not-buildable");
    expect(report.legalProcedure).toBe("legal_procedure.md");
    expect(report.buildability.blockerCount).toBeGreaterThanOrEqual(6);
    expect(report.preliminaryCalculations.electrical.status).toBe("preliminary-not-for-permit");
    expect(report.preliminaryCalculations.hvac.status).toBe("preliminary-not-manual-j");
    expect(report.preliminaryCalculations.plumbing.status).toBe("preliminary-not-for-permit");
    expect(report.requiredNextActions).toContain("build only from approved documents");
  });
});
