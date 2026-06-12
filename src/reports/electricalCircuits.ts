import { defaultRowhomeConfig } from "../core/config";
import { generateRowhome } from "../generators/rowhome";
import { conductorAmpacityByAwg, panelSchedule, type PanelScheduleEntry } from "../generators/electrical";

export interface ElectricalConnectionEdge {
  fromComponentId: string;
  toComponentId: string;
}

export interface BreakerWireCompatibility {
  circuitId: string;
  breakerAmps: number;
  conductorAwg: number;
  conductorAmpacityAmps: number;
  compatible: boolean;
}

export interface ElectricalCircuitReport {
  generatedAt: string;
  purpose: string;
  scope: string;
  electricalComponentCount: number;
  connectionEdgeCount: number;
  panelSchedule: PanelScheduleEntry[];
  serviceChain: string[];
  serviceChainConnected: boolean;
  unreachableComponentIds: string[];
  danglingConnectionReferences: string[];
  breakerWireCompatibility: BreakerWireCompatibility[];
  terminalCoverage: {
    lightingTerminals: number;
    receptacleTerminals: number;
    has240vRangeCircuit: boolean;
    hasHvacCircuits: boolean;
    hasWaterHeaterCircuit: boolean;
  };
  checks: {
    serviceChainConnected: boolean;
    allElectricalComponentsReachable: boolean;
    allBreakersWireCompatible: boolean;
    rangeCircuitIs240v50a6awg: boolean;
    everyScheduledComponentExists: boolean;
    noGasAppliances: boolean;
  };
}

const serviceChain = [
  "service-mast",
  "meter-socket",
  "service-entrance-conductors",
  "service-disconnect",
  "main-feeder-run",
  "electrical-panel"
];

/**
 * Components that are visual markers or free-standing plug-in furniture pieces;
 * they participate in the model but not in the fixed-wiring connectivity graph.
 */
const connectivityExemptIds = new Set(["electrical-panel-working-clearance"]);

function extractConnectionEdges(componentIds: Set<string>, notesById: Map<string, string[]>): {
  edges: ElectricalConnectionEdge[];
  dangling: string[];
} {
  const edges: ElectricalConnectionEdge[] = [];
  const dangling: string[] = [];
  const idToken = /[a-z0-9]+(?:-[a-z0-9]+)+/g;
  for (const [componentId, notes] of notesById) {
    for (const note of notes) {
      if (!/connected (?:to|by)/i.test(note)) {
        continue;
      }
      const tokens = note.match(idToken) ?? [];
      let matched = false;
      for (const token of tokens) {
        if (token !== componentId && componentIds.has(token)) {
          edges.push({ fromComponentId: componentId, toComponentId: token });
          matched = true;
        }
      }
      if (!matched) {
        dangling.push(`${componentId}: ${note}`);
      }
    }
  }
  return { edges, dangling };
}

function reachableFrom(rootId: string, edges: ElectricalConnectionEdge[]): Set<string> {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    for (const [a, b] of [
      [edge.fromComponentId, edge.toComponentId],
      [edge.toComponentId, edge.fromComponentId]
    ]) {
      const list = adjacency.get(a) ?? [];
      list.push(b);
      adjacency.set(a, list);
    }
  }
  const visited = new Set<string>([rootId]);
  const queue = [rootId];
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

export function buildElectricalCircuitReport(generatedAt = new Date().toISOString()): ElectricalCircuitReport {
  const model = generateRowhome(defaultRowhomeConfig);
  const electricalComponents = model.components.filter((component) => component.metadata.category === "electrical");
  const electricalIds = new Set(electricalComponents.map((component) => component.metadata.id));
  const notesById = new Map(
    electricalComponents.map((component) => [component.metadata.id, component.metadata.notes ?? []])
  );

  const { edges, dangling } = extractConnectionEdges(electricalIds, notesById);
  const reachable = reachableFrom("electrical-panel", edges);
  const serviceChainConnected = serviceChain.every((id, index) => {
    if (!electricalIds.has(id)) {
      return false;
    }
    if (index === 0) {
      return true;
    }
    const previous = serviceChain[index - 1];
    return edges.some(
      (edge) =>
        (edge.fromComponentId === id && edge.toComponentId === previous) ||
        (edge.fromComponentId === previous && edge.toComponentId === id)
    );
  });

  const unreachableComponentIds = [...electricalIds].filter(
    (id) => !reachable.has(id) && !connectivityExemptIds.has(id)
  );

  const breakerWireCompatibility: BreakerWireCompatibility[] = panelSchedule.map((entry) => {
    const ampacity = conductorAmpacityByAwg[entry.conductorAwg] ?? 0;
    return {
      circuitId: entry.circuitId,
      breakerAmps: entry.breakerAmps,
      conductorAwg: entry.conductorAwg,
      conductorAmpacityAmps: ampacity,
      compatible: entry.breakerAmps <= ampacity
    };
  });

  const rangeEntry = panelSchedule.find((entry) => entry.circuitId === "breaker-range-240v");
  const everyScheduledComponentExists = panelSchedule.every((entry) =>
    entry.servedComponentIds.every((componentId) => electricalIds.has(componentId))
  );
  const gasPattern = /\bgas\b|gas-fired|gas pip/i;
  const noGasAppliances = model.components.every(
    (component) => !gasPattern.test(component.metadata.material) && !gasPattern.test(component.metadata.name)
  );

  return {
    generatedAt,
    purpose:
      "Headless electrical circuit connectivity and panel-schedule preflight report. Connectivity is verified across the modeled service chain, panel, breakers, branch circuits, and terminal devices.",
    scope:
      "Schematic verification only: confirms the modeled all-electric system is topologically complete and the schedule is internally consistent. It is not a load calculation, AFCI/GFCI selection, or licensed electrical design.",
    electricalComponentCount: electricalComponents.length,
    connectionEdgeCount: edges.length,
    panelSchedule,
    serviceChain,
    serviceChainConnected,
    unreachableComponentIds,
    danglingConnectionReferences: dangling,
    breakerWireCompatibility,
    terminalCoverage: {
      lightingTerminals: electricalComponents.filter((component) => component.metadata.id.startsWith("overhead-light-")).length,
      receptacleTerminals: electricalComponents.filter((component) => /^receptacle-120v-\d+$/.test(component.metadata.id)).length,
      has240vRangeCircuit: electricalIds.has("range-240v-circuit") && electricalIds.has("kitchen-240v-outlet"),
      hasHvacCircuits: electricalIds.has("air-handler-branch-circuit") && electricalIds.has("central-ac-condenser-branch-circuit"),
      hasWaterHeaterCircuit: electricalIds.has("water-heater-branch-circuit")
    },
    checks: {
      serviceChainConnected,
      allElectricalComponentsReachable: unreachableComponentIds.length === 0,
      allBreakersWireCompatible: breakerWireCompatibility.every((entry) => entry.compatible),
      rangeCircuitIs240v50a6awg:
        rangeEntry?.voltage === 240 && rangeEntry.breakerAmps === 50 && rangeEntry.conductorAwg === 6 && rangeEntry.poles === 2,
      everyScheduledComponentExists,
      noGasAppliances
    }
  };
}
