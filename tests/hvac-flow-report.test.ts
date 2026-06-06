import { describe, expect, it } from "vitest";
import { buildHvacFlowReport } from "../src/reports/hvacFlow";

describe("HVAC duct-airflow report", () => {
  it("validates the hollow duct network without writing artifacts", () => {
    const report = buildHvacFlowReport("test-generated-at");

    expect(report.edgeCount).toBeGreaterThanOrEqual(20);
    expect(report.generatedAt).toBe("test-generated-at");
    expect(report.scope).toContain("Airflow only");
    expect(report.scope).toContain("do not model conductive, radiant, or room heat transfer");
    expect(report.checks.allSegmentsHavePositiveArea).toBe(true);
    expect(report.checks.allSegmentsHavePositiveFlow).toBe(true);
    expect(report.checks.allSegmentsHavePositiveDimensions).toBe(true);
    expect(report.checks.hasSupplyNetwork).toBe(true);
    expect(report.checks.hasReturnNetwork).toBe(true);
    expect(report.checks.hasExhaustNetwork).toBe(true);
    expect(report.totals.supplyTerminalCfm).toBeGreaterThan(900);
  });
});
