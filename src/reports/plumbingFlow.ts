import { defaultRowhomeConfig } from "../core/config";
import { generateRowhome } from "../generators/rowhome";

export interface PlumbingFlowEdge {
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

export interface PlumbingFlowReport {
  generatedAt: string;
  purpose: string;
  edgeCount: number;
  systems: string[];
  totals: {
    domesticSupplyGpm: number;
    sanitaryDfu: number;
  };
  checks: {
    allPipesAreHollow: boolean;
    allPipesHaveConnections: boolean;
    hasWaterSupply: boolean;
    hasDwvAndVent: boolean;
    hasStormAndCondensate: boolean;
    slopedDrainBranches: boolean;
  };
  edges: PlumbingFlowEdge[];
}

export function plumbingFlowEdges(): PlumbingFlowEdge[] {
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

export function buildPlumbingFlowReport(generatedAt = new Date().toISOString()): PlumbingFlowReport {
  const edges = plumbingFlowEdges();
  const systems = new Set(edges.map((edge) => edge.system));

  return {
    generatedAt,
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
}
