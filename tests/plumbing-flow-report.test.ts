import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultRowhomeConfig } from "../src/core/config";
import { generateRowhome } from "../src/generators/rowhome";

interface PlumbingFlowEdge {
  id: string;
  system: string;
  from: string;
  to: string;
  nominalDiameterIn: number;
  innerAreaSqFt: number;
  innerDiameterFt: number;
  lengthFt: number;
  designFlowGpm: number;
  drainageFixtureUnits: number;
  slopePercent: number;
}

function plumbingFlowEdges(): PlumbingFlowEdge[] {
  const model = generateRowhome(defaultRowhomeConfig);
  return model.components
    .filter((component) => component.object.userData.plumbing?.hollow === true)
    .map((component) => {
      const plumbing = component.object.userData.plumbing;
      return {
        id: component.metadata.id,
        system: plumbing.system,
        from: plumbing.from,
        to: plumbing.to,
        nominalDiameterIn: plumbing.nominalDiameterIn,
        innerAreaSqFt: plumbing.innerAreaSqFt,
        innerDiameterFt: plumbing.innerDiameterFt,
        lengthFt: plumbing.lengthFt,
        designFlowGpm: plumbing.designFlowGpm,
        drainageFixtureUnits: plumbing.drainageFixtureUnits,
        slopePercent: plumbing.slopePercent
      };
    });
}

describe("plumbing fluid-analysis report", () => {
  it("validates hollow connected plumbing pipes and writes a CI report", () => {
    const edges = plumbingFlowEdges();
    const systems = new Set(edges.map((edge) => edge.system));
    const report = {
      generatedAt: new Date().toISOString(),
      purpose: "Headless CI plumbing fluid-analysis preflight report. The website renderer does not run this workflow.",
      edgeCount: edges.length,
      systems: [...systems].sort(),
      totals: {
        domesticSupplyGpm: edges.filter((edge) => edge.system === "cold-water" || edge.system === "hot-water").reduce((sum, edge) => sum + edge.designFlowGpm, 0),
        sanitaryDfu: edges.filter((edge) => edge.system === "sanitary-dwv").reduce((sum, edge) => sum + edge.drainageFixtureUnits, 0)
      },
      checks: {
        allPipesAreHollow: edges.every((edge) => edge.innerAreaSqFt > 0 && edge.innerDiameterFt > 0),
        allPipesHaveConnections: edges.every((edge) => edge.from.length > 0 && edge.to.length > 0),
        hasWaterSupply: systems.has("cold-water") && systems.has("hot-water"),
        hasDwvAndVent: systems.has("sanitary-dwv") && systems.has("vent"),
        hasStormAndCondensate: systems.has("storm") && systems.has("condensate"),
        slopedDrainBranches: edges.filter((edge) => edge.system === "sanitary-dwv" && edge.id.includes("branch")).every((edge) => edge.slopePercent >= 2)
      },
      edges
    };

    mkdirSync(resolve("artifacts/plumbing-flow"), { recursive: true });
    writeFileSync(resolve("artifacts/plumbing-flow/plumbing-flow-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

    expect(report.edgeCount).toBeGreaterThanOrEqual(30);
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
