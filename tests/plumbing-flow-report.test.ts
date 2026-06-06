import { describe, expect, it } from "vitest";
import { buildPlumbingFlowReport } from "../src/reports/plumbingFlow";

describe("plumbing fluid-analysis report", () => {
  it("validates hollow connected plumbing pipes without writing artifacts", () => {
    const report = buildPlumbingFlowReport("test-generated-at");

    expect(report.edgeCount).toBeGreaterThanOrEqual(30);
    expect(report.generatedAt).toBe("test-generated-at");
    expect(report.checks.allPipesAreHollow).toBe(true);
    expect(report.checks.allPipesHaveConnections).toBe(true);
    expect(report.checks.hasWaterSupply).toBe(true);
    expect(report.checks.hasDwvAndVent).toBe(true);
    expect(report.checks.hasStormAndCondensate).toBe(true);
    expect(report.checks.slopedDrainBranches).toBe(true);
    expect(report.totals.domesticSupplyGpm).toBeGreaterThan(40);
    expect(report.totals.sanitaryDfu).toBeGreaterThan(15);
  });
});
