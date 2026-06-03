import type { ModelComponent, RowhomeConfig } from "../core/types";
import { sources } from "../core/sources";
import { makeHollowRectangularDuctComponent, type DuctAxis } from "../geometry/component";
import { box, metadata } from "./builder";

interface FlowDuctSpec {
  id: string;
  name: string;
  material: string;
  color: string;
  outerWidth: number;
  outerHeight: number;
  length: number;
  wallThickness: number;
  center: { x: number; y: number; z: number };
  axis: DuctAxis;
  from: string;
  to: string;
  flowCfm: number;
  designVelocityFpm: number;
}

function duct(components: ModelComponent[], spec: FlowDuctSpec): void {
  const areaSqFt = Math.max((spec.outerWidth - spec.wallThickness * 2) * (spec.outerHeight - spec.wallThickness * 2), 0.01);
  const component = makeHollowRectangularDuctComponent(
    metadata(
      spec.id,
      spec.name,
      "systems",
      spec.material,
      sources.residentialCode,
      650,
      true,
      [
        "Hollow sheet-metal duct modeled with interior flow area for downstream thermofluid/FEM meshing.",
        `flow-node-from:${spec.from}`,
        `flow-node-to:${spec.to}`,
        `design-flow-cfm:${spec.flowCfm}`,
        `design-velocity-fpm:${spec.designVelocityFpm}`,
        `hydraulic-area-sqft:${areaSqFt.toFixed(3)}`,
        "Final Manual D sizing, balancing, leakage sealing, insulation, and commissioning require professional mechanical design."
      ]
    ),
    spec.color,
    spec.outerWidth,
    spec.outerHeight,
    spec.length,
    spec.wallThickness,
    spec.center,
    spec.axis
  );
  component.object.userData.hvac = {
    ...(component.object.userData.hvac ?? {}),
    from: spec.from,
    to: spec.to,
    flowCfm: spec.flowCfm,
    designVelocityFpm: spec.designVelocityFpm,
    hydraulicAreaSqFt: areaSqFt
  };
  components.push(component);
}

export function addStandardHvacSystem(
  components: ModelComponent[],
  config: RowhomeConfig,
  buildingHeight: number
): void {
  const w = config.buildingWidthFt;
  const d = config.buildingDepthFt;
  const notes = [
    "All-electric heat-pump HVAC system with explicit supply, return, and exhaust flow paths.",
    "Ducts are hollow sheet-metal assemblies with flow-node metadata for FEM/CFD pre-processing.",
    "Supply and return duct mains are modeled as insulated low-leakage galvanized sheet-metal ducts; exhaust paths are modeled as smooth-wall metal ductwork."
  ];

  box(
    components,
    metadata("heat-pump-condenser", "Exterior electric heat pump condenser", "systems", "air-source heat pump condenser", sources.residentialCode, 6800, true, notes),
    "#58636b",
    3.2,
    3.2,
    3.0,
    { x: w - 2.6, y: d + 7.0, z: 1.5 }
  );
  box(
    components,
    metadata("condenser-pad", "Heat pump condenser pad", "systems", "concrete equipment pad", sources.residentialCode, 650, true, notes),
    "#8d918c",
    4.1,
    4.1,
    0.3,
    { x: w - 2.6, y: d + 7.0, z: 0.15 }
  );
  box(
    components,
    metadata("air-handler", "Indoor electric air handler", "systems", "electric air handler with supply and return plenums", sources.residentialCode, 5200, true, [...notes, "flow-node:air-handler"]),
    "#6e7780",
    2.8,
    2.2,
    5.0,
    { x: 3.1, y: d - 7.0, z: 3.0 }
  );
  box(
    components,
    metadata("supply-plenum", "Air handler supply plenum", "systems", "insulated galvanized steel supply plenum", sources.residentialCode, 950, true, [...notes, "flow-node:supply-plenum connected to air-handler"]),
    "#9aa7ad",
    2.8,
    1.6,
    1.1,
    { x: 3.1, y: d - 8.9, z: 5.85 }
  );
  box(
    components,
    metadata("return-plenum", "Air handler return plenum", "systems", "insulated galvanized steel return plenum", sources.residentialCode, 850, true, [...notes, "flow-node:return-plenum connected to air-handler"]),
    "#7f8b91",
    2.6,
    1.4,
    1.0,
    { x: 3.1, y: d - 5.55, z: 3.55 }
  );
  box(
    components,
    metadata("refrigerant-lineset", "Refrigerant and control lineset", "systems", "insulated refrigerant lines and control wire", sources.residentialCode, 1250, true, notes),
    "#2fb7c8",
    0.18,
    12.0,
    0.18,
    { x: w - 2.6, y: d + 1.0, z: 2.7 }
  );

  for (let floor = 0; floor < config.stories; floor += 1) {
    const level = floor + 1;
    const supplyZ = floor * config.storyHeightFt + 8.2;
    const returnZ = supplyZ - 0.85;
    duct(components, {
      id: `supply-trunk-${level}`,
      name: `Hollow supply duct trunk floor ${level}`,
      material: "hollow insulated low-leakage galvanized sheet-metal rectangular supply duct",
      color: "#9aa7ad",
      outerWidth: 1.05,
      outerHeight: 0.62,
      length: d - 8.0,
      wallThickness: 0.035,
      center: { x: 6.2, y: d / 2, z: supplyZ },
      axis: "y",
      from: floor === 0 ? "supply-plenum" : `supply-riser-${level}`,
      to: `supply-trunk-${level}-end`,
      flowCfm: floor === 0 ? 520 : 360,
      designVelocityFpm: 720
    });
    duct(components, {
      id: `return-trunk-${level}`,
      name: `Hollow return duct trunk floor ${level}`,
      material: "hollow insulated low-leakage galvanized sheet-metal rectangular return duct",
      color: "#7f8b91",
      outerWidth: 0.9,
      outerHeight: 0.58,
      length: d - 12.0,
      wallThickness: 0.035,
      center: { x: 11.8, y: d / 2 + 2.0, z: returnZ },
      axis: "y",
      from: `return-grille-zone-${level}`,
      to: floor === 0 ? "return-plenum" : `return-riser-${level}`,
      flowCfm: floor === 0 ? 520 : 360,
      designVelocityFpm: 650
    });
    if (floor > 0) {
      duct(components, {
        id: `supply-riser-${level}`,
        name: `Hollow supply riser to floor ${level}`,
        material: "hollow insulated low-leakage galvanized sheet-metal vertical supply riser",
        color: "#9aa7ad",
        outerWidth: 0.8,
        outerHeight: 0.55,
        length: config.storyHeightFt,
        wallThickness: 0.035,
        center: { x: 6.2, y: d - 7.8, z: floor * config.storyHeightFt + config.storyHeightFt / 2 },
        axis: "z",
        from: floor === 1 ? "supply-plenum" : `supply-riser-${level - 1}`,
        to: `supply-trunk-${level}`,
        flowCfm: 360,
        designVelocityFpm: 700
      });
      duct(components, {
        id: `return-riser-${level}`,
        name: `Hollow return riser from floor ${level}`,
        material: "hollow insulated low-leakage galvanized sheet-metal vertical return riser",
        color: "#7f8b91",
        outerWidth: 0.75,
        outerHeight: 0.55,
        length: config.storyHeightFt,
        wallThickness: 0.035,
        center: { x: 11.8, y: d - 6.2, z: floor * config.storyHeightFt + config.storyHeightFt / 2 },
        axis: "z",
        from: `return-trunk-${level}`,
        to: floor === 1 ? "return-plenum" : `return-riser-${level - 1}`,
        flowCfm: 360,
        designVelocityFpm: 650
      });
    }

    for (const [room, y, flow] of [["front", 9.0, 130], ["middle", 24.0, 120], ["rear", 40.0, 150]] as const) {
      duct(components, {
        id: `supply-branch-${room}-${level}`,
        name: `Hollow supply branch ${room} floor ${level}`,
        material: "hollow insulated galvanized sheet-metal rectangular supply branch duct",
        color: "#aeb8bd",
        outerWidth: 0.62,
        outerHeight: 0.36,
        length: 2.0,
        wallThickness: 0.03,
        center: { x: 5.8, y, z: supplyZ },
        axis: "x",
        from: `supply-trunk-${level}`,
        to: `supply-register-${room}-${level}`,
        flowCfm: flow,
        designVelocityFpm: 600
      });
      box(
        components,
        metadata(`supply-register-${room}-${level}`, `Supply register ${room} floor ${level}`, "systems", "louvered supply register connected to hollow branch duct", sources.residentialCode, 180, true, [...notes, `flow-node:supply-register-${room}-${level}`, `connected to supply-branch-${room}-${level}`, `design-flow-cfm:${flow}`]),
        "#c5d0d5",
        1.2,
        0.5,
        0.12,
        { x: 5.3, y, z: floor * config.storyHeightFt + 8.55 }
      );
    }
    box(
      components,
      metadata(`return-grille-zone-${level}`, `Return grille floor ${level}`, "systems", "louvered return grille connected to hollow return trunk", sources.residentialCode, 220, true, [...notes, `flow-node:return-grille-zone-${level}`, `connected to return-trunk-${level}`]),
      "#9aa4a9",
      1.4,
      0.18,
      1.0,
      { x: 11.8, y: 18.0, z: floor * config.storyHeightFt + 6.8 }
    );
  }

  duct(components, {
    id: "bath-exhaust-duct",
    name: "Hollow bathroom exhaust duct to roof",
    material: "hollow smooth-wall galvanized steel bathroom exhaust duct",
    color: "#b4bdc1",
    outerWidth: 0.55,
    outerHeight: 0.55,
    length: buildingHeight,
    wallThickness: 0.03,
    center: { x: 14.5, y: 31.0, z: buildingHeight / 2 },
    axis: "z",
    from: "bath-exhaust-grille",
    to: "roof-exhaust-termination",
    flowCfm: 80,
    designVelocityFpm: 900
  });
  duct(components, {
    id: "kitchen-range-hood-duct",
    name: "Hollow kitchen range hood exhaust duct",
    material: "hollow smooth-wall rigid metal range hood exhaust duct",
    color: "#b4bdc1",
    outerWidth: 0.65,
    outerHeight: 0.65,
    length: 8.0,
    wallThickness: 0.03,
    center: { x: 13.8, y: 9.0, z: 8.4 },
    axis: "y",
    from: "range-hood",
    to: "rear-wall-exhaust-termination",
    flowCfm: 180,
    designVelocityFpm: 1000
  });
}
