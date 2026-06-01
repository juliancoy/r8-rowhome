import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultRowhomeConfig } from "../src/core/config";
import { generateRowhome } from "../src/generators/rowhome";

interface HvacFlowEdge {
  id: string;
  name: string;
  from: string;
  to: string;
  flowCfm: number;
  designVelocityFpm: number;
  hydraulicAreaSqFt: number;
  innerWidthFt: number;
  innerHeightFt: number;
  lengthFt: number;
}

function hvacFlowEdges(): HvacFlowEdge[] {
  const model = generateRowhome(defaultRowhomeConfig);
  return model.components
    .filter((component) => component.object.userData.hvac?.hollow === true)
    .map((component) => {
      const hvac = component.object.userData.hvac;
      return {
        id: component.metadata.id,
        name: component.metadata.name,
        from: hvac.from,
        to: hvac.to,
        flowCfm: hvac.flowCfm,
        designVelocityFpm: hvac.designVelocityFpm,
        hydraulicAreaSqFt: hvac.hydraulicAreaSqFt,
        innerWidthFt: hvac.innerWidthFt,
        innerHeightFt: hvac.innerHeightFt,
        lengthFt: hvac.lengthFt
      };
    });
}

describe("HVAC thermofluid flow report", () => {
  it("validates the hollow duct network and writes a CI report without importing the renderer", () => {
    const edges = hvacFlowEdges();
    const nodeIds = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
    const supplyEdges = edges.filter((edge) => edge.id.startsWith("supply-"));
    const returnEdges = edges.filter((edge) => edge.id.startsWith("return-"));
    const exhaustEdges = edges.filter((edge) => edge.id.includes("exhaust") || edge.id.includes("range-hood"));
    const report = {
      generatedAt: new Date().toISOString(),
      purpose: "Headless CI thermofluid preflight report. The website renderer does not run this test or FEM workflow.",
      edgeCount: edges.length,
      nodeCount: nodeIds.size,
      totals: {
        supplyTerminalCfm: supplyEdges.filter((edge) => edge.to.startsWith("supply-register")).reduce((sum, edge) => sum + edge.flowCfm, 0),
        exhaustCfm: exhaustEdges.reduce((sum, edge) => sum + edge.flowCfm, 0)
      },
      checks: {
        allSegmentsHavePositiveArea: edges.every((edge) => edge.hydraulicAreaSqFt > 0),
        allSegmentsHavePositiveFlow: edges.every((edge) => edge.flowCfm > 0),
        allSegmentsHavePositiveDimensions: edges.every((edge) => edge.innerWidthFt > 0 && edge.innerHeightFt > 0 && edge.lengthFt > 0),
        hasSupplyNetwork: supplyEdges.length >= 12,
        hasReturnNetwork: returnEdges.length >= 5,
        hasExhaustNetwork: exhaustEdges.length >= 2
      },
      edges
    };

    mkdirSync(resolve("artifacts/hvac-flow"), { recursive: true });
    writeFileSync(resolve("artifacts/hvac-flow/hvac-flow-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

    expect(report.edgeCount).toBeGreaterThanOrEqual(20);
    expect(report.checks.allSegmentsHavePositiveArea).toBe(true);
    expect(report.checks.allSegmentsHavePositiveFlow).toBe(true);
    expect(report.checks.allSegmentsHavePositiveDimensions).toBe(true);
    expect(report.checks.hasSupplyNetwork).toBe(true);
    expect(report.checks.hasReturnNetwork).toBe(true);
    expect(report.checks.hasExhaustNetwork).toBe(true);
    expect(report.totals.supplyTerminalCfm).toBeGreaterThan(900);
  });
});
