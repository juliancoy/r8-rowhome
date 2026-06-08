import { describe, expect, it } from "vitest";
import { buildDocumentOrganizationReport } from "../src/reports/documentOrganization";

describe("document organization report", () => {
  it("organizes source documents and generated artifacts", () => {
    const report = buildDocumentOrganizationReport("test-generated-at");

    expect(report.generatedAt).toBe("test-generated-at");
    expect(report.status).toBe("organized");
    expect(report.documents.some((document) => document.path === "DEFICIENCIES.md")).toBe(true);
    expect(report.documents.some((document) => document.path === "../architect_logic.md")).toBe(true);
    expect(report.documents.some((document) => document.path === "../structural_logic.md")).toBe(true);
    expect(report.documents.some((document) => document.path === "artifacts/print-preflight/print-preflight-report.json")).toBe(true);
    expect(report.generatedArtifactCount).toBeGreaterThanOrEqual(8);
    expect(report.recommendedReadingOrder[0]).toBe("README.md");
  });
});
