import { Box3 } from "three";
import { describe, expect, it } from "vitest";
import { defaultRowhomeConfig } from "../src/core/config";
import type { ModelComponent } from "../src/core/types";
import { buildBuildabilityReadiness } from "../src/buildability/readiness";
import { generateRowhome } from "../src/generators/rowhome";

function componentIds(components: ModelComponent[]): Set<string> {
  return new Set(components.map((component) => component.metadata.id));
}

function duplicateIds(components: ModelComponent[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const component of components) {
    if (seen.has(component.metadata.id)) {
      duplicates.add(component.metadata.id);
    }
    seen.add(component.metadata.id);
  }
  return [...duplicates].sort();
}

function boundsFor(component: ModelComponent): Box3 {
  component.object.updateMatrixWorld(true);
  return new Box3().setFromObject(component.object);
}

function graphFromEdges(edges: Array<{ from: string; to: string }>): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!graph.has(edge.from)) {
      graph.set(edge.from, new Set());
    }
    graph.get(edge.from)!.add(edge.to);
  }
  return graph;
}

function isReachable(graph: Map<string, Set<string>>, from: string, to: string): boolean {
  const queue = [from];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node === to) {
      return true;
    }
    if (visited.has(node)) {
      continue;
    }
    visited.add(node);
    queue.push(...(graph.get(node) ?? []));
  }
  return false;
}

describe("professional-practice rowhome acceptance checks", () => {
  it("uses unique, source-traced components with explicit nonconstruction warnings", () => {
    const model = generateRowhome(defaultRowhomeConfig);

    expect(duplicateIds(model.components)).toEqual([]);
    expect(model.components.every((component) => component.metadata.id.length > 0)).toBe(true);
    expect(model.components.every((component) => component.metadata.source.length > 0)).toBe(true);
    expect(model.components.every((component) => component.metadata.estimatedCostUsd >= 0)).toBe(true);
    expect(model.validation.some((message) => message.code === "professional_review_required")).toBe(true);
    expect(model.validation.some((message) => message.code === "conceptual_structural_model_only")).toBe(true);
    expect(model.validation.some((message) => message.code === "not_buildable_from_model")).toBe(true);
    expect(model.validation.some((message) => message.severity === "error")).toBe(false);
  });

  it("keeps buildability blockers explicit until licensed design and permits exist", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const readiness = buildBuildabilityReadiness(model);
    const blockers = readiness.items.filter((item) => item.status === "blocked");

    expect(readiness.status).toBe("not-buildable");
    expect(readiness.modelSupportedCount).toBeGreaterThanOrEqual(3);
    expect(readiness.blockerCount).toBeGreaterThanOrEqual(6);
    expect(readiness.items.some((item) =>
      item.id === "architect-roof-envelope-coordination-modeled"
        && item.status === "model-supported"
        && item.evidence.includes("architect-roof-access-bulkhead-weatherhood")
    )).toBe(true);
    expect(blockers.some((item) => item.id === "permit-approval-required")).toBe(true);
    expect(blockers.some((item) =>
      item.id === "sealed-architectural-drawings-required"
        && item.evidence.includes("architect-permit-document-index")
        && item.missingInputs.includes("licensed architect review")
    )).toBe(true);
    expect(blockers.some((item) => item.id === "structural-design-required" && item.missingInputs.includes("lateral loads"))).toBe(true);
    expect(blockers.some((item) => item.id === "hvac-design-required" && item.missingInputs.includes("Manual J cooling loads"))).toBe(true);
    expect(blockers.some((item) => item.id === "electrical-design-required" && item.missingInputs.includes("battery energy-storage listing and shutdown"))).toBe(true);
    expect(blockers.every((item) => item.requirement.length > 0 && item.source.length > 0 && item.missingInputs.length > 0)).toBe(true);
  });

  it("provides a practical rowhome program with furnished, usable rooms and egress", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const ids = componentIds(model.components);
    const roomIds = [
      "living-room-zone",
      "dining-room-zone",
      "kitchen-room-zone",
      "primary-bedroom-zone",
      "second-bedroom-zone",
      "third-floor-bedroom-zone",
      "office-room-zone"
    ];
    const furnishingIds = [
      "living-room-couch",
      "living-room-tv",
      "kitchen-island",
      "electric-range",
      "refrigerator",
      "kitchen-sink",
      "primary-bed",
      "second-bedroom-bed",
      "third-bedroom-bed"
    ];
    const egressIds = ["front-door", "rear-exit-door-1", "rear-exit-door-2", "rear-exit-door-3", "stoop", "fire-escape-yard-landing"];

    for (const id of [...roomIds, ...furnishingIds, ...egressIds]) {
      expect(ids.has(id), id).toBe(true);
    }

    for (const id of roomIds) {
      const component = model.components.find((item) => item.metadata.id === id);
      expect(component, id).toBeDefined();
      const bounds = boundsFor(component!);
      const width = bounds.max.x - bounds.min.x;
      const depth = bounds.max.z - bounds.min.z;
      expect(width, `${id} width`).toBeGreaterThanOrEqual(12);
      expect(depth, `${id} depth`).toBeGreaterThanOrEqual(10);
    }
  });

  it("keeps the all-electric HVAC supply, return, and exhaust networks connected", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const ids = componentIds(model.components);
    const hvacEdges = model.components
      .filter((component) => component.object.userData.hvac?.hollow === true)
      .map((component) => ({
        id: component.metadata.id,
        from: component.object.userData.hvac.from as string,
        to: component.object.userData.hvac.to as string,
        flowCfm: component.object.userData.hvac.flowCfm as number,
        hydraulicAreaSqFt: component.object.userData.hvac.hydraulicAreaSqFt as number
      }));
    const hvacGraph = graphFromEdges(hvacEdges);

    expect(ids.has("central-ac-condenser")).toBe(true);
    expect(ids.has("central-cooling-coil")).toBe(true);
    expect(ids.has("air-handler")).toBe(true);
    for (let level = 1; level <= defaultRowhomeConfig.stories; level += 1) {
      expect(ids.has(`floor-${level}-cooling-zone-terminal`), `floor ${level} cooling terminal`).toBe(true);
      expect(ids.has(`floor-${level}-cooling-thermostat`), `floor ${level} thermostat`).toBe(true);
    }
    expect(ids.has("supply-plenum")).toBe(true);
    expect(ids.has("return-plenum")).toBe(true);
    expect(hvacEdges.every((edge) => edge.flowCfm > 0 && edge.hydraulicAreaSqFt > 0)).toBe(true);

    for (let level = 1; level <= defaultRowhomeConfig.stories; level += 1) {
      for (const room of ["front", "middle", "rear"]) {
        expect(isReachable(hvacGraph, "supply-plenum", `supply-register-${room}-${level}`), `supply ${room} ${level}`).toBe(true);
      }
      expect(isReachable(hvacGraph, `return-grille-zone-${level}`, "return-plenum"), `return ${level}`).toBe(true);
    }
    expect(isReachable(hvacGraph, "bath-exhaust-grille", "roof-exhaust-termination")).toBe(true);
    expect(isReachable(hvacGraph, "range-hood", "rear-wall-exhaust-termination")).toBe(true);
  });

  it("keeps electric service, panel, HVAC, water-heater, lighting, and receptacle paths explicit", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const ids = componentIds(model.components);
    const required = [
      "service-mast",
      "meter-socket",
      "service-disconnect",
      "main-feeder-run",
      "electrical-panel",
      "electrical-panel-working-clearance",
      "breaker-main",
      "breaker-hvac",
      "breaker-pv-battery",
      "breaker-water-heater",
      "breaker-range-240v",
      "air-handler-branch-circuit",
      "central-ac-condenser-branch-circuit",
      "floor-1-cooling-control-circuit",
      "floor-2-cooling-control-circuit",
      "floor-3-cooling-control-circuit",
      "floor-1-heating-branch-circuit",
      "floor-2-heating-branch-circuit",
      "floor-3-heating-branch-circuit",
      "water-heater-branch-circuit",
      "range-240v-circuit",
      "kitchen-240v-outlet",
      "roof-solar-combiner",
      "pv-hybrid-inverter",
      "lithium-ion-battery",
      "battery-dc-disconnect",
      "pv-battery-ac-interconnection"
    ];

    for (const id of required) {
      expect(ids.has(id), id).toBe(true);
    }

    const connectedElectrical = model.components.filter((component) =>
      component.metadata.category === "electrical" && component.metadata.id !== "electrical-panel-working-clearance"
    );
    expect(connectedElectrical.every((component) => component.metadata.notes?.some((note) => /connected/i.test(note)))).toBe(true);
    expect(model.components.filter((component) => /^overhead-light-/.test(component.metadata.id)).length).toBeGreaterThanOrEqual(8);
    expect(model.components.filter((component) => /^receptacle-120v-/.test(component.metadata.id)).length).toBeGreaterThanOrEqual(8);
  });

  it("keeps potable water, DWV, vent, storm, and condensate plumbing networks connected", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const plumbingEdges = model.components
      .filter((component) => component.object.userData.plumbing?.hollow === true)
      .map((component) => ({
        id: component.metadata.id,
        system: component.object.userData.plumbing.system as string,
        from: component.object.userData.plumbing.from as string,
        to: component.object.userData.plumbing.to as string,
        innerAreaSqFt: component.object.userData.plumbing.innerAreaSqFt as number
      }));
    const bySystem = (system: string) => plumbingEdges.filter((edge) => edge.system === system);
    const coldGraph = graphFromEdges(bySystem("cold-water"));
    const hotGraph = graphFromEdges(bySystem("hot-water"));
    const dwvGraph = graphFromEdges(bySystem("sanitary-dwv"));
    const ventGraph = graphFromEdges(bySystem("vent"));
    const stormGraph = graphFromEdges(bySystem("storm"));
    const condensateGraph = graphFromEdges(bySystem("condensate"));
    const coldFixtures = ["kitchen-sink", "bath-1-lavatory", "bath-1-shower", "bath-1-toilet", "bath-2-lavatory", "bath-2-shower", "bath-2-toilet", "bath-3-lavatory", "bath-3-shower", "bath-3-toilet"];
    const hotFixtures = coldFixtures.filter((fixture) => !fixture.includes("toilet"));

    expect(plumbingEdges.every((edge) => edge.innerAreaSqFt > 0)).toBe(true);
    for (const fixture of coldFixtures) {
      expect(isReachable(coldGraph, "public-water-main", fixture), `cold ${fixture}`).toBe(true);
    }
    for (const fixture of hotFixtures) {
      expect(isReachable(hotGraph, "electric-water-heater", fixture), `hot ${fixture}`).toBe(true);
    }
    for (const fixture of ["kitchen-sink", ...coldFixtures]) {
      expect(isReachable(dwvGraph, fixture, "public-sanitary-sewer"), `dwv ${fixture}`).toBe(true);
    }
    expect(isReachable(ventGraph, "vent-stack", "roof-vent-terminal")).toBe(true);
    expect(isReachable(stormGraph, "roof-drain", "storm-drain-or-approved-discharge")).toBe(true);
    expect(isReachable(condensateGraph, "air-handler-condensate-pan", "sump-pit-or-approved-receptor")).toBe(true);
  });
});
