import { describe, expect, it } from "vitest";
import { buildCollisionAuditReport } from "../src/reports/collisionAudit";

describe("all-object collision audit", () => {
  it("scans every printable component pair and fails on suspect critical intersections", () => {
    const report = buildCollisionAuditReport("test-generated-at");

    expect(report.generatedAt).toBe("test-generated-at");
    expect(report.status).toBe("pass");
    expect(report.componentCount).toBeGreaterThan(1000);
    expect(report.pairCount).toBe(report.componentCount * (report.componentCount - 1) / 2);
    expect(report.intersectingPairCount).toBeGreaterThan(0);
    expect(report.suspectCriticalCount).toBe(0);
    expect(report.suspectCritical).toEqual([]);
    expect(report.sampleExpected.length).toBeGreaterThan(0);
  });
});
