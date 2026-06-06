import type { ModelComponent, RowhomeConfig } from "../core/types";
import { sources } from "../core/sources";
import { box, metadata } from "./builder";
import { attachRealAsset } from "./realAssets";

type LightingPoint = readonly [id: string, name: string, floor: number, x: number, y: number];

const lightingPoints: LightingPoint[] = [
  ["living-room", "Living room LED ceiling luminaire", 0, 9.0, 9.2],
  ["dining-room", "Dining room LED ceiling luminaire", 0, 9.0, 24.0],
  ["kitchen", "Kitchen LED task ceiling luminaire", 0, 10.5, 39.0],
  ["stair-hall", "Stair hall LED ceiling luminaire", 0, 4.3, 22.0],
  ["primary-bedroom", "Primary bedroom LED ceiling luminaire", 1, 9.0, 8.8],
  ["second-bedroom", "Second bedroom LED ceiling luminaire", 1, 9.0, 35.0],
  ["third-bedroom", "Third bedroom LED ceiling luminaire", 2, 9.0, 10.4],
  ["third-floor-office", "Third floor office LED ceiling luminaire", 2, 9.0, 34.0]
];

export function addStandardElectricalSystem(
  components: ModelComponent[],
  config: RowhomeConfig,
  buildingHeight: number
): void {
  const w = config.buildingWidthFt;
  const d = config.buildingDepthFt;
  const panelX = 0.62;
  const panelY = 4.1;
  const panelZ = 4.6;
  const standardNotes = [
    "Standardized schematic electrical parts: service mast, meter socket, emergency disconnect, 200 A main-breaker load center, plug-on circuit breakers, bus bars, junction boxes, device boxes, NM-B cable, and listed receptacles/luminaires.",
    "Connections are modeled as visible cable/conduit segments; final load calculation, breaker sizing, AFCI/GFCI selection, grounding, bonding, and inspection require licensed electrical design.",
    "Panel placement includes dedicated first-floor working space based on Article 110.26 source requirements for spaces about electrical equipment."
  ];

  box(
    components,
    metadata("service-mast", "Electric service mast", "electrical", "galvanized service mast with weatherhead", sources.electricalCode, 1800, true, [...standardNotes, "connected to utility service drop and meter-socket"]),
    "#20252b",
    0.22,
    0.22,
    8.0,
    { x: 0.75, y: 2.2, z: buildingHeight + 3.0 }
  );
  box(
    components,
    metadata("meter-socket", "Exterior electric meter socket", "electrical", "ringless meter socket enclosure", sources.electricalCode, 650, true, [...standardNotes, "connected to service-mast and service-entrance-conductors"]),
    "#667078",
    0.8,
    0.22,
    1.2,
    { x: 0.75, y: 2.6, z: 6.2 }
  );
  box(
    components,
    metadata("service-disconnect", "Exterior emergency service disconnect", "electrical", "service-rated emergency disconnect switch", sources.electricalCode, 850, true, [...standardNotes, "connected to service-entrance-conductors and main-feeder-run"]),
    "#4f5960",
    0.9,
    0.24,
    1.25,
    { x: 0.75, y: 3.15, z: 4.65 }
  );
  box(
    components,
    metadata("service-entrance-conductors", "Service entrance conductors meter to disconnect", "electrical", "copper service entrance conductors in raceway", sources.electricalCode, 900, true, [...standardNotes, "connected to meter-socket and service-disconnect"]),
    "#d1782a",
    0.16,
    0.12,
    1.5,
    { x: 0.75, y: 2.9, z: 5.35 }
  );
  box(
    components,
    metadata("electrical-panel", "First-floor circuit breaker panel", "electrical", "200 A main-breaker load center panelboard", sources.electricalCode, 2600, true, [...standardNotes, "connected to main-feeder-run, panel bus bars, breakers, and branch circuits", "accessible on the first floor with dedicated working clearance"]),
    "#20252b",
    0.34,
    0.18,
    3.2,
    { x: panelX, y: panelY, z: panelZ }
  );
  box(
    components,
    metadata("electrical-panel-working-clearance", "Dedicated working clearance at breaker panel", "electrical", "NEC 110.26 dedicated electrical equipment working space marker", sources.electricalCode, 0, false, standardNotes),
    "#6fb2ff",
    3.0,
    3.0,
    6.5,
    { x: panelX + 1.65, y: panelY, z: 3.25 }
  );
  box(
    components,
    metadata("main-feeder-run", "Main feeder run to panel", "electrical", "copper feeder conductors in raceway", sources.electricalCode, 1450, true, [...standardNotes, "connected to service-disconnect and electrical-panel"]),
    "#d1782a",
    0.18,
    2.0,
    buildingHeight - 3.0,
    { x: 0.72, y: 3.2, z: buildingHeight / 2 + 1.5 }
  );
  box(
    components,
    metadata("panel-vertical-riser", "Panel branch-circuit riser chase", "electrical", "NM-B cable bundle in protected wall chase", sources.electricalCode, 780, true, [...standardNotes, "connected to electrical-panel and branch circuit junction boxes"]),
    "#f0c04d",
    0.16,
    0.16,
    buildingHeight - 1.0,
    { x: panelX + 0.18, y: panelY + 0.25, z: buildingHeight / 2 }
  );

  for (const [i, id] of ["main", "lighting-1", "lighting-2", "receptacle-1", "receptacle-2", "kitchen-small-appliance", "range-240v", "hvac", "water-heater", "pv-battery"].entries()) {
    box(
      components,
      metadata(`breaker-${id}`, `${id.replaceAll("-", " ")} circuit breaker`, "electrical", id === "range-240v" || id === "pv-battery" ? "2-pole molded-case circuit breaker" : "plug-on molded-case circuit breaker", sources.electricalCode, 85, true, [...standardNotes, "connected to electrical-panel bus bars and branch circuit conductors"]),
      id === "range-240v" || id === "pv-battery" ? "#8e2e2e" : "#30373d",
      0.18,
      0.06,
      0.28,
      { x: panelX + 0.05, y: panelY - 0.12, z: 3.45 + i * 0.28 }
    );
  }
  for (const [id, x] of [["neutral", panelX - 0.08], ["equipment-grounding", panelX + 0.12]] as const) {
    box(
      components,
      metadata(`${id}-bus-bar`, `${id.replace("-", " ")} bus bar`, "electrical", "tin-plated copper bus bar", sources.electricalCode, 120, true, [...standardNotes, "connected to electrical-panel"]),
      "#c49a45",
      0.04,
      0.04,
      2.6,
      { x, y: panelY - 0.13, z: panelZ }
    );
  }

  for (let floor = 0; floor < config.stories; floor += 1) {
    const z = floor * config.storyHeightFt + 8.6;
    box(
      components,
      metadata(`lighting-branch-circuit-${floor + 1}`, `Lighting branch circuit floor ${floor + 1}`, "electrical", "12 AWG copper NM-B cable with equipment grounding conductor", sources.electricalCode, 420, true, [...standardNotes, `connected to breaker-lighting-${floor < 2 ? floor + 1 : 2}, switch boxes, junction boxes, and ceiling luminaires`]),
      "#f0c04d",
      w - 1.2,
      0.12,
      0.12,
      { x: w / 2, y: 18.0, z }
    );
    box(
      components,
      metadata(`receptacle-branch-circuit-${floor + 1}`, `Receptacle branch circuit floor ${floor + 1}`, "electrical", "12 AWG copper NM-B cable with equipment grounding conductor", sources.electricalCode, 560, true, [...standardNotes, `connected to breaker-receptacle-${floor < 2 ? floor + 1 : 2} and receptacle device boxes`]),
      "#f0c04d",
      0.12,
      d - 8.0,
      0.12,
      { x: w - 0.9, y: d / 2, z: floor * config.storyHeightFt + 1.7 }
    );
  }

  for (const [id, name, floor, x, y] of lightingPoints) {
    const ceilingZ = floor * config.storyHeightFt + config.storyHeightFt - 0.45;
    box(
      components,
      metadata(`junction-box-${id}`, `${name} junction box`, "electrical", "4 in octagon steel ceiling junction box", sources.electricalCode, 75, true, [...standardNotes, `connected to lighting-branch-circuit-${floor + 1} and overhead-light-${id}`]),
      "#6d7378",
      0.7,
      0.7,
      0.12,
      { x, y, z: ceilingZ + 0.09 }
    );
    box(
      components,
      metadata(`switch-box-${id}`, `${name} wall switch box`, "electrical", "single-gang wall switch in device box", sources.electricalCode, 95, true, [...standardNotes, `connected to lighting-branch-circuit-${floor + 1} and junction-box-${id}`]),
      "#f4f0d0",
      0.32,
      0.12,
      0.52,
      { x: 1.1, y: Math.max(6.2, y - 2.0), z: floor * config.storyHeightFt + 4.1 }
    );
    box(
      components,
      metadata(`switch-leg-${id}`, `${name} switch leg cable`, "electrical", "12 AWG copper NM-B switch leg", sources.electricalCode, 70, true, [...standardNotes, `connected to switch-box-${id} and junction-box-${id}`]),
      "#e3b642",
      Math.max(0.4, x - 1.1),
      0.08,
      0.08,
      { x: (x + 1.1) / 2, y, z: floor * config.storyHeightFt + 8.2 }
    );
    box(
      components,
      metadata(
        `overhead-light-${id}`,
        name,
        "electrical",
        "hardwired LED ceiling luminaire on switched lighting circuit",
        sources.electricalCode,
        240,
        true,
        [...standardNotes, `connected to junction-box-${id}`]
      ),
      "#fff1c6",
      1.1,
      1.1,
      0.14,
      { x, y, z: ceilingZ }
    );
  }

  box(
    components,
    attachRealAsset(metadata("floor-lamp-base", "Living room floor lamp base", "electrical", "portable LED floor lamp", sources.electricalCode, 180, true, [...standardNotes, "connected by cord-and-plug to receptacle-120v-2"]), "lampRoundFloor", "Round floor lamp"),
    "#4b3c2a",
    0.8,
    0.8,
    0.16,
    { x: 14.4, y: 12.2, z: 0.08 }
  );
  box(
    components,
    metadata("floor-lamp-pole", "Living room floor lamp pole", "electrical", "portable LED floor lamp metal pole", sources.electricalCode, 120, true, [...standardNotes, "connected to floor-lamp-base and floor-lamp-bulb"]),
    "#5a4a35",
    0.12,
    0.12,
    5.2,
    { x: 14.4, y: 12.2, z: 2.7 }
  );
  box(
    components,
    metadata("floor-lamp-shade", "Living room floor lamp shade", "electrical", "fabric lamp shade with LED lamp", sources.electricalCode, 260, true, [...standardNotes, "connected to floor-lamp-bulb"]),
    "#f3dba5",
    1.45,
    1.45,
    1.2,
    { x: 14.4, y: 12.2, z: 5.55 }
  );
  box(
    components,
    metadata("floor-lamp-bulb", "Living room floor lamp LED bulb", "electrical", "warm LED lamp", sources.electricalCode, 40, true, [...standardNotes, "connected by floor-lamp cord to receptacle-120v-2"]),
    "#fff4c8",
    0.34,
    0.34,
    0.34,
    { x: 14.4, y: 12.2, z: 5.55 }
  );

  box(
    components,
    metadata("kitchen-240v-outlet", "Accessible 240 volt range outlet", "electrical", "50 A 240 V range receptacle in listed device box", sources.electricalCode, 450, true, [...standardNotes, "connected to breaker-range-240v and range-240v-circuit"]),
    "#d6422e",
    0.35,
    0.12,
    0.35,
    { x: 10.2, y: 4.72, z: 1.6 }
  );
  box(
    components,
    metadata("range-240v-circuit", "240 volt range circuit", "electrical", "6 AWG copper range cable with equipment grounding conductor", sources.electricalCode, 900, true, [...standardNotes, "connected to breaker-range-240v and kitchen-240v-outlet"]),
    "#d65a2e",
    5.0,
    0.14,
    0.14,
    { x: 7.9, y: 4.8, z: 1.8 }
  );

  box(
    components,
    metadata("air-handler-disconnect", "Air handler service disconnect", "electrical", "HVAC equipment disconnect switch", sources.electricalCode, 320, true, [...standardNotes, "connected to breaker-hvac and air-handler-branch-circuit"]),
    "#4f5960",
    0.42,
    0.12,
    0.62,
    { x: 1.15, y: d - 7.0, z: 4.3 }
  );
  box(
    components,
    metadata("air-handler-branch-circuit", "Air handler branch circuit", "electrical", "10 AWG copper HVAC equipment cable", sources.electricalCode, 520, true, [...standardNotes, "connected to breaker-hvac, air-handler-disconnect, and indoor electric air handler"]),
    "#e09a35",
    2.4,
    0.1,
    0.1,
    { x: 2.1, y: d - 7.0, z: 4.3 }
  );
  box(
    components,
    metadata("heat-pump-disconnect", "Exterior heat pump disconnect", "electrical", "weatherproof HVAC disconnect switch", sources.electricalCode, 360, true, [...standardNotes, "connected to breaker-hvac and heat-pump-condenser"]),
    "#4f5960",
    0.55,
    0.16,
    0.72,
    { x: w - 5.0, y: d + 4.9, z: 4.0 }
  );
  box(
    components,
    metadata("heat-pump-branch-circuit", "Heat pump condenser branch circuit", "electrical", "10 AWG copper HVAC equipment cable in weatherproof raceway", sources.electricalCode, 620, true, [...standardNotes, "connected to breaker-hvac, heat-pump-disconnect, and heat-pump-condenser"]),
    "#e09a35",
    0.12,
    8.2,
    0.12,
    { x: w - 5.0, y: d + 1.2, z: 3.6 }
  );
  for (let floor = 0; floor < config.stories; floor += 1) {
    const level = floor + 1;
    box(
      components,
      metadata(`floor-${level}-heater-branch-circuit`, `Floor ${level} heater branch circuit`, "electrical", "12 AWG copper heat-pump indoor-unit branch circuit", sources.electricalCode, 360, true, [...standardNotes, `connected to breaker-hvac and floor-${level}-heat-pump-indoor-unit`]),
      "#e09a35",
      0.1,
      Math.max(4.0, d - 20.0),
      0.1,
      { x: w - 1.05, y: d / 2, z: floor * config.storyHeightFt + 6.6 }
    );
  }
  box(
    components,
    metadata("water-heater-branch-circuit", "Heat pump water heater branch circuit", "electrical", "10 AWG copper water-heater equipment cable", sources.electricalCode, 480, true, [...standardNotes, "connected to breaker-water-heater and electric-water-heater"]),
    "#e09a35",
    4.2,
    0.1,
    0.1,
    { x: 2.9, y: d - 6.0, z: -4.8 }
  );

  for (let i = 0; i < 8; i += 1) {
    const id = i + 1;
    const y = 8 + i * 4;
    box(
      components,
      metadata(`receptacle-box-120v-${id}`, `120 volt receptacle ${id} device box`, "electrical", "single-gang listed device box", sources.electricalCode, 45, true, [...standardNotes, `connected to receptacle-branch-circuit-1 and receptacle-120v-${id}`]),
      "#6d7378",
      0.36,
      0.14,
      0.38,
      { x: w - 0.62, y, z: 1.35 }
    );
    box(
      components,
      metadata(`receptacle-120v-${id}`, `120 volt receptacle ${id}`, "electrical", "20 A tamper-resistant duplex receptacle", sources.electricalCode, 95, true, [...standardNotes, `connected to receptacle-box-120v-${id}`]),
      "#eee9ba",
      0.28,
      0.12,
      0.3,
      { x: w - 0.62, y, z: 1.35 }
    );
    box(
      components,
      metadata(`receptacle-drop-120v-${id}`, `Cable drop to 120 volt receptacle ${id}`, "electrical", "12 AWG copper NM-B cable drop", sources.electricalCode, 55, true, [...standardNotes, `connected to receptacle-branch-circuit-1 and receptacle-box-120v-${id}`]),
      "#f0c04d",
      0.08,
      0.08,
      6.9,
      { x: w - 0.9, y, z: 5.0 }
    );
  }
}
