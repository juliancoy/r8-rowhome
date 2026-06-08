import { describe, expect, it } from "vitest";
import { buildPrintPreflightReport } from "../src/reports/printPreflight";

describe("3D print preflight", () => {
  it("generates a scale-aware print report without claiming slicer readiness", () => {
    const report = buildPrintPreflightReport("test-generated-at");

    expect(report.generatedAt).toBe("test-generated-at");
    expect(report.status).toBe("preflight-not-slicer-ready");
    expect(report.buildTomorrowReady).toBe(false);
    expect(report.profile.scale).toBe("1:48");
    expect(report.printableComponentCount).toBeGreaterThan(100);
    expect(report.excludedComponentCount).toBeGreaterThan(0);
    expect(report.blockerCount).toBeGreaterThan(0);
    expect(report.requiredNextActions).toContain("split model into print plates with alignment pins, sockets, and tolerances");
  });

  it("groups printable components into physical model kits", () => {
    const report = buildPrintPreflightReport("test-generated-at");
    const kitIds = new Set(report.kits.map((kit) => kit.id));

    expect(kitIds.has("site-base")).toBe(true);
    expect(kitIds.has("shell-envelope")).toBe(true);
    expect(kitIds.has("structure-egress")).toBe(true);
    expect(kitIds.has("mep-overlays")).toBe(true);
    expect(report.kits.every((kit) => kit.componentCount > 0)).toBe(true);
  });

  it("identifies thin features and product assets that need print review", () => {
    const report = buildPrintPreflightReport("test-generated-at");

    expect(report.checks.some((check) => check.status === "too-thin")).toBe(true);
    expect(report.checks.some((check) => check.status === "requires-asset-review")).toBe(true);
    expect(report.checks.some((check) => check.id === "roof-drain-keep-clear-zone" && check.status === "excluded-marker")).toBe(true);
    expect(report.checks.some((check) => check.id === "front-door" && check.printableFlag)).toBe(true);
  });
});
