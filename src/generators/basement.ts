import type { ModelComponent, RowhomeConfig } from "../core/types";
import { sources } from "../core/sources";
import { box, metadata } from "./builder";

function addBasementStairFlight(components: ModelComponent[], basementDepth: number): void {
  const stairWidth = 3.2;
  const treadDepth = 0.8;
  const riserHeight = basementDepth / 13;
  const treadThickness = 0.18;
  const steps = 13;
  const x = 2.8;
  const yStart = 7.0;
  const baseZ = -basementDepth;

  box(
    components,
    metadata("basement-stair-run", "Procedural basement stair flight", "circulation", "stair assembly", sources.residentialCode, 0, false),
    "#4f3522",
    stairWidth,
    steps * treadDepth,
    0.08,
    { x, y: yStart + (steps * treadDepth) / 2, z: baseZ + 0.04 }
  );

  for (let step = 0; step < steps; step += 1) {
    const y = yStart + step * treadDepth + treadDepth / 2;
    const z = baseZ + step * riserHeight + treadThickness / 2;
    box(
      components,
      metadata(
        `basement-stair-tread-${step + 1}`,
        `Basement stair tread ${step + 1}`,
        "circulation",
        "wood basement stair tread",
        sources.residentialCode,
        145
      ),
      "#9a6639",
      stairWidth,
      treadDepth,
      treadThickness,
      { x, y, z }
    );
    box(
      components,
      metadata(
        `basement-stair-riser-${step + 1}`,
        `Basement stair riser ${step + 1}`,
        "circulation",
        "painted basement stair riser",
        sources.residentialCode,
        70
      ),
      "#d0c2ab",
      stairWidth,
      0.12,
      riserHeight,
      { x, y: y - treadDepth / 2, z: baseZ + step * riserHeight + riserHeight / 2 }
    );
  }

  for (const [side, railX] of [["left", x - stairWidth / 2 - 0.12], ["right", x + stairWidth / 2 + 0.12]] as const) {
    box(
      components,
      metadata(`basement-stair-handrail-${side}`, `Basement stair ${side} handrail`, "circulation", "wood handrail", sources.residentialCode, 380),
      "#3f2818",
      0.22,
      steps * treadDepth + 0.8,
      0.16,
      { x: railX, y: yStart + (steps * treadDepth) / 2, z: baseZ + basementDepth / 2 + 2.75 }
    );
  }
}

export function addBasement(components: ModelComponent[], config: RowhomeConfig): void {
  if (!config.includeBasement) {
    return;
  }

  const w = config.buildingWidthFt;
  const d = config.buildingDepthFt;
  const basementDepth = config.basementDepthFt;
  const centerZ = -basementDepth / 2;
  const foundationNotes = [
    "Schematic basement and foundation assembly; excavation, underpinning, waterproofing, drainage, and structural design require professional review.",
    "Modeled as a below-grade concrete basement common to Baltimore rowhouse practice."
  ];

  box(
    components,
    metadata("basement-slab", "Basement concrete slab", "structure", "reinforced concrete slab on vapor barrier", sources.residentialCode, 8200, true, foundationNotes),
    "#7f827e",
    w - 0.8,
    d - 0.8,
    0.35,
    { x: w / 2, y: d / 2, z: -basementDepth - 0.18 }
  );
  box(
    components,
    metadata("basement-party-wall-left", "Left basement foundation wall", "structure", "reinforced concrete foundation wall", sources.residentialCode, 9400, true, foundationNotes),
    "#85867f",
    0.55,
    d,
    basementDepth,
    { x: 0.275, y: d / 2, z: centerZ }
  );
  box(
    components,
    metadata("basement-party-wall-right", "Right basement foundation wall", "structure", "reinforced concrete foundation wall", sources.residentialCode, 9400, true, foundationNotes),
    "#85867f",
    0.55,
    d,
    basementDepth,
    { x: w - 0.275, y: d / 2, z: centerZ }
  );
  box(
    components,
    metadata("basement-front-foundation-wall", "Front basement foundation wall", "structure", "reinforced concrete foundation wall", sources.residentialCode, 7600, true, foundationNotes),
    "#85867f",
    w,
    0.55,
    basementDepth,
    { x: w / 2, y: -0.275, z: centerZ }
  );
  box(
    components,
    metadata("basement-rear-foundation-wall", "Rear basement foundation wall", "structure", "reinforced concrete foundation wall", sources.residentialCode, 7600, true, foundationNotes),
    "#85867f",
    w,
    0.55,
    basementDepth,
    { x: w / 2, y: d + 0.275, z: centerZ }
  );
  box(
    components,
    metadata("basement-ceiling-underside", "Basement ceiling and first-floor framing underside", "structure", "5/8 in Type X gypsum basement ceiling board", sources.residentialCode, 3200),
    "#efe9dd",
    w - 1.0,
    d - 0.8,
    5 / 8 / 12,
    { x: w / 2, y: d / 2, z: -5 / 16 / 12 }
  );
  for (const [side, x] of [["left", -0.05], ["right", w + 0.05]] as const) {
    box(
      components,
      metadata(`basement-${side}-waterproofing`, `${side} exterior basement waterproofing membrane`, "structure", "below-grade waterproofing and drainage mat", sources.residentialCode, 2800, true, foundationNotes),
      "#1d2527",
      0.08,
      d + 0.5,
      basementDepth - 0.5,
      { x, y: d / 2, z: centerZ + 0.25 }
    );
  }
  for (const [side, y] of [["front", -0.6], ["rear", d + 0.6]] as const) {
    box(
      components,
      metadata(`basement-${side}-waterproofing`, `${side} exterior basement waterproofing membrane`, "structure", "below-grade waterproofing and drainage mat", sources.residentialCode, 2800, true, foundationNotes),
      "#1d2527",
      w + 0.5,
      0.08,
      basementDepth - 0.5,
      { x: w / 2, y, z: centerZ + 0.25 }
    );
    box(
      components,
      metadata(`basement-${side}-foundation-insulation`, `${side} basement foundation insulation`, "structure", "continuous below-grade rigid insulation", sources.energyCode, 2600),
      "#d8c782",
      w - 0.7,
      0.28,
      basementDepth - 0.8,
      { x: w / 2, y: side === "front" ? 0.58 : d - 0.58, z: centerZ + 0.2 }
    );
  }
  box(
    components,
    metadata("basement-perimeter-drain", "Basement perimeter drain tile", "systems", "perforated foundation drain pipe and gravel", sources.residentialCode, 2400),
    "#596067",
    w - 1.0,
    0.32,
    0.32,
    { x: w / 2, y: d - 0.75, z: -basementDepth + 0.25 }
  );
  box(
    components,
    metadata("basement-sump-pit", "Basement sump pit and pump", "systems", "electric sump pump", sources.electricalCode, 1400),
    "#2d3438",
    1.4,
    1.4,
    1.1,
    { x: w - 2.2, y: d - 3.2, z: -basementDepth + 0.55 }
  );
  box(
    components,
    metadata("basement-utility-zone", "Basement utility and storage area", "interior", "basement utility room zone marker", sources.residentialCode, 0, false),
    "#344852",
    w - 1.4,
    d - 8.0,
    0.08,
    { x: w / 2, y: d / 2 + 3.0, z: -basementDepth + 0.24 }
  );
  box(
    components,
    metadata(
      "electric-water-heater",
      "Basement electric heat-pump water heater",
      "systems",
      "electric heat pump water heater",
      sources.electricalCode,
      3600,
      true,
      [
        "Current placeholder represents an all-electric heat-pump tank water heater rather than a combustion boiler.",
        "Purchasable realistic model candidate: Rheem ProTerra Hybrid Heat Pump Electric Water Heater model from 3DModels.org, available in GLB/glTF after purchase."
      ]
    ),
    "#c7d1d8",
    2.0,
    2.0,
    5.2,
    { x: 5.0, y: d - 6.0, z: -basementDepth + 2.8 }
  );

  addBasementStairFlight(components, basementDepth);
}
