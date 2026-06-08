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
  role: "supply" | "return" | "exhaust";
}

function duct(components: ModelComponent[], spec: FlowDuctSpec): void {
  const areaSqFt = Math.max((spec.outerWidth - spec.wallThickness * 2) * (spec.outerHeight - spec.wallThickness * 2), 0.01);
  const half = spec.length / 2;
  const start = {
    x: spec.center.x - (spec.axis === "x" ? half : 0),
    y: spec.center.y - (spec.axis === "y" ? half : 0),
    z: spec.center.z - (spec.axis === "z" ? half : 0)
  };
  const end = {
    x: spec.center.x + (spec.axis === "x" ? half : 0),
    y: spec.center.y + (spec.axis === "y" ? half : 0),
    z: spec.center.z + (spec.axis === "z" ? half : 0)
  };
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
        "Hollow sheet-metal duct modeled with interior airflow area for downstream duct-network preflight checks.",
        `flow-node-from:${spec.from}`,
        `flow-node-to:${spec.to}`,
        `design-flow-cfm:${spec.flowCfm}`,
        `design-velocity-fpm:${spec.designVelocityFpm}`,
        `airflow-role:${spec.role}`,
        "simulation-medium:conditioned-air",
        "simulation-network:central-cooling-airflow",
        `hydraulic-area-sqft:${areaSqFt.toFixed(3)}`,
        "Final Manual D sizing, CFD/fluid boundary conditions, balancing, leakage sealing, insulation, and commissioning require professional mechanical design."
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
    hydraulicAreaSqFt: areaSqFt,
    role: spec.role,
    medium: "conditioned-air",
    network: "central-cooling-airflow",
    boundaryCondition: spec.role === "supply" ? "velocity-inlet-to-zone" : spec.role === "return" ? "pressure-outlet-from-zone" : "exhaust-outlet"
  };
  component.object.userData.hvacEndpoints = { start, end };
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
    "Centralized all-electric AC airflow system with one central air handler/cooling coil, connected supply trunks, return trunks, risers, room branches, registers, return grilles, exhaust ducts, and per-floor cooling control terminals.",
    "Ducts are hollow sheet-metal assemblies with airflow-node, endpoint, boundary-condition, and hydraulic-area metadata for downstream airflow/fluid preprocessing.",
    "This is cooling airflow distribution only; it does not claim solved heat transfer, conductive/radiant exchange, Manual J loads, Manual S equipment selection, Manual D sizing, or CFD results.",
    "Supply and return duct mains are modeled as insulated low-leakage galvanized sheet-metal ducts; exhaust paths are modeled as smooth-wall metal ductwork."
  ];

  box(
    components,
    metadata("central-ac-condenser", "Exterior central AC condenser", "systems", "all-electric central AC condenser for centralized cooling airflow system", sources.residentialCode, 6800, true, notes),
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
    metadata("central-cooling-coil", "Central evaporator cooling coil", "systems", "central DX cooling coil inside air handler supply airstream", sources.residentialCode, 2600, true, [...notes, "flow-node:central-cooling-coil connected between air-handler and supply-plenum"]),
    "#6ea9b8",
    2.4,
    0.32,
    1.2,
    { x: 3.1, y: d - 8.0, z: 5.25 }
  );
  box(
    components,
    metadata("air-handler", "Central variable-speed air handler", "systems", "central variable-speed air handler for cooling supply and return airflow", sources.residentialCode, 5200, true, [...notes, "flow-node:air-handler", "simulation-boundary:central-fan-pressure-rise"]),
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
    metadata("refrigerant-lineset", "Central AC refrigerant and control lineset", "systems", "insulated refrigerant lines and control wire between condenser and cooling coil", sources.residentialCode, 1250, true, notes),
    "#2fb7c8",
    0.18,
    12.0,
    0.18,
    { x: w - 2.6, y: d + 1.0, z: 2.7 }
  );

  for (let floor = 0; floor < config.stories; floor += 1) {
    const level = floor + 1;
    const floorBaseZ = floor * config.storyHeightFt;
    const supplyZ = floor * config.storyHeightFt + 8.2;
    const returnZ = supplyZ - 0.85;
    const supplyTrunkX = 6.2;
    const returnTrunkX = 11.8;
    const supplyRiserY = d - 7.8;
    const returnRiserY = d - 6.2;
    const zoneNotes = [
      ...notes,
      `cooling-zone-floor:${level}`,
      `connected to floor-${level}-cooling-thermostat and central-ac-condenser`,
      "Per-floor cooling terminal is a control/damper marker for centralized AC airflow, not a separate heater or standalone fan-coil."
    ];
    box(
      components,
      metadata(`floor-${level}-cooling-zone-terminal`, `Floor ${level} central AC cooling zone terminal`, "systems", "central AC zone damper and cooling airflow terminal", sources.residentialCode, 1800, true, zoneNotes),
      "#d9eef4",
      2.2,
      0.55,
      0.72,
      { x: supplyTrunkX, y: level === 1 ? 15.0 : 18.0, z: floorBaseZ + 7.55 }
    );
    box(
      components,
      metadata(`floor-${level}-cooling-thermostat`, `Floor ${level} cooling zone thermostat`, "systems", "programmable thermostat for central AC cooling zone control", sources.residentialCode, 260, true, zoneNotes),
      "#eef2f4",
      0.42,
      0.08,
      0.55,
      { x: w - 0.62, y: level === 1 ? 18.0 : 21.0, z: floorBaseZ + 4.4 }
    );
    box(
      components,
      metadata(`floor-${level}-cooling-control-cable`, `Floor ${level} cooling control cable`, "systems", "low-voltage central AC cooling control cable", sources.residentialCode, 120, true, zoneNotes),
      "#65b7c6",
      0.06,
      3.0,
      0.06,
      { x: w - 0.82, y: level === 1 ? 16.5 : 19.5, z: floorBaseZ + 5.6 }
    );
    const heatingBtuh = Math.round((config.buildingWidthFt * config.buildingDepthFt * 10) / config.stories);
    box(
      components,
      metadata(`floor-${level}-electric-heating-terminal`, `Floor ${level} independent electric heating terminal`, "systems", "floor-independent electric resistance heating terminal with local thermostat", sources.residentialCode, 1450, true, [
        ...notes,
        `heating-zone-floor:${level}`,
        `design-heating-btuh:${heatingBtuh}`,
        "Independent electric heating terminal is separate from centralized AC airflow so each floor can be stress-tested for floor-by-floor heating coverage."
      ]),
      "#d9894d",
      2.4,
      0.18,
      0.62,
      { x: w - 0.7, y: level === 1 ? 12.0 : 15.0, z: floorBaseZ + 1.45 }
    );
    components[components.length - 1].object.userData.hvacHeating = {
      level,
      terminalId: `floor-${level}-electric-heating-terminal`,
      thermostatId: `floor-${level}-heating-thermostat`,
      heatingBtuh,
      strategy: "floor-independent-electric"
    };
    box(
      components,
      metadata(`floor-${level}-heating-thermostat`, `Floor ${level} independent heating thermostat`, "systems", "programmable thermostat for floor-independent electric heating", sources.residentialCode, 260, true, [
        ...notes,
        `heating-zone-floor:${level}`,
        `connected to floor-${level}-electric-heating-terminal`
      ]),
      "#f4ece4",
      0.42,
      0.08,
      0.55,
      { x: w - 0.62, y: level === 1 ? 13.2 : 16.2, z: floorBaseZ + 4.2 }
    );
    components[components.length - 1].object.userData.hvacHeating = {
      level,
      terminalId: `floor-${level}-electric-heating-terminal`,
      thermostatId: `floor-${level}-heating-thermostat`,
      heatingBtuh,
      strategy: "floor-independent-electric-control"
    };
    duct(components, {
      id: `supply-trunk-${level}`,
      name: `Hollow supply duct trunk floor ${level}`,
      material: "hollow insulated low-leakage galvanized sheet-metal rectangular supply duct",
      color: "#9aa7ad",
      outerWidth: 1.05,
      outerHeight: 0.62,
      length: d - 8.0,
      wallThickness: 0.035,
      center: { x: supplyTrunkX, y: d / 2, z: supplyZ },
      axis: "y",
      from: floor === 0 ? "supply-trunk-1-takeoff" : `supply-trunk-${level - 1}`,
      to: `supply-trunk-${level}`,
      flowCfm: 400,
      designVelocityFpm: 720,
      role: "supply"
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
      center: { x: returnTrunkX, y: d / 2 + 2.0, z: returnZ },
      axis: "y",
      from: `return-trunk-${level}`,
      to: floor === 0 ? "return-trunk-1-drop" : `return-trunk-${level - 1}`,
      flowCfm: 400,
      designVelocityFpm: 650,
      role: "return"
    });
    if (floor === 0) {
      duct(components, {
        id: "supply-plenum-horizontal-takeoff",
        name: "Hollow supply plenum horizontal takeoff",
        material: "hollow insulated galvanized sheet-metal supply plenum takeoff duct",
        color: "#9aa7ad",
        outerWidth: 0.9,
        outerHeight: 0.58,
        length: supplyTrunkX - 3.1,
        wallThickness: 0.035,
        center: { x: (3.1 + supplyTrunkX) / 2, y: d - 8.9, z: 5.85 },
        axis: "x",
        from: "supply-plenum",
        to: "supply-plenum-takeoff",
        flowCfm: 1200,
        designVelocityFpm: 700,
        role: "supply"
      });
      duct(components, {
        id: "supply-plenum-rise-to-trunk-1",
        name: "Hollow supply plenum rise to first-floor trunk",
        material: "hollow insulated galvanized sheet-metal supply riser from plenum to first-floor trunk",
        color: "#9aa7ad",
        outerWidth: 0.8,
        outerHeight: 0.55,
        length: supplyZ - 5.85,
        wallThickness: 0.035,
        center: { x: supplyTrunkX, y: d - 8.9, z: (supplyZ + 5.85) / 2 },
        axis: "z",
        from: "supply-plenum-takeoff",
        to: "supply-trunk-1-takeoff",
        flowCfm: 1200,
        designVelocityFpm: 700,
        role: "supply"
      });
      duct(components, {
        id: "return-trunk-1-drop-to-plenum",
        name: "Hollow return drop from first-floor trunk to plenum transfer",
        material: "hollow insulated galvanized sheet-metal return drop to air-handler plenum",
        color: "#7f8b91",
        outerWidth: 0.75,
        outerHeight: 0.55,
        length: returnZ - 3.55,
        wallThickness: 0.035,
        center: { x: returnTrunkX, y: returnRiserY, z: (returnZ + 3.55) / 2 },
        axis: "z",
        from: "return-trunk-1-drop",
        to: "return-plenum-transfer",
        flowCfm: 1200,
        designVelocityFpm: 650,
        role: "return"
      });
      duct(components, {
        id: "return-plenum-horizontal-transfer",
        name: "Hollow return plenum horizontal transfer",
        material: "hollow insulated galvanized sheet-metal return transfer duct to air handler",
        color: "#7f8b91",
        outerWidth: 0.85,
        outerHeight: 0.55,
        length: returnTrunkX - 3.1,
        wallThickness: 0.035,
        center: { x: (3.1 + returnTrunkX) / 2, y: returnRiserY, z: 3.55 },
        axis: "x",
        from: "return-plenum-transfer",
        to: "return-plenum",
        flowCfm: 1200,
        designVelocityFpm: 650,
        role: "return"
      });
    }
    if (floor > 0) {
      const previousSupplyZ = (floor - 1) * config.storyHeightFt + 8.2;
      const previousReturnZ = previousSupplyZ - 0.85;
      duct(components, {
        id: `supply-riser-${level}`,
        name: `Hollow supply riser to floor ${level}`,
        material: "hollow insulated low-leakage galvanized sheet-metal vertical supply riser",
        color: "#9aa7ad",
        outerWidth: 0.8,
        outerHeight: 0.55,
        length: supplyZ - previousSupplyZ,
        wallThickness: 0.035,
        center: { x: supplyTrunkX, y: supplyRiserY, z: (previousSupplyZ + supplyZ) / 2 },
        axis: "z",
        from: `supply-trunk-${level - 1}`,
        to: `supply-trunk-${level}`,
        flowCfm: level === 2 ? 800 : 400,
        designVelocityFpm: 700,
        role: "supply"
      });
      duct(components, {
        id: `return-riser-${level}`,
        name: `Hollow return riser from floor ${level}`,
        material: "hollow insulated low-leakage galvanized sheet-metal vertical return riser",
        color: "#7f8b91",
        outerWidth: 0.75,
        outerHeight: 0.55,
        length: returnZ - previousReturnZ,
        wallThickness: 0.035,
        center: { x: returnTrunkX, y: returnRiserY, z: (previousReturnZ + returnZ) / 2 },
        axis: "z",
        from: `return-trunk-${level}`,
        to: `return-trunk-${level - 1}`,
        flowCfm: level === 2 ? 800 : 400,
        designVelocityFpm: 650,
        role: "return"
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
        length: supplyTrunkX - 5.3,
        wallThickness: 0.03,
        center: { x: (5.3 + supplyTrunkX) / 2, y, z: supplyZ },
        axis: "x",
        from: `supply-trunk-${level}`,
        to: `supply-register-${room}-${level}`,
        flowCfm: flow,
        designVelocityFpm: 600,
        role: "supply"
      });
      box(
        components,
        metadata(`supply-register-${room}-${level}`, `Cooling supply register ${room} floor ${level}`, "systems", "louvered central AC cooling supply register connected to hollow branch duct", sources.residentialCode, 180, true, [...notes, `flow-node:supply-register-${room}-${level}`, `connected to supply-branch-${room}-${level}`, `design-flow-cfm:${flow}`, "simulation-boundary:velocity-inlet-to-room"]),
        "#c5d0d5",
        1.2,
        0.5,
        0.12,
        { x: 5.3, y, z: supplyZ }
      );
    }
    duct(components, {
      id: `return-drop-zone-${level}`,
      name: `Hollow return grille drop floor ${level}`,
      material: "hollow insulated galvanized sheet-metal return grille drop into trunk",
      color: "#8f9ba0",
      outerWidth: 0.62,
      outerHeight: 0.42,
      length: returnZ - (floor * config.storyHeightFt + 6.8),
      wallThickness: 0.03,
      center: { x: returnTrunkX, y: 18.0, z: (returnZ + floor * config.storyHeightFt + 6.8) / 2 },
      axis: "z",
      from: `return-grille-zone-${level}`,
      to: `return-trunk-${level}`,
      flowCfm: 400,
      designVelocityFpm: 550,
      role: "return"
    });
    box(
      components,
      metadata(`return-grille-zone-${level}`, `Cooling return grille floor ${level}`, "systems", "louvered central AC return grille connected to hollow return trunk", sources.residentialCode, 220, true, [...notes, `flow-node:return-grille-zone-${level}`, `connected to return-trunk-${level}`, "simulation-boundary:pressure-outlet-from-room"]),
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
    designVelocityFpm: 900,
    role: "exhaust"
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
    designVelocityFpm: 1000,
    role: "exhaust"
  });
}
