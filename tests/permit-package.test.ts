import { describe, expect, it } from "vitest";
import { buildPermitPackageReport, renderPermitPackageMarkdown } from "../src/reports/permitPackage";

describe("Baltimore R-8 permit package", () => {
  const report = buildPermitPackageReport("test-generated-at");

  it("targets the Baltimore DHCD new-construction permit path", () => {
    expect(report.jurisdiction).toContain("Baltimore City");
    expect(report.permitPath).toContain("new construction");
  });

  it("orders application steps from zoning verification through Use and Occupancy", () => {
    expect(report.applicationSteps.map((step) => step.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(report.applicationSteps[0].name).toContain("zoning verification");
    expect(report.applicationSteps[8].name).toContain("Use and Occupancy");
    expect(report.applicationSteps.every((step) => step.source.startsWith("sources/"))).toBe(true);
  });

  it("builds a zoning data sheet from the modeled configuration", () => {
    expect(report.zoningDataSheet.length).toBeGreaterThanOrEqual(8);
    expect(report.zoningDataSheet.some((entry) => entry.item === "Building footprint" && entry.status === "internally-consistent")).toBe(true);
    expect(report.checks.buildingFitsLot).toBe(true);
  });

  it("registers every required document with explicit status", () => {
    expect(report.documentRegister.length).toBeGreaterThanOrEqual(14);
    expect(report.checks.everyDocumentHasStatus).toBe(true);
    const generated = report.documentRegister.filter((entry) => entry.status === "generated-by-model");
    expect(generated.length).toBeGreaterThanOrEqual(4);
    expect(generated.some((entry) => entry.id === "statement-of-work")).toBe(true);
    expect(report.documentRegister.some((entry) => entry.id === "fire-sprinkler-design" && entry.status === "requires-licensed-professional")).toBe(true);
  });

  it("keeps professional seal gaps explicit and never claims buildability", () => {
    expect(report.professionalSealGaps.length).toBeGreaterThanOrEqual(5);
    expect(report.checks.sealGapsExplicit).toBe(true);
    expect(report.buildabilityStatus).toBe("not-buildable");
    expect(report.blockerCount).toBeGreaterThan(0);
    expect(report.scopeBoundary).toContain("not a permit application");
  });

  it("links both construction-system statements of work", () => {
    expect(report.constructionSystems.map((system) => system.id).sort()).toEqual(["masonry-wood", "steel-concrete"]);
    expect(report.constructionSystems.every((system) => system.statementOfWorkArtifact.includes("STATEMENT_OF_WORK"))).toBe(true);
  });

  it("passes model validation without errors", () => {
    expect(report.checks.noModelErrorValidation).toBe(true);
  });

  it("renders a complete markdown package", () => {
    const markdown = renderPermitPackageMarkdown(report);
    expect(markdown).toContain("# Baltimore R-8 Permit Application Package");
    expect(markdown).toContain("## Zoning Data Sheet");
    expect(markdown).toContain("## Document Register");
    expect(markdown).toContain("## Professional Seal Gaps");
  });
});
