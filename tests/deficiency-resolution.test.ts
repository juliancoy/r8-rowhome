import { describe, expect, it } from "vitest";
import { buildDeficiencyResolutionReport } from "../src/reports/deficiencyResolution";

describe("deficiency resolution controls", () => {
  it("tracks control resolutions without claiming the house is buildable tomorrow", () => {
    const report = buildDeficiencyResolutionReport("test-generated-at");

    expect(report.generatedAt).toBe("test-generated-at");
    expect(report.status).toBe("not-buildable-technical-blockers-tracked");
    expect(report.buildTomorrowReady).toBe(false);
    expect(report.controlResolutionCount).toBe(4);
    expect(report.items.slice(0, 4).map((item) => item.id)).toEqual([
      "engineering-solver-scope",
      "bim-permit-set-scope",
      "hardware-gpu-certification",
      "mesh-accurate-simulation-scope"
    ]);
    expect(report.items.every((item) => item.status === "resolved")).toBe(true);
    expect(report.items.every((item) => item.evidence.length >= 4)).toBe(true);
    expect(report.items.every((item) => item.verificationCommands.length > 0)).toBe(true);
    expect(report.items.every((item) => item.boundary.length > 40)).toBe(true);
  });

  it("keeps the eight non-human technical build blockers explicit", () => {
    const report = buildDeficiencyResolutionReport("test-generated-at");

    expect(report.remainingTechnicalBlockerCount).toBe(10);
    expect(report.remainingTechnicalBlockers.map((item) => item.id)).toEqual([
      "construction-document-package",
      "solved-structural-design",
      "foundation-site-design",
      "real-mep-design",
      "bim-grade-coordination",
      "material-product-specifications",
      "build-sequence-plan",
      "exact-simulation-certification",
      "slicer-ready-print-kit",
      "document-register"
    ]);
    expect(report.remainingTechnicalBlockers.every((item) => item.boundary.includes("not resolved as"))).toBe(true);
  });

  it("keeps solver, permit, GPU, and collision boundaries explicit", () => {
    const report = buildDeficiencyResolutionReport("test-generated-at");
    const byId = new Map(report.items.map((item) => [item.id, item]));

    expect(byId.get("engineering-solver-scope")?.boundary).toContain("does not claim sealed structural design");
    expect(byId.get("bim-permit-set-scope")?.boundary).toContain("sealed permit package");
    expect(byId.get("hardware-gpu-certification")?.verificationCommands).toContain("BENCHMARK_RUN_BROWSER=1 npm run benchmark:renderers");
    expect(byId.get("mesh-accurate-simulation-scope")?.boundary).toContain("not a mesh-exact rigid-body");
    expect(byId.get("construction-document-package")?.boundary).toContain("not resolved as a finished construction-document package");
    expect(byId.get("real-mep-design")?.boundary).toContain("not resolved as installable mechanical");
    expect(byId.get("slicer-ready-print-kit")?.verificationCommands).toContain("npm run print:preflight");
    expect(byId.get("document-register")?.verificationCommands).toContain("npm run documents:organize");
  });
});
