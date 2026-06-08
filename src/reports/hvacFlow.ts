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
  role: "supply" | "return" | "exhaust";
  network: string;
  boundaryCondition: string;
}

export interface HvacFlowReport {
  generatedAt: string;
  purpose: string;
  scope: string;
  edgeCount: number;
  nodeCount: number;
  totals: {
    supplyTerminalCfm: number;
    returnTerminalCfm: number;
    exhaustCfm: number;
  };
  floorAirBalance: Array<{
    level: number;
    supplyCfm: number;
    returnCfm: number;
    deltaCfm: number;
    heatingTerminalId: string;
    heatingBtuh: number;
  }>;
  checks: {
    allSegmentsHavePositiveArea: boolean;
    allSegmentsHavePositiveFlow: boolean;
    allSegmentsHavePositiveDimensions: boolean;
    hasSupplyNetwork: boolean;
    hasReturnNetwork: boolean;
    hasExhaustNetwork: boolean;
    isCentralCoolingAirflowNetwork: boolean;
    supplyReturnBalanced: boolean;
    hasRoomSupplyTerminals: boolean;
    hasPerFloorReturnPaths: boolean;
    centralCoolingBalancedByFloor: boolean;
    hasFloorIndependentHeating: boolean;
    heatingEveryFloor: boolean;
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
        lengthFt: hvac.lengthFt,
        role: hvac.role,
        network: hvac.network,
        boundaryCondition: hvac.boundaryCondition
      };
    });
}

export function buildHvacFlowReport(generatedAt = new Date().toISOString()): HvacFlowReport {
  const model = generateRowhome(defaultRowhomeConfig);
  const edges = hvacFlowEdges();
  const nodeIds = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
  const supplyEdges = edges.filter((edge) => edge.id.startsWith("supply-"));
  const returnEdges = edges.filter((edge) => edge.id.startsWith("return-"));
  const exhaustEdges = edges.filter((edge) => edge.id.includes("exhaust") || edge.id.includes("range-hood"));
  const supplyTerminalCfm = supplyEdges.filter((edge) => edge.to.startsWith("supply-register")).reduce((sum, edge) => sum + edge.flowCfm, 0);
  const returnTerminalCfm = returnEdges.filter((edge) => edge.from.startsWith("return-grille")).reduce((sum, edge) => sum + edge.flowCfm, 0);
  const heatingTerminals = model.components
    .filter((component) => component.object.userData.hvacHeating?.strategy === "floor-independent-electric")
    .map((component) => component.object.userData.hvacHeating as { level: number; terminalId: string; heatingBtuh: number });
  const floorAirBalance = [1, 2, 3].map((level) => {
    const supplyCfm = supplyEdges
      .filter((edge) => edge.to.endsWith(`-${level}`) && edge.to.startsWith("supply-register"))
      .reduce((sum, edge) => sum + edge.flowCfm, 0);
    const returnCfm = returnEdges
      .filter((edge) => edge.from === `return-grille-zone-${level}`)
      .reduce((sum, edge) => sum + edge.flowCfm, 0);
    const heating = heatingTerminals.find((terminal) => terminal.level === level);
    return {
      level,
      supplyCfm,
      returnCfm,
      deltaCfm: supplyCfm - returnCfm,
      heatingTerminalId: heating?.terminalId ?? "",
      heatingBtuh: heating?.heatingBtuh ?? 0
    };
  });

  return {
    generatedAt,
    purpose: "Headless CI duct-airflow preflight report. The website renderer does not run this test or FEM workflow.",
    scope: "Airflow only: Central AC cooling airflow edges model connected supply/return/exhaust topology for fluid preprocessing; they do not model conductive, radiant, or room heat transfer, Manual J loads, Manual S selection, Manual D sizing, or solved CFD.",
    edgeCount: edges.length,
    nodeCount: nodeIds.size,
    totals: {
      supplyTerminalCfm,
      returnTerminalCfm,
      exhaustCfm: exhaustEdges.reduce((sum, edge) => sum + edge.flowCfm, 0)
    },
    floorAirBalance,
    checks: {
      allSegmentsHavePositiveArea: edges.every((edge) => edge.hydraulicAreaSqFt > 0),
      allSegmentsHavePositiveFlow: edges.every((edge) => edge.flowCfm > 0),
      allSegmentsHavePositiveDimensions: edges.every((edge) => edge.innerWidthFt > 0 && edge.innerHeightFt > 0 && edge.lengthFt > 0),
      hasSupplyNetwork: supplyEdges.length >= 12,
      hasReturnNetwork: returnEdges.length >= 5,
      hasExhaustNetwork: exhaustEdges.length >= 2,
      isCentralCoolingAirflowNetwork: edges.every((edge) => edge.network === "central-cooling-airflow" && edge.boundaryCondition.length > 0),
      supplyReturnBalanced: Math.abs(supplyTerminalCfm - returnTerminalCfm) <= 1,
      hasRoomSupplyTerminals: ["front", "middle", "rear"].every((room) => [1, 2, 3].every((level) => supplyEdges.some((edge) => edge.to === `supply-register-${room}-${level}`))),
      hasPerFloorReturnPaths: [1, 2, 3].every((level) => returnEdges.some((edge) => edge.from === `return-grille-zone-${level}`)),
      centralCoolingBalancedByFloor: floorAirBalance.every((floor) => Math.abs(floor.deltaCfm) <= 1),
      hasFloorIndependentHeating: heatingTerminals.length > 0,
      heatingEveryFloor: [1, 2, 3].every((level) => heatingTerminals.some((terminal) => terminal.level === level && terminal.heatingBtuh > 0))
    },
    edges
  };
}
