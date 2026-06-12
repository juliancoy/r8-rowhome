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
  nodeBalances: Array<{
    node: string;
    inflowCfm: number;
    outflowCfm: number;
    imbalanceCfm: number;
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
    supplyNetworkFullyConnected: boolean;
    returnNetworkFullyConnected: boolean;
    nodalFlowConservation: boolean;
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

function reachableNodes(edges: HvacFlowEdge[], rootNode: string): Set<string> {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const targets = adjacency.get(edge.from) ?? [];
    targets.push(edge.to);
    adjacency.set(edge.from, targets);
  }
  const visited = new Set<string>([rootNode]);
  const queue = [rootNode];
  while (queue.length > 0) {
    const node = queue.shift() as string;
    for (const next of adjacency.get(node) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return visited;
}

export interface HvacNodeBalance {
  node: string;
  inflowCfm: number;
  outflowCfm: number;
  imbalanceCfm: number;
}

export function hvacNodeBalances(edges: HvacFlowEdge[]): HvacNodeBalance[] {
  const inflow = new Map<string, number>();
  const outflow = new Map<string, number>();
  for (const edge of edges) {
    outflow.set(edge.from, (outflow.get(edge.from) ?? 0) + edge.flowCfm);
    inflow.set(edge.to, (inflow.get(edge.to) ?? 0) + edge.flowCfm);
  }
  const nodes = new Set([...inflow.keys(), ...outflow.keys()]);
  const balances: HvacNodeBalance[] = [];
  for (const node of nodes) {
    const inCfm = inflow.get(node) ?? 0;
    const outCfm = outflow.get(node) ?? 0;
    // Boundary nodes (sources and sinks) only flow one way and are excluded from conservation.
    if (inCfm === 0 || outCfm === 0) {
      continue;
    }
    balances.push({ node, inflowCfm: inCfm, outflowCfm: outCfm, imbalanceCfm: Math.round((inCfm - outCfm) * 100) / 100 });
  }
  return balances;
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

  const supplyReachable = reachableNodes(supplyEdges, "supply-plenum");
  const supplyRegisterNodes = [...nodeIds].filter((node) => node.startsWith("supply-register-"));
  const supplyNetworkFullyConnected = supplyRegisterNodes.length > 0 && supplyRegisterNodes.every((node) => supplyReachable.has(node));
  const returnGrilleNodes = [...nodeIds].filter((node) => node.startsWith("return-grille-zone-"));
  const returnNetworkFullyConnected =
    returnGrilleNodes.length > 0 &&
    returnGrilleNodes.every((node) => reachableNodes(returnEdges, node).has("return-plenum"));
  const balances = hvacNodeBalances([...supplyEdges, ...returnEdges]);
  const nodalFlowConservation = balances.length > 0 && balances.every((balance) => Math.abs(balance.imbalanceCfm) <= 2);

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
    nodeBalances: balances,
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
      heatingEveryFloor: [1, 2, 3].every((level) => heatingTerminals.some((terminal) => terminal.level === level && terminal.heatingBtuh > 0)),
      supplyNetworkFullyConnected,
      returnNetworkFullyConnected,
      nodalFlowConservation
    },
    edges
  };
}
