import type { ModelComponent, RowhomeConfig } from "../core/types";
import { sources } from "../core/sources";
import { makeHollowPipeComponent, type PipeAxis } from "../geometry/component";
import { box, metadata } from "./builder";

type PlumbingSystem = "cold-water" | "hot-water" | "sanitary-dwv" | "vent" | "storm" | "condensate";

interface PipeSpec {
  id: string;
  name: string;
  system: PlumbingSystem;
  material: string;
  color: string;
  nominalDiameterIn: number;
  outerDiameterIn: number;
  wallThicknessIn: number;
  length: number;
  center: { x: number; y: number; z: number };
  axis: PipeAxis;
  from: string;
  to: string;
  designFlowGpm?: number;
  drainageFixtureUnits?: number;
  slopePercent?: number;
}

function pipe(components: ModelComponent[], spec: PipeSpec): void {
  const outerRadius = spec.outerDiameterIn / 24;
  const innerRadius = Math.max(outerRadius - spec.wallThicknessIn / 12, 0.01);
  const innerAreaSqFt = Math.PI * innerRadius * innerRadius;
  const notes = [
    "Hollow pipe modeled with annular wall geometry and open internal flow area for fluid-analysis export.",
    `plumbing-system:${spec.system}`,
    `flow-node-from:${spec.from}`,
    `flow-node-to:${spec.to}`,
    `nominal-diameter-in:${spec.nominalDiameterIn}`,
    `inner-area-sqft:${innerAreaSqFt.toFixed(4)}`,
    `design-flow-gpm:${spec.designFlowGpm ?? 0}`,
    `drainage-fixture-units:${spec.drainageFixtureUnits ?? 0}`,
    `slope-percent:${spec.slopePercent ?? 0}`,
    "Final pipe sizing, trap/vent design, slopes, supports, freeze protection, cleanouts, and public utility connections require licensed plumbing design."
  ];
  const component = makeHollowPipeComponent(
    metadata(spec.id, spec.name, "systems", spec.material, sources.plumbingCode, 420, true, notes),
    spec.color,
    outerRadius,
    innerRadius,
    spec.length,
    spec.center,
    spec.axis,
    20
  );
  component.object.userData.plumbing = {
    ...(component.object.userData.plumbing ?? {}),
    system: spec.system,
    from: spec.from,
    to: spec.to,
    nominalDiameterIn: spec.nominalDiameterIn,
    innerAreaSqFt,
    designFlowGpm: spec.designFlowGpm ?? 0,
    drainageFixtureUnits: spec.drainageFixtureUnits ?? 0,
    slopePercent: spec.slopePercent ?? 0
  };
  components.push(component);
}

export function addStandardPlumbingSystem(
  components: ModelComponent[],
  config: RowhomeConfig,
  buildingHeight: number
): void {
  const w = config.buildingWidthFt;
  const d = config.buildingDepthFt;
  const basementZ = -config.basementDepthFt + 2.4;
  const notes = [
    "Connected plumbing system referencing local plumbing-code source: water service, domestic hot/cold distribution, sanitary drainage, venting, storm leader, and condensate disposal.",
    "Pipes are hollow and include system, node, flow, DFU, slope, and internal-area metadata for fluid-analysis preprocessing."
  ];
  const fixtureNotes = [...notes, "Fixture is connected to potable supply and/or DWV piping by named flow nodes."];

  for (const [id, name, x, y, z] of [
    ["bath-1-toilet", "First floor water closet", 13.6, 28.2, 1.35],
    ["bath-1-lavatory", "First floor lavatory", 15.2, 27.0, 2.7],
    ["bath-1-shower", "First floor shower pan", 15.0, 30.0, 0.3],
    ["bath-2-toilet", "Second floor water closet", 13.6, 28.2, 11.35],
    ["bath-2-lavatory", "Second floor lavatory", 15.2, 27.0, 12.7],
    ["bath-2-shower", "Second floor shower pan", 15.0, 30.0, 10.3],
    ["bath-3-toilet", "Third floor water closet", 13.6, 28.2, 21.35],
    ["bath-3-lavatory", "Third floor lavatory", 15.2, 27.0, 22.7],
    ["bath-3-shower", "Third floor shower pan", 15.0, 30.0, 20.3]
  ] as const) {
    box(
      components,
      metadata(id, name, "systems", id.includes("toilet") ? "vitreous china plumbing fixture" : id.includes("lavatory") ? "lavatory sink and faucet" : "shower receptor and mixing valve", sources.plumbingCode, 650, true, fixtureNotes),
      id.includes("toilet") ? "#f4f1ea" : "#dbe6ea",
      id.includes("shower") ? 2.7 : 1.5,
      id.includes("shower") ? 2.7 : 1.2,
      id.includes("shower") ? 0.35 : 1.6,
      { x, y, z }
    );
  }

  for (const [id, name, x, y, z] of [
    ["main-water-shutoff", "Main water shutoff valve", 4.0, 3.0, basementZ],
    ["pressure-reducing-valve", "Pressure reducing valve", 4.7, 3.0, basementZ],
    ["domestic-backflow-preventer", "Domestic water backflow preventer", 5.4, 3.0, basementZ],
    ["cold-water-manifold", "Cold water distribution manifold", 6.2, 4.0, basementZ],
    ["hot-water-manifold", "Hot water distribution manifold", 6.2, 5.1, basementZ]
  ] as const) {
    box(
      components,
      metadata(id, name, "systems", "standard plumbing valve or manifold", sources.plumbingCode, 360, true, fixtureNotes),
      "#406b87",
      0.7,
      0.36,
      0.36,
      { x, y, z }
    );
  }

  pipe(components, { id: "water-service-lateral", name: "Public water service lateral", system: "cold-water", material: "hollow HDPE or approved water service pipe", color: "#2e6f9e", nominalDiameterIn: 1, outerDiameterIn: 1.315, wallThicknessIn: 0.13, length: 8.0, center: { x: 4.0, y: -1.0, z: basementZ }, axis: "y", from: "public-water-main", to: "main-water-shutoff", designFlowGpm: 18 });
  pipe(components, { id: "cold-main-to-backflow", name: "Cold water main through shutoff and backflow", system: "cold-water", material: "hollow Type L copper water tube", color: "#2f8fcb", nominalDiameterIn: 1, outerDiameterIn: 1.125, wallThicknessIn: 0.045, length: 2.2, center: { x: 4.7, y: 3.0, z: basementZ }, axis: "x", from: "main-water-shutoff", to: "domestic-backflow-preventer", designFlowGpm: 18 });
  pipe(components, { id: "backflow-to-cold-water-manifold", name: "Backflow preventer outlet to cold water manifold", system: "cold-water", material: "hollow Type L copper water tube", color: "#2f8fcb", nominalDiameterIn: 1, outerDiameterIn: 1.125, wallThicknessIn: 0.045, length: 0.8, center: { x: 5.8, y: 3.0, z: basementZ }, axis: "x", from: "domestic-backflow-preventer", to: "cold-water-manifold", designFlowGpm: 18 });
  pipe(components, { id: "cold-feed-to-water-heater", name: "Cold feed to heat pump water heater", system: "cold-water", material: "hollow Type L copper water tube", color: "#2f8fcb", nominalDiameterIn: 0.75, outerDiameterIn: 0.875, wallThicknessIn: 0.045, length: d - 10.0, center: { x: 5.0, y: (4.0 + d - 6.0) / 2, z: basementZ }, axis: "y", from: "cold-water-manifold", to: "electric-water-heater", designFlowGpm: 10 });
  pipe(components, { id: "hot-outlet-from-water-heater", name: "Hot outlet from heat pump water heater", system: "hot-water", material: "hollow Type L copper hot water tube", color: "#c96d2d", nominalDiameterIn: 0.75, outerDiameterIn: 0.875, wallThicknessIn: 0.045, length: d - 11.1, center: { x: 6.0, y: (5.1 + d - 6.0) / 2, z: basementZ + 0.4 }, axis: "y", from: "electric-water-heater", to: "hot-water-manifold", designFlowGpm: 10 });

  for (const [system, x, color, node] of [["cold-water", 12.6, "#2f8fcb", "cold-water-riser"], ["hot-water", 12.95, "#c96d2d", "hot-water-riser"]] as const) {
    pipe(components, { id: `${system}-vertical-riser`, name: `${system} vertical riser`, system, material: system === "cold-water" ? "hollow Type L copper cold water riser" : "hollow Type L copper hot water riser", color, nominalDiameterIn: 0.75, outerDiameterIn: 0.875, wallThicknessIn: 0.045, length: buildingHeight + config.basementDepthFt - 2.0, center: { x, y: 27.4, z: (buildingHeight - config.basementDepthFt) / 2 }, axis: "z", from: system === "cold-water" ? "cold-water-manifold" : "hot-water-manifold", to: node, designFlowGpm: 12 });
  }

  const fixtureBranches = [
    ["kitchen-sink", 12.2, 35.4, 3.25, 1.8],
    ["bath-1-lavatory", 15.2, 27.0, 2.7, 1.5],
    ["bath-1-shower", 15.0, 30.0, 2.2, 2.2],
    ["bath-2-lavatory", 15.2, 27.0, 12.7, 1.5],
    ["bath-2-shower", 15.0, 30.0, 12.2, 2.2],
    ["bath-3-lavatory", 15.2, 27.0, 22.7, 1.5],
    ["bath-3-shower", 15.0, 30.0, 22.2, 2.2]
  ] as const;
  for (const [fixture, x, y, z, flow] of fixtureBranches) {
    pipe(components, { id: `cold-branch-to-${fixture}`, name: `Cold water branch to ${fixture}`, system: "cold-water", material: "hollow PEX or copper fixture supply tubing", color: "#4ba3d3", nominalDiameterIn: 0.5, outerDiameterIn: 0.625, wallThicknessIn: 0.06, length: Math.max(1.0, x - 12.6), center: { x: (x + 12.6) / 2, y, z }, axis: "x", from: "cold-water-riser", to: fixture, designFlowGpm: flow });
    pipe(components, { id: `hot-branch-to-${fixture}`, name: `Hot water branch to ${fixture}`, system: "hot-water", material: "hollow PEX or copper fixture supply tubing", color: "#d88446", nominalDiameterIn: 0.5, outerDiameterIn: 0.625, wallThicknessIn: 0.06, length: Math.max(1.0, x - 12.95), center: { x: (x + 12.95) / 2, y: y + 0.18, z: z + 0.14 }, axis: "x", from: "hot-water-riser", to: fixture, designFlowGpm: flow });
  }
  for (const [fixture, x, y, z] of [["bath-1-toilet", 13.6, 28.2, 2.1], ["bath-2-toilet", 13.6, 28.2, 12.1], ["bath-3-toilet", 13.6, 28.2, 22.1]] as const) {
    pipe(components, { id: `cold-branch-to-${fixture}`, name: `Cold water branch to ${fixture}`, system: "cold-water", material: "hollow PEX or copper toilet supply tubing", color: "#4ba3d3", nominalDiameterIn: 0.5, outerDiameterIn: 0.625, wallThicknessIn: 0.06, length: Math.max(1.0, x - 12.6), center: { x: (x + 12.6) / 2, y, z }, axis: "x", from: "cold-water-riser", to: fixture, designFlowGpm: 2.2 });
  }

  pipe(components, { id: "sanitary-building-drain", name: "Sanitary building drain to public sewer", system: "sanitary-dwv", material: "hollow PVC sanitary building drain pipe", color: "#5f6570", nominalDiameterIn: 4, outerDiameterIn: 4.5, wallThicknessIn: 0.12, length: 12.0, center: { x: 13.4, y: 20.0, z: -7.2 }, axis: "y", from: "soil-stack-base", to: "public-sanitary-sewer", drainageFixtureUnits: 24, slopePercent: 2 });
  pipe(components, { id: "soil-stack", name: "Main soil and waste stack", system: "sanitary-dwv", material: "hollow PVC DWV soil stack", color: "#6c727a", nominalDiameterIn: 3, outerDiameterIn: 3.5, wallThicknessIn: 0.12, length: buildingHeight + config.basementDepthFt, center: { x: 13.4, y: 28.2, z: (buildingHeight - config.basementDepthFt) / 2 }, axis: "z", from: "soil-stack-base", to: "vent-stack", drainageFixtureUnits: 24, slopePercent: 0 });
  pipe(components, { id: "vent-stack-through-roof", name: "Plumbing vent stack through roof", system: "vent", material: "hollow PVC plumbing vent pipe", color: "#8e9499", nominalDiameterIn: 2, outerDiameterIn: 2.375, wallThicknessIn: 0.1, length: buildingHeight + 2.0, center: { x: 13.9, y: 28.0, z: buildingHeight / 2 + 1.0 }, axis: "z", from: "vent-stack", to: "roof-vent-terminal", drainageFixtureUnits: 0, slopePercent: 0 });
  for (const [fixture, x, y, z, dfu] of [
    ["kitchen-sink", 12.2, 35.4, 2.2, 2],
    ["bath-1-toilet", 13.6, 28.2, 1.0, 3],
    ["bath-1-lavatory", 15.2, 27.0, 1.6, 1],
    ["bath-1-shower", 15.0, 30.0, 0.8, 2],
    ["bath-2-toilet", 13.6, 28.2, 11.0, 3],
    ["bath-2-lavatory", 15.2, 27.0, 11.6, 1],
    ["bath-2-shower", 15.0, 30.0, 10.8, 2],
    ["bath-3-toilet", 13.6, 28.2, 21.0, 3],
    ["bath-3-lavatory", 15.2, 27.0, 21.6, 1],
    ["bath-3-shower", 15.0, 30.0, 20.8, 2]
  ] as const) {
    pipe(components, { id: `dwv-branch-from-${fixture}`, name: `DWV branch from ${fixture}`, system: "sanitary-dwv", material: "hollow PVC DWV branch pipe with slope", color: "#6c727a", nominalDiameterIn: fixture.includes("toilet") ? 3 : 2, outerDiameterIn: fixture.includes("toilet") ? 3.5 : 2.375, wallThicknessIn: 0.1, length: Math.max(1.0, Math.abs(x - 13.4) + Math.abs(y - 28.2)), center: { x: (x + 13.4) / 2, y: (y + 28.2) / 2, z }, axis: Math.abs(x - 13.4) > Math.abs(y - 28.2) ? "x" : "y", from: fixture, to: "soil-stack", drainageFixtureUnits: dfu, slopePercent: 2 });
  }

  pipe(components, { id: "air-handler-condensate-drain", name: "Air handler condensate drain", system: "condensate", material: "hollow PVC condensate drain pipe with minimum slope", color: "#7ab7c8", nominalDiameterIn: 0.75, outerDiameterIn: 1.05, wallThicknessIn: 0.08, length: 9.0, center: { x: 4.5, y: d - 12.0, z: 2.4 }, axis: "y", from: "air-handler-condensate-pan", to: "sump-pit-or-approved-receptor", designFlowGpm: 0.5, slopePercent: 1 });
  pipe(components, { id: "roof-drain-leader", name: "Roof storm drain leader", system: "storm", material: "hollow PVC storm drain leader", color: "#4f7f95", nominalDiameterIn: 3, outerDiameterIn: 3.5, wallThicknessIn: 0.12, length: buildingHeight + 2.0, center: { x: w - 1.2, y: d - 2.0, z: buildingHeight / 2 }, axis: "z", from: "roof-drain", to: "storm-drain-or-approved-discharge", drainageFixtureUnits: 0, slopePercent: 0 });
}
