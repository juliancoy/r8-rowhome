import { describe, expect, it } from "vitest";
import { buildHvacFlowReport } from "../src/reports/hvacFlow";

describe("HVAC duct-airflow report", () => {
  it("validates the hollow duct network without writing artifacts", () => {
    const report = buildHvacFlowReport("test-generated-at");

    expect(report.edgeCount).toBeGreaterThanOrEqual(20);
    expect(report.generatedAt).toBe("test-generated-at");
    expect(report.scope).toContain("Airflow only");
    expect(report.scope).toContain("Central AC cooling airflow");
    expect(report.scope).toContain("do not model conductive, radiant, or room heat transfer");
    expect(report.checks.allSegmentsHavePositiveArea).toBe(true);
    expect(report.checks.allSegmentsHavePositiveFlow).toBe(true);
    expect(report.checks.allSegmentsHavePositiveDimensions).toBe(true);
    expect(report.checks.hasSupplyNetwork).toBe(true);
    expect(report.checks.hasReturnNetwork).toBe(true);
    expect(report.checks.hasExhaustNetwork).toBe(true);
    expect(report.checks.isCentralCoolingAirflowNetwork).toBe(true);
    expect(report.checks.supplyReturnBalanced).toBe(true);
    expect(report.checks.hasRoomSupplyTerminals).toBe(true);
    expect(report.checks.hasPerFloorReturnPaths).toBe(true);
    expect(report.checks.centralCoolingBalancedByFloor).toBe(true);
    expect(report.checks.hasFloorIndependentHeating).toBe(true);
    expect(report.checks.heatingEveryFloor).toBe(true);
    expect(report.floorAirBalance).toHaveLength(3);
    expect(report.floorAirBalance.every((floor) => floor.supplyCfm === 400 && floor.returnCfm === 400 && floor.heatingBtuh > 0)).toBe(true);
    expect(report.totals.supplyTerminalCfm).toBe(1200);
    expect(report.totals.returnTerminalCfm).toBe(1200);
    expect(report.edges.every((edge) => edge.network === "central-cooling-airflow")).toBe(true);
  });
});
