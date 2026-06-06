import { defaultRowhomeConfig } from "../core/config";
import { generateRowhome } from "../generators/rowhome";

export interface HvacFlowEdge {
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

export interface HvacFlowReport {
  generatedAt: string;
  purpose: string;
  scope: string;
  edgeCount: number;
  nodeCount: number;
  totals: {
    supplyTerminalCfm: number;
    exhaustCfm: number;
  };
  checks: {
    allSegmentsHavePositiveArea: boolean;
    allSegmentsHavePositiveFlow: boolean;
    allSegmentsHavePositiveDimensions: boolean;
    hasSupplyNetwork: boolean;
    hasReturnNetwork: boolean;
    hasExhaustNetwork: boolean;
  };
  edges: HvacFlowEdge[];
}

export function hvacFlowEdges(): HvacFlowEdge[] {
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

export function buildHvacFlowReport(generatedAt = new Date().toISOString()): HvacFlowReport {
  const edges = hvacFlowEdges();
  const nodeIds = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
  const supplyEdges = edges.filter((edge) => edge.id.startsWith("supply-"));
  const returnEdges = edges.filter((edge) => edge.id.startsWith("return-"));
  const exhaustEdges = edges.filter((edge) => edge.id.includes("exhaust") || edge.id.includes("range-hood"));

  return {
    generatedAt,
    purpose: "Headless CI duct-airflow preflight report. The website renderer does not run this test or FEM workflow.",
    scope: "Airflow only: these duct edges do not model conductive, radiant, or room heat transfer. Heating is represented by separate per-floor heat-pump indoor units and must be sized by Manual J/S.",
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
}
