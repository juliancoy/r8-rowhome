import { describe, expect, it } from "vitest";
import { buildInvestorDashboardForSystem, marketSizeAssumptions, proFormaAssumptions } from "../src/reports/investorDashboard";

describe("investor dashboard", () => {
  const masonry = buildInvestorDashboardForSystem("masonry-wood", "test-generated-at");
  const steel = buildInvestorDashboardForSystem("steel-concrete", "test-generated-at");

  it("builds a full per-home pro forma with positive cost stack", () => {
    for (const report of [masonry, steel]) {
      expect(report.perHome.materialCostUsd).toBeGreaterThan(100000);
      expect(report.perHome.laborCostUsd).toBeGreaterThan(50000);
      expect(report.perHome.softCostUsd).toBeGreaterThan(0);
      expect(report.perHome.contingencyUsd).toBeGreaterThan(0);
      expect(report.perHome.landCostUsd).toBe(proFormaAssumptions.landCostPerHomeUsd);
      expect(report.perHome.totalDevelopmentCostUsd).toBe(
        report.perHome.materialCostUsd +
          report.perHome.laborCostUsd +
          report.perHome.softCostUsd +
          report.perHome.contingencyUsd +
          report.perHome.landCostUsd
      );
      expect(report.checks.profitIsSaleMinusCost).toBe(true);
    }
  });

  it("allocates labor by personnel role with shares summing to one", () => {
    for (const report of [masonry, steel]) {
      expect(report.laborByRole.length).toBeGreaterThan(6);
      expect(report.checks.laborSharesSumToOne).toBe(true);
    }
    expect(masonry.laborByRole.some((slice) => slice.roleId === "mason")).toBe(true);
    expect(steel.laborByRole.some((slice) => slice.roleId === "steel-erector")).toBe(true);
    expect(steel.laborByRole.some((slice) => slice.roleId === "mason")).toBe(false);
  });

  it("breaks cost down by category with shares summing to one", () => {
    for (const report of [masonry, steel]) {
      expect(report.costByCategory.length).toBeGreaterThan(5);
      expect(report.checks.costSharesSumToOne).toBe(true);
      expect(report.costByCategory.some((slice) => slice.category === "structure")).toBe(true);
      expect(report.costByCategory.some((slice) => slice.category === "electrical")).toBe(true);
    }
  });

  it("assesses block (32) and district (128) parcels from the per-home pro forma", () => {
    for (const report of [masonry, steel]) {
      expect(report.block.homes).toBe(32);
      expect(report.district.homes).toBe(128);
      expect(report.block.parcelValueUsd).toBe(report.perHome.salePriceAssumptionUsd * 32);
      expect(report.district.parcelValueUsd).toBe(report.perHome.salePriceAssumptionUsd * 128);
      expect(report.district.projectedProfitUsd).toBe(report.block.projectedProfitUsd * 4);
    }
  });

  it("orders the three market circles big to littlest", () => {
    for (const report of [masonry, steel]) {
      expect(report.marketCircles).toHaveLength(3);
      expect(report.marketCircles[0].valueUsd).toBe(marketSizeAssumptions.globalRealEstateUsd);
      expect(report.marketCircles[1].valueUsd).toBe(marketSizeAssumptions.usResidentialUsd);
      expect(report.marketCircles[2].id).toBe("city-block");
      expect(report.checks.circlesDescend).toBe(true);
    }
  });

  it("carries the green program and the disclaimer", () => {
    for (const report of [masonry, steel]) {
      expect(report.greenProgram.solarPowered).toBe(true);
      expect(report.greenProgram.composters).toContain("Green Mount West");
      expect(report.greenProgram.composters).toContain("East 25th Street");
      expect(report.greenProgram.blockchainParcelRegistry).toContain("Concept");
      expect(report.disclaimer).toContain("not an appraisal");
    }
  });

  it("costs more to build in steel and concrete", () => {
    expect(steel.perHome.totalDevelopmentCostUsd).toBeGreaterThan(masonry.perHome.totalDevelopmentCostUsd);
  });
});
