import { describe, expect, it } from "vitest";
import { buildConstructionDocumentPreflightReport } from "../src/reports/constructionDocuments";

describe("construction document preflight report", () => {
  it("generates a sheet index and schedules without claiming build readiness", () => {
    const report = buildConstructionDocumentPreflightReport("test-generated-at");

    expect(report.generatedAt).toBe("test-generated-at");
    expect(report.status).toBe("preflight-not-construction-documents");
    expect(report.buildTomorrowReady).toBe(false);
    expect(report.permitReadinessStatus).toBe("not-buildable");
    expect(report.sheetIndex.length).toBeGreaterThanOrEqual(12);
    expect(report.sheetIndex.some((sheet) => sheet.id === "A103" && sheet.title.includes("Roof plan"))).toBe(true);
    expect(report.sheetIndex.some((sheet) => sheet.id === "S201" && sheet.sourceComponentIds.includes("roof-stair-opening-front-header"))).toBe(true);
    expect(report.sheetIndex.every((sheet) => sheet.missingInputs.length > 0)).toBe(true);
  });

  it("extracts door, window, material, and product schedules from the model", () => {
    const report = buildConstructionDocumentPreflightReport("test-generated-at");

    expect(report.schedules.doors.some((door) => door.id === "front-door" && door.egress)).toBe(true);
    expect(report.schedules.doors.some((door) => door.id === "rear-exit-door-3" && door.type === "rear-egress")).toBe(true);
    expect(report.schedules.doors.some((door) => door.id === "architect-roof-access-rated-door" && door.level === "roof")).toBe(true);
    expect(report.schedules.doors.some((door) => door.id === "bath-1-door" && !door.egress)).toBe(true);
    expect(report.schedules.windows.filter((window) => window.type === "front-sash").length).toBeGreaterThanOrEqual(6);
    expect(report.schedules.materials.length).toBeGreaterThan(30);
    expect(report.schedules.products.length).toBeGreaterThanOrEqual(2);
    expect(report.schedules.products.every((product) => product.verificationRequired)).toBe(true);
  });

  it("keeps coordination checks and remaining blockers explicit", () => {
    const report = buildConstructionDocumentPreflightReport("test-generated-at");

    expect(report.coordinationChecks.allComponentsSourceTraced).toBe(true);
    expect(report.coordinationChecks.uniqueComponentIds).toBe(true);
    expect(report.coordinationChecks.hasArchitecturalPermitIndex).toBe(true);
    expect(report.coordinationChecks.hasStructuralLogicPlaceholders).toBe(true);
    expect(report.coordinationChecks.hasMepPreflightModels).toBe(true);
    expect(report.coordinationChecks.hasModeledRoofDrainage).toBe(true);
    expect(report.coordinationChecks.hasExteriorEgressDoors).toBe(true);
    expect(report.remainingTechnicalBlockers).toContain("dimensioned construction drawings");
    expect(report.remainingTechnicalBlockers).toContain("Manual J/S/D and installable MEP design");
    expect(report.remainingTechnicalBlockers).toContain("construction sequence, temporary works, and safety plan");
  });
});
