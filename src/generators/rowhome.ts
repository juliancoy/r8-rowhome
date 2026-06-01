import type { ComponentCategory, ComponentMetadata, ModelComponent, RowhomeConfig, RowhomeModel } from "../core/types";
import { sources } from "../core/sources";
import { makeBoxComponent, makeCurvedFacadeComponent, makeCylinderComponent } from "../geometry/component";
import { validateRowhome } from "../validation/validate";
import { estimateFacadeMaterialCost, selectedFacadeMaterial } from "../core/facadeMaterials";
import { selectedFacadeStyle } from "../core/facadeStyles";

function metadata(
  id: string,
  name: string,
  category: ComponentCategory,
  material: string,
  source: string,
  estimatedCostUsd: number,
  printable = true,
  notes: string[] = []
): ComponentMetadata {
  return { id, name, category, material, source, estimatedCostUsd, printable, notes };
}

function box(
  components: ModelComponent[],
  meta: ComponentMetadata,
  color: string,
  width: number,
  depth: number,
  height: number,
  center: { x: number; y: number; z: number },
  rotationYRadians = 0
): void {
  components.push(makeBoxComponent(meta, color, width, depth, height, center, rotationYRadians));
}

function bowProjectionAtX(x: number, width: number, bowDepth: number): number {
  const localX = x - width / 2;
  const radius = (width * width) / (8 * bowDepth) + bowDepth / 2;
  const radiusOffset = radius - bowDepth;
  return Math.sqrt(Math.max(0, radius * radius - localX * localX)) - radiusOffset;
}

function bowTangentAngleAtX(x: number, width: number, bowDepth: number): number {
  const localX = x - width / 2;
  const radius = (width * width) / (8 * bowDepth) + bowDepth / 2;
  const denominator = Math.sqrt(Math.max(0.0001, radius * radius - localX * localX));
  return Math.atan(localX / denominator);
}

function addAlternatingRunStairFlight(
  components: ModelComponent[],
  floor: number,
  baseZ: number,
  source: string
): void {
  const stairWidth = 3.2;
  const treadDepth = 0.78;
  const riserHeight = 0.625;
  const treadThickness = 0.18;
  const steps = 16;
  const x = 2.8;
  const direction = floor % 2 === 0 ? 1 : -1;
  const yStart = direction === 1 ? 18.4 : 32.6;
  const runCenterY = yStart + direction * (steps * treadDepth) / 2;
  const stairNotes = [
    "Alternating floor-by-floor stair direction modeled as a compact rowhouse switchback run.",
    direction === 1 ? "This flight rises toward the rear." : "This flight rises toward the front."
  ];

  box(
    components,
    metadata(`stair-run-${floor + 1}`, `Alternating stair flight ${floor + 1}`, "circulation", "alternating-run stair assembly", source, 0, false, stairNotes),
    "#4f3522",
    stairWidth,
    steps * treadDepth,
    0.08,
    { x, y: runCenterY, z: baseZ + 0.04 }
  );

  for (let step = 0; step < steps; step += 1) {
    const y = yStart + direction * (step * treadDepth + treadDepth / 2);
    const z = baseZ + step * riserHeight + treadThickness / 2;
    box(
      components,
      metadata(
        `stair-tread-${floor + 1}-${step + 1}`,
        `Stair tread ${step + 1} flight ${floor + 1}`,
        "circulation",
        "wood alternating-run stair tread",
        source,
        145,
        true,
        stairNotes
      ),
      "#a87344",
      stairWidth,
      treadDepth,
      treadThickness,
      { x, y, z }
    );
    box(
      components,
      metadata(
        `stair-riser-${floor + 1}-${step + 1}`,
        `Stair riser ${step + 1} flight ${floor + 1}`,
        "circulation",
        "painted stair riser",
        source,
        70,
        true,
        stairNotes
      ),
      "#d7c8ad",
      stairWidth,
      0.12,
      riserHeight,
      { x, y: y - direction * treadDepth / 2, z: baseZ + step * riserHeight + riserHeight / 2 }
    );
  }

  const topZ = baseZ + steps * riserHeight;
  const topY = yStart + direction * (steps * treadDepth + 1.7);
  box(
    components,
    metadata(`stair-landing-${floor + 1}`, `Alternating stair landing ${floor + 1}`, "circulation", "wood stair landing", source, 1200, true, stairNotes),
    "#8a5e38",
    stairWidth + 0.2,
    3.4,
    0.32,
    { x, y: topY, z: topZ - 0.16 }
  );

  for (const [side, railX] of [["left", x - stairWidth / 2 - 0.12], ["right", x + stairWidth / 2 + 0.12]] as const) {
    const railY = runCenterY;
    const railZ = baseZ + steps * riserHeight / 2 + 2.55;
    box(
      components,
      metadata(`stair-guard-${side}-${floor + 1}`, `Stair ${side} guard rail ${floor + 1}`, "circulation", "wood guard rail", source, 850, true, stairNotes),
      "#5c3d26",
      0.18,
      steps * treadDepth + 0.8,
      2.8,
      { x: railX, y: railY, z: railZ }
    );
    box(
      components,
      metadata(`stair-handrail-${side}-${floor + 1}`, `Stair ${side} handrail ${floor + 1}`, "circulation", "wood handrail", source, 420, true, stairNotes),
      "#3f2818",
      0.24,
      steps * treadDepth + 0.8,
      0.18,
      { x: railX, y: railY, z: railZ + 1.55 }
    );
  }
}

function addSpiralStairFlight(
  components: ModelComponent[],
  floor: number,
  baseZ: number,
  storyHeight: number,
  source: string
): void {
  const steps = 18;
  const centerX = 3.4;
  const centerY = 22.4;
  const radius = 2.1;
  const treadWidth = 1.35;
  const treadDepth = 2.25;
  const treadThickness = 0.18;
  const riserHeight = storyHeight / steps;
  const clockwise = floor % 2 === 0 ? 1 : -1;
  const spiralNotes = [
    "Compact spiral stair option for schematic comparison; clear width, tread geometry, egress role, and code acceptability require professional review.",
    clockwise === 1 ? "This flight winds clockwise as it rises." : "This flight winds counterclockwise as it rises."
  ];

  components.push(makeCylinderComponent(
    metadata(`spiral-stair-pole-${floor + 1}`, `Spiral stair center pole ${floor + 1}`, "circulation", "steel spiral stair center pole", source, 720, true, spiralNotes),
    "#31383d",
    0.12,
    storyHeight,
    { x: centerX, y: centerY, z: baseZ + storyHeight / 2 },
    18
  ));

  for (let step = 0; step < steps; step += 1) {
    const angle = clockwise * (step / steps) * Math.PI * 2;
    const x = centerX + Math.cos(angle) * radius * 0.55;
    const y = centerY + Math.sin(angle) * radius * 0.55;
    const z = baseZ + step * riserHeight + treadThickness / 2;
    box(
      components,
      metadata(
        `spiral-stair-tread-${floor + 1}-${step + 1}`,
        `Spiral stair tread ${step + 1} flight ${floor + 1}`,
        "circulation",
        "steel and wood spiral stair tread",
        source,
        180,
        true,
        spiralNotes
      ),
      "#9b6a3f",
      treadWidth,
      treadDepth,
      treadThickness,
      { x, y, z },
      -angle
    );
  }

  box(
    components,
    metadata(`spiral-stair-landing-${floor + 1}`, `Spiral stair landing ${floor + 1}`, "circulation", "steel spiral stair landing", source, 1500, true, spiralNotes),
    "#5c6267",
    4.2,
    3.0,
    0.26,
    { x: centerX, y: centerY + 2.2 * clockwise, z: baseZ + storyHeight - 0.13 }
  );
}

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

function addBasement(components: ModelComponent[], config: RowhomeConfig): void {
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
    metadata("electric-water-heater", "Basement electric water heater", "systems", "electric heat pump water heater", sources.electricalCode, 3600),
    "#c7d1d8",
    2.0,
    2.0,
    5.2,
    { x: 5.0, y: d - 6.0, z: -basementDepth + 2.8 }
  );

  addBasementStairFlight(components, basementDepth);
}

function addFireAndThermalAssemblies(
  components: ModelComponent[],
  config: RowhomeConfig,
  buildingHeight: number
): void {
  const w = config.buildingWidthFt;
  const d = config.buildingDepthFt;
  const gypsumThickness = 5 / 8 / 12;
  const exteriorInsulationThickness = 5.5 / 12;
  const roofInsulationThickness = 14 / 12;
  const fireAssemblyNotes = [
    "Schematic fire-resistance layer; final rated assembly, joints, penetrations, blocking, and continuity require licensed design review.",
    "Modeled as Type X gypsum board on the unit side of party walls and protected floor/ceiling surfaces."
  ];
  const insulationNotes = [
    "Best-practice schematic envelope insulation with air sealing; final R-values, vapor control, and continuity require energy-code review.",
    "Represents high-performance modern rowhome practice rather than a product-specific permit detail."
  ];

  for (const [side, x] of [["left", 0.48], ["right", w - 0.48]] as const) {
    box(
      components,
      metadata(
        `party-wall-${side}-type-x-gypsum`,
        `${side} party wall Type X gypsum fire layer`,
        "structure",
        "5/8 in Type X gypsum board fire membrane",
        sources.residentialCode,
        4200,
        true,
        fireAssemblyNotes
      ),
      "#efe9dd",
      gypsumThickness,
      d,
      buildingHeight,
      { x, y: d / 2, z: buildingHeight / 2 }
    );
    box(
      components,
      metadata(
        `party-wall-${side}-mineral-wool-fire-insulation`,
        `${side} party wall mineral wool fire and acoustic insulation`,
        "structure",
        "mineral wool fire/acoustic insulation",
        sources.residentialCode,
        3600,
        true,
        [
          "Noncombustible batt insulation represented inside the party-wall zone for fire stopping and sound control.",
          "Field assembly must preserve required fire-resistance continuity at penetrations and floor lines."
        ]
      ),
      "#9f8f6d",
      0.2,
      d,
      buildingHeight,
      { x: side === "left" ? 0.66 : w - 0.66, y: d / 2, z: buildingHeight / 2 }
    );
  }

  for (let floor = 0; floor < config.stories; floor += 1) {
    const ceilingZ = (floor + 1) * config.storyHeightFt - gypsumThickness / 2;
    box(
      components,
      metadata(
        `ceiling-${floor + 1}-type-x-gypsum`,
        `Level ${floor + 1} gypsum ceiling fire membrane`,
        floor + 1 === config.stories ? "roof" : "structure",
        "5/8 in Type X gypsum ceiling board",
        sources.residentialCode,
        3100,
        true,
        fireAssemblyNotes
      ),
      "#f2eadc",
      w - 1.0,
      d - 0.7,
      gypsumThickness,
      { x: w / 2, y: d / 2, z: ceilingZ }
    );
  }

  for (let floor = 1; floor <= config.stories; floor += 1) {
    const z = floor * config.storyHeightFt;
    for (const [side, x] of [["left", 0.58], ["right", w - 0.58]] as const) {
      box(
        components,
        metadata(
          `party-wall-${side}-floor-${floor}-fireblocking`,
          `${side} party wall floor ${floor} fireblocking`,
          "structure",
          "fireblocking at concealed floor line",
          sources.residentialCode,
          260,
          true,
          ["Schematic fireblocking strip at concealed horizontal floor-wall intersections."]
        ),
        "#b66d4d",
        0.32,
        d,
        0.28,
        { x, y: d / 2, z }
      );
    }
  }

  box(
    components,
    metadata(
      "front-wall-cavity-insulation",
      "Front exterior wall cavity insulation",
      "facade",
      "dense-pack cellulose or mineral wool exterior wall insulation",
      sources.energyCode,
      3400,
      true,
      insulationNotes
    ),
    "#b9a771",
    w - 1.0,
    exteriorInsulationThickness,
    buildingHeight - 1.0,
    { x: w / 2, y: 0.16, z: buildingHeight / 2 }
  );
  box(
    components,
    metadata(
      "rear-wall-cavity-insulation",
      "Rear exterior wall cavity insulation",
      "structure",
      "dense-pack cellulose or mineral wool exterior wall insulation",
      sources.energyCode,
      3400,
      true,
      insulationNotes
    ),
    "#b9a771",
    w - 1.0,
    exteriorInsulationThickness,
    buildingHeight - 1.0,
    { x: w / 2, y: d - 0.16, z: buildingHeight / 2 }
  );
  box(
    components,
    metadata(
      "roof-insulation-and-air-barrier",
      "Roof insulation and air barrier",
      "roof",
      "high-R roof insulation with continuous air barrier",
      sources.energyCode,
      7800,
      true,
      [
        ...insulationNotes,
        "Modeled as a deep roof insulation package consistent with high-performance flat-roof practice."
      ]
    ),
    "#d8c782",
    w - 1.0,
    d - 0.7,
    roofInsulationThickness,
    { x: w / 2, y: d / 2, z: buildingHeight - roofInsulationThickness / 2 - 0.35 }
  );
  box(
    components,
    metadata(
      "foundation-rim-joist-insulation",
      "Foundation and rim joist insulation",
      "structure",
      "closed-cell spray foam rim joist insulation and air seal",
      sources.energyCode,
      2100,
      true,
      insulationNotes
    ),
    "#d6bf78",
    w - 1.0,
    0.42,
    1.4,
    { x: w / 2, y: d - 0.32, z: 0.9 }
  );
}

function addFrontWallAssemblyLayers(
  components: ModelComponent[],
  config: RowhomeConfig,
  buildingHeight: number,
  facadeYAt: (x: number, offset?: number) => number
): void {
  const w = config.buildingWidthFt;
  const facadeMaterial = selectedFacadeMaterial(config);
  const assemblyNotes = [
    `Selected cladding thickness: ${facadeMaterial.claddingThicknessFt.toFixed(2)} ft.`,
    `Backup: ${facadeMaterial.backupMaterial}.`,
    "Schematic layered wall assembly; flashing, ties, air gaps, fasteners, and opening details require professional review."
  ];

  box(
    components,
    metadata(
      "front-wall-structural-backup",
      "Front wall structural backup",
      "facade",
      facadeMaterial.backupMaterial,
      sources.residentialCode,
      6200,
      true,
      assemblyNotes
    ),
    "#a8825d",
    w - 0.8,
    0.5,
    buildingHeight - 0.8,
    { x: w / 2, y: facadeYAt(w / 2, 0.02), z: buildingHeight / 2 }
  );
  box(
    components,
    metadata(
      "front-wall-sheathing",
      "Front wall exterior sheathing",
      "facade",
      "7/16 in OSB or plywood exterior wall sheathing",
      sources.residentialCode,
      1800,
      true,
      assemblyNotes
    ),
    "#b88b55",
    w - 0.8,
    7 / 16 / 12,
    buildingHeight - 0.8,
    { x: w / 2, y: facadeYAt(w / 2, 0.24), z: buildingHeight / 2 }
  );
  box(
    components,
    metadata(
      "front-wall-weather-barrier",
      "Front wall weather-resistive barrier",
      "facade",
      "weather-resistive barrier and flashing plane",
      sources.residentialCode,
      1200,
      true,
      assemblyNotes
    ),
    "#24383d",
    w - 0.8,
    0.03,
    buildingHeight - 0.8,
    { x: w / 2, y: facadeYAt(w / 2, 0.31), z: buildingHeight / 2 }
  );
  box(
    components,
    metadata(
      "front-wall-interior-gypsum",
      "Front wall interior gypsum finish",
      "facade",
      "1/2 in interior gypsum wallboard",
      sources.residentialCode,
      2100,
      true,
      assemblyNotes
    ),
    "#efe9dd",
    w - 0.8,
    0.5 / 12,
    buildingHeight - 0.8,
    { x: w / 2, y: 0.42, z: buildingHeight / 2 }
  );
}

function addInteriorPartitionAssembly(
  components: ModelComponent[],
  id: string,
  y: number,
  floor: number,
  config: RowhomeConfig
): void {
  const w = config.buildingWidthFt;
  const z = floor * config.storyHeightFt + 4.2;
  const notes = [
    "Interior partition modeled as dimensional wood studs with gypsum board each side.",
    "Schematic framing only; structural, acoustic, fire, and MEP penetrations require professional review."
  ];

  box(
    components,
    metadata(id, `${id.replaceAll("-", " ")} stud core`, "interior", "2x4 wood stud partition framing", sources.residentialCode, 1100, true, notes),
    "#c49a67",
    w - 1.6,
    3.5 / 12,
    8.2,
    { x: w / 2, y, z }
  );
  for (const [face, offset] of [["front", -0.19], ["rear", 0.19]] as const) {
    box(
      components,
      metadata(
        `${id}-${face}-gypsum`,
        `${id.replaceAll("-", " ")} ${face} gypsum face`,
        "interior",
        "1/2 in gypsum wallboard",
        sources.residentialCode,
        420,
        true,
        notes
      ),
      "#e6dfcf",
      w - 1.6,
      0.5 / 12,
      8.2,
      { x: w / 2, y: y + offset, z }
    );
  }
}

export function generateRowhome(config: RowhomeConfig): RowhomeModel {
  const components: ModelComponent[] = [];
  const buildingHeight = config.stories * config.storyHeightFt;
  const w = config.buildingWidthFt;
  const d = config.buildingDepthFt;
  const facadeMaterial = selectedFacadeMaterial(config);
  const facadeStyle = selectedFacadeStyle(config.facadeStyleId);
  const isBowedFront = facadeStyle.id === "bowed-front";
  const isBayFront = facadeStyle.id === "bay-front";
  const bowDepth = 1.15;
  const facadeYAt = (x: number, offset = 0.56) => (isBowedFront ? -bowProjectionAtX(x, w, bowDepth) - offset : -offset);
  const facadeAngleAt = (x: number) => (isBowedFront ? bowTangentAngleAtX(x, w, bowDepth) : 0);

  box(
    components,
    metadata("lot", "R-8 lot plane", "site", "site surface", sources.r8, 0, false),
    "#5d7053",
    config.lotWidthFt + 2,
    config.lotDepthFt + 10,
    0.16,
    { x: config.lotWidthFt / 2, y: config.lotDepthFt / 2 - 5, z: -0.08 }
  );
  addBasement(components, config);

  box(
    components,
    metadata("party-wall-left", "Left party wall", "structure", "8 in brick or CMU masonry party wall", sources.residentialCode, 8800),
    "#9f422f",
    0.45,
    d,
    buildingHeight,
    { x: 0.225, y: d / 2, z: buildingHeight / 2 }
  );
  box(
    components,
    metadata("party-wall-right", "Right party wall", "structure", "8 in brick or CMU masonry party wall", sources.residentialCode, 8800),
    "#9f422f",
    0.45,
    d,
    buildingHeight,
    { x: w - 0.225, y: d / 2, z: buildingHeight / 2 }
  );
  const facadeMeta = metadata(
      "front-facade",
      `${facadeStyle.label} ${facadeMaterial.label} facade`,
      "facade",
      facadeMaterial.material,
      isBowedFront ? sources.biaCurvedBrick : sources.r8,
      estimateFacadeMaterialCost(config, facadeMaterial, facadeStyle),
      true,
      [facadeMaterial.notes, facadeStyle.notes, "Intentional architectural swell front; not a structural wall bowing defect."]
    );
  if (isBowedFront) {
    components.push(makeCurvedFacadeComponent(
      facadeMeta,
      facadeMaterial.color,
      w,
      facadeMaterial.claddingThicknessFt,
      buildingHeight,
      bowDepth,
      { x: w / 2, y: 0, z: 0 }
    ));
  } else {
    box(
      components,
      facadeMeta,
      facadeMaterial.color,
      w,
      facadeMaterial.claddingThicknessFt,
      buildingHeight,
      { x: w / 2, y: -facadeMaterial.claddingThicknessFt / 2, z: buildingHeight / 2 }
    );
  }
  addFrontWallAssemblyLayers(components, config, buildingHeight, facadeYAt);
  box(
    components,
    metadata("rear-wall", "Rear wall", "structure", "8 in brick or CMU masonry rear wall", sources.residentialCode, 9600),
    "#7e382d",
    w,
    0.36,
    buildingHeight,
    { x: w / 2, y: d + 0.18, z: buildingHeight / 2 }
  );

  for (let floor = 0; floor <= config.stories; floor += 1) {
    const isRoof = floor === config.stories;
    box(
      components,
      metadata(`floor-plate-${floor}`, isRoof ? "Flat roof deck" : `Floor plate ${floor + 1}`, isRoof ? "roof" : "structure", "engineered wood framing", sources.residentialCode, isRoof ? 7800 : 9200),
      isRoof ? "#746b5a" : "#b89563",
      w - 0.9,
      d,
      0.32,
      { x: w / 2, y: d / 2, z: floor * config.storyHeightFt + 0.16 }
    );
  }
  addFireAndThermalAssemblies(components, config, buildingHeight);

  box(
    components,
    metadata("front-parapet", "Front parapet and coping", "roof", "masonry coping", sources.residentialCode, 2200),
    "#6c3026",
    w,
    0.6,
    2.2,
    { x: w / 2, y: -0.22, z: buildingHeight + 1.1 }
  );
  box(
    components,
    metadata("cornice", "Facade cornice band", "facade", "formed metal cornice", sources.r8, 3600),
    "#2c343a",
    w,
    0.8,
    1.0,
    { x: w / 2, y: -0.55, z: buildingHeight - 0.8 }
  );
  box(
    components,
    metadata("deep-cornice-cap", "Deep projecting cornice cap", "facade", "formed metal cornice", sources.r8, 2100),
    "#1f272d",
    w + 0.9,
    1.05,
    0.35,
    { x: w / 2, y: facadeYAt(w / 2, 0.62), z: buildingHeight - 0.05 }
  );
  for (const [label, z] of [["second-floor", config.storyHeightFt], ["third-floor", config.storyHeightFt * 2]] as const) {
    box(
      components,
      metadata(`belt-course-${label}`, `Stone belt course at ${label}`, "facade", "stone belt course", sources.r8, 850),
      "#c8bea8",
      w + 0.25,
      0.34,
      0.28,
      { x: w / 2, y: facadeYAt(w / 2, 0.48), z }
    );
  }
  box(
    components,
    metadata("stoop", "Front stoop", "facade", "concrete", sources.r8, 4200),
    "#8b8e8b",
    6.8,
    4.8,
    1.4,
    { x: w / 2, y: -2.8, z: 0.7 }
  );
  box(
    components,
    metadata("front-door", "Front entry door", "facade", "insulated exterior door", sources.residentialCode, 1800),
    "#111820",
    3.1,
    0.18,
    7.2,
    { x: w / 2 - 0.4, y: facadeYAt(w / 2 - 0.4, 0.50), z: 3.8 },
    facadeAngleAt(w / 2 - 0.4)
  );
  box(
    components,
    metadata("transom-window", "Entry transom window", "facade", "transom glazing", sources.baltimoreRowhouseAnatomy, 950),
    "#98d3ee",
    3.2,
    0.16,
    0.8,
    { x: w / 2 - 0.4, y: facadeYAt(w / 2 - 0.4, 0.58), z: 7.85 },
    facadeAngleAt(w / 2 - 0.4)
  );
  box(
    components,
    metadata("arched-entry-surround", "Arched entry surround", "facade", "stone entry surround", sources.r8, 2400),
    "#d1c5ad",
    4.3,
    0.28,
    0.45,
    { x: w / 2 - 0.4, y: facadeYAt(w / 2 - 0.4, 0.72), z: 7.7 },
    facadeAngleAt(w / 2 - 0.4)
  );
  box(
    components,
    metadata("left-entry-pilaster", "Left entry pilaster", "facade", "stone entry surround", sources.r8, 900),
    "#d1c5ad",
    0.38,
    0.28,
    7.1,
    { x: w / 2 - 2.15, y: facadeYAt(w / 2 - 2.15, 0.72), z: 3.75 },
    facadeAngleAt(w / 2 - 2.15)
  );
  box(
    components,
    metadata("right-entry-pilaster", "Right entry pilaster", "facade", "stone entry surround", sources.r8, 900),
    "#d1c5ad",
    0.38,
    0.28,
    7.1,
    { x: w / 2 + 1.35, y: facadeYAt(w / 2 + 1.35, 0.72), z: 3.75 },
    facadeAngleAt(w / 2 + 1.35)
  );

  for (const [side, x] of [["left", w / 2 - 3.2], ["right", w / 2 + 2.4]] as const) {
    box(
      components,
      metadata(`stoop-rail-${side}`, `Marble stoop rail ${side}`, "facade", "painted metal rail", sources.baltimoreRowhouseAnatomy, 600),
      "#22282c",
      0.18,
      4.0,
      2.2,
      { x, y: -3.05, z: 2.2 }
    );
  }

  if (isBayFront) {
    box(
      components,
      metadata("upper-box-bay", "Two-story projecting box bay", "facade", "window bay assembly", sources.r8, 9800),
      "#6f8791",
      5.4,
      2.0,
      config.storyHeightFt * 2 - 1.0,
      { x: w / 2, y: -1.25, z: config.storyHeightFt * 2 }
    );
  }

  for (let story = 0; story < config.stories; story += 1) {
    const z = story * config.storyHeightFt + 5.25;
    for (const [side, x] of [["left", 3.7], ["right", 14.2]] as const) {
      const windowProjection = facadeYAt(x, 0.58);
      const windowAngle = facadeAngleAt(x);
      box(
        components,
        metadata(`front-window-${side}-${story + 1}`, `Front ${side} window story ${story + 1}`, "facade", "window assembly", sources.residentialCode, 1100),
        "#8cc8e8",
        3.2,
        0.2,
        4.5,
        { x, y: windowProjection, z },
        windowAngle
      );
      box(
        components,
        metadata(`lintel-${side}-${story + 1}`, `Masonry lintel ${side} story ${story + 1}`, "facade", "stone lintel", sources.residentialCode, 450),
        "#c2b9a4",
        3.8,
        0.28,
        0.32,
        { x, y: facadeYAt(x, 0.72), z: z + 2.42 },
        windowAngle
      );
      box(
        components,
        metadata(`stone-sill-${side}-${story + 1}`, `Projecting stone sill ${side} story ${story + 1}`, "facade", "stone sill", sources.baltimoreRowhouseAnatomy, 260),
        "#d1c5ad",
        3.7,
        0.42,
        0.22,
        { x, y: facadeYAt(x, 0.82), z: z - 2.38 },
        windowAngle
      );
      if (story === 0) {
        box(
          components,
          metadata(`window-planter-${side}`, `Window planter ${side}`, "facade", "painted metal planter", sources.baltimoreRowhouseAnatomy, 325),
          "#26392d",
          3.2,
          0.55,
          0.45,
          { x, y: facadeYAt(x, 1.06), z: z - 2.85 },
          windowAngle
        );
      }
    }
  }

  if (isBowedFront) {
    for (let i = 1; i < 8; i += 1) {
      const x = (w / 8) * i;
      box(
        components,
        metadata(`swell-front-vertical-joint-${i}`, `Swell-front vertical masonry joint ${i}`, "facade", "tooled masonry joint", sources.biaCurvedBrick, 75, false),
        "#4d2118",
        0.055,
        0.08,
        buildingHeight,
        { x, y: facadeYAt(x, 0.37), z: buildingHeight / 2 },
        facadeAngleAt(x)
      );
    }
  }

  for (let run = 0; run < config.stories; run += 1) {
    if (config.stairImplementation === "spiral") {
      addSpiralStairFlight(components, run, run * config.storyHeightFt, config.storyHeightFt, sources.residentialCode);
    } else {
      addAlternatingRunStairFlight(components, run, run * config.storyHeightFt, sources.residentialCode);
    }
  }

  for (const [id, name, y, depth] of [
    ["living-room", "Front living room", 8.5, 14.0],
    ["dining-room", "Middle dining room", 24.0, 11.0],
    ["kitchen-room", "Rear kitchen", 39.0, 12.0],
    ["primary-bedroom", "Primary bedroom", 8.5, 14.0],
    ["second-bedroom", "Second bedroom", 34.0, 14.0],
    ["third-floor-bedroom", "Third floor bedroom", 10.0, 16.0],
    ["office-room", "Third floor office", 34.0, 12.0]
  ] as const) {
    const floor = id === "primary-bedroom" || id === "second-bedroom" ? 1 : id === "third-floor-bedroom" || id === "office-room" ? 2 : 0;
    box(
      components,
      metadata(`${id}-zone`, name, "interior", "room zone marker", sources.residentialCode, 0, false),
      floor === 0 ? "#2d4551" : "#3c4158",
      w - 1.4,
      depth,
      0.08,
      { x: w / 2, y, z: floor * config.storyHeightFt + 0.42 }
    );
  }

  for (const [id, y] of [["first-floor-partition", 31.0], ["second-floor-front-partition", 17.0], ["second-floor-rear-partition", 29.5], ["third-floor-partition", 25.0]] as const) {
    const floor = id.startsWith("second") ? 1 : id.startsWith("third") ? 2 : 0;
    addInteriorPartitionAssembly(components, id, y, floor, config);
  }

  box(
    components,
    metadata("living-room-couch", "Living room couch", "interior", "upholstered sofa", sources.plan, 1800),
    "#4f6f77",
    7.0,
    3.0,
    2.2,
    { x: 10.2, y: 13.2, z: 1.1 }
  );
  box(
    components,
    metadata("living-room-coffee-table", "Living room coffee table", "interior", "wood coffee table", sources.plan, 450),
    "#7b5736",
    4.2,
    2.1,
    1.0,
    { x: 10.0, y: 9.2, z: 0.5 }
  );
  box(
    components,
    metadata("living-room-tv", "Wall mounted TV", "interior", "television", sources.plan, 900),
    "#111315",
    5.0,
    0.16,
    2.8,
    { x: 9.7, y: 3.25, z: 3.8 }
  );

  for (const [id, name, floor, x, y, rotation] of [
    ["primary-bed", "Primary bed", 1, 11.0, 8.4, 0],
    ["second-bedroom-bed", "Second bedroom bed", 1, 11.0, 37.0, 0],
    ["third-bedroom-bed", "Third floor bed", 2, 11.2, 10.0, 0]
  ] as const) {
    box(
      components,
      metadata(id, name, "interior", "bed frame and mattress", sources.plan, 1400),
      "#c9d2d8",
      5.0,
      6.6,
      1.4,
      { x, y, z: floor * config.storyHeightFt + 1.0 },
      rotation
    );
    box(
      components,
      metadata(`${id}-headboard`, `${name} headboard`, "interior", "wood headboard", sources.plan, 350),
      "#755334",
      5.3,
      0.35,
      3.0,
      { x, y: y - 3.45, z: floor * config.storyHeightFt + 2.0 },
      rotation
    );
  }

  box(
    components,
    metadata("kitchen-base-cabinets", "Kitchen base cabinets", "interior", "cabinetry", sources.electricalCode, 7600),
    "#d8ca9c",
    7.0,
    5.5,
    3.2,
    { x: 13.7, y: 7.75, z: 1.6 }
  );
  box(
    components,
    metadata("kitchen-island", "Kitchen island", "interior", "cabinetry and countertop", sources.plan, 5200),
    "#c3b07a",
    5.8,
    2.8,
    3.0,
    { x: 8.5, y: 39.0, z: 1.5 }
  );
  box(
    components,
    metadata("electric-range", "Electric range and oven", "interior", "electric appliance", sources.electricalCode, 2400),
    "#2b3034",
    2.6,
    2.4,
    3.1,
    { x: 15.0, y: 36.2, z: 1.55 }
  );
  box(
    components,
    metadata("refrigerator", "Refrigerator", "interior", "electric appliance", sources.electricalCode, 2600),
    "#d7dde0",
    3.0,
    2.8,
    6.7,
    { x: 15.0, y: 42.0, z: 3.35 }
  );
  box(
    components,
    metadata("kitchen-sink", "Kitchen sink", "interior", "sink and faucet", sources.plan, 1200),
    "#cbd5d8",
    2.4,
    1.5,
    0.45,
    { x: 12.2, y: 35.4, z: 3.25 }
  );
  box(
    components,
    metadata("electrical-panel", "Electrical panel", "electrical", "panelboard", sources.electricalCode, 2600),
    "#20252b",
    0.3,
    0.16,
    3.2,
    { x: 0.62, y: 4.1, z: 4.6 }
  );
  box(
    components,
    metadata("service-mast", "Electric service mast", "electrical", "weatherhead and service mast", sources.electricalCode, 1800),
    "#20252b",
    0.22,
    0.22,
    8.0,
    { x: 0.75, y: 2.2, z: buildingHeight + 3.0 }
  );
  box(
    components,
    metadata("main-feeder-run", "Main feeder run to panel", "electrical", "copper service conductors", sources.electricalCode, 1450),
    "#d1782a",
    0.18,
    2.0,
    buildingHeight - 3.0,
    { x: 0.72, y: 3.2, z: buildingHeight / 2 + 1.5 }
  );
  for (let floor = 0; floor < config.stories; floor += 1) {
    const z = floor * config.storyHeightFt + 8.6;
    box(
      components,
      metadata(`lighting-branch-circuit-${floor + 1}`, `Lighting branch circuit floor ${floor + 1}`, "electrical", "12 AWG copper NM-B cable", sources.electricalCode, 420),
      "#f0c04d",
      w - 1.2,
      0.12,
      0.12,
      { x: w / 2, y: 18.0, z }
    );
    box(
      components,
      metadata(`receptacle-branch-circuit-${floor + 1}`, `Receptacle branch circuit floor ${floor + 1}`, "electrical", "12 AWG copper NM-B cable", sources.electricalCode, 560),
      "#f0c04d",
      0.12,
      d - 8.0,
      0.12,
      { x: w - 0.9, y: d / 2, z: floor * config.storyHeightFt + 1.7 }
    );
  }
  box(
    components,
    metadata("kitchen-240v-outlet", "Accessible 240 volt range outlet", "electrical", "240 V receptacle", sources.electricalCode, 450),
    "#d6422e",
    0.35,
    0.12,
    0.35,
    { x: 10.2, y: 4.72, z: 1.6 }
  );
  box(
    components,
    metadata("range-240v-circuit", "240 volt range circuit", "electrical", "6 AWG copper range cable", sources.electricalCode, 900),
    "#d65a2e",
    5.0,
    0.14,
    0.14,
    { x: 7.9, y: 4.8, z: 1.8 }
  );

  for (let i = 0; i < 8; i += 1) {
    box(
      components,
      metadata(`receptacle-120v-${i + 1}`, `120 volt receptacle ${i + 1}`, "electrical", "120 V receptacle", sources.electricalCode, 95),
      "#eee9ba",
      0.28,
      0.12,
      0.3,
      { x: w - 0.62, y: 8 + i * 4, z: 1.35 }
    );
  }

  box(
    components,
    metadata("heat-pump-condenser", "Exterior electric heat pump condenser", "systems", "air-source heat pump condenser", sources.residentialCode, 6800),
    "#58636b",
    3.2,
    3.2,
    3.0,
    { x: w - 2.6, y: d + 7.0, z: 1.5 }
  );
  box(
    components,
    metadata("condenser-pad", "Heat pump condenser pad", "systems", "concrete equipment pad", sources.residentialCode, 650),
    "#8d918c",
    4.1,
    4.1,
    0.3,
    { x: w - 2.6, y: d + 7.0, z: 0.15 }
  );
  box(
    components,
    metadata("air-handler", "Indoor electric air handler", "systems", "electric air handler", sources.residentialCode, 5200),
    "#6e7780",
    2.8,
    2.2,
    5.0,
    { x: 3.1, y: d - 7.0, z: 3.0 }
  );
  box(
    components,
    metadata("refrigerant-lineset", "Refrigerant and control lineset", "systems", "insulated refrigerant lines and control wire", sources.residentialCode, 1250),
    "#2fb7c8",
    0.18,
    12.0,
    0.18,
    { x: w - 2.6, y: d + 1.0, z: 2.7 }
  );
  for (let floor = 0; floor < config.stories; floor += 1) {
    const z = floor * config.storyHeightFt + 8.2;
    box(
      components,
      metadata(`supply-trunk-${floor + 1}`, `Supply duct trunk floor ${floor + 1}`, "systems", "galvanized steel duct", sources.residentialCode, 1450),
      "#9aa7ad",
      1.0,
      d - 8.0,
      0.6,
      { x: 6.2, y: d / 2, z }
    );
    box(
      components,
      metadata(`return-trunk-${floor + 1}`, `Return duct trunk floor ${floor + 1}`, "systems", "galvanized steel return duct", sources.residentialCode, 1100),
      "#7f8b91",
      0.85,
      d - 12.0,
      0.55,
      { x: 11.8, y: d / 2 + 2.0, z: z - 0.85 }
    );
    for (const [room, y] of [["front", 9.0], ["middle", 24.0], ["rear", 40.0]] as const) {
      box(
        components,
        metadata(`supply-register-${room}-${floor + 1}`, `Supply register ${room} floor ${floor + 1}`, "systems", "supply register", sources.residentialCode, 180),
        "#c5d0d5",
        1.2,
        0.5,
        0.12,
        { x: 5.3, y, z: floor * config.storyHeightFt + 8.55 }
      );
    }
  }
  box(
    components,
    metadata("bath-exhaust-duct", "Bathroom exhaust duct to roof", "systems", "exhaust duct", sources.residentialCode, 650),
    "#b4bdc1",
    0.55,
    0.55,
    buildingHeight,
    { x: 14.5, y: 31.0, z: buildingHeight / 2 }
  );
  box(
    components,
    metadata("kitchen-range-hood-duct", "Kitchen range hood exhaust duct", "systems", "range hood exhaust duct", sources.residentialCode, 750),
    "#b4bdc1",
    0.65,
    8.0,
    0.65,
    { x: 13.8, y: 9.0, z: 8.4 }
  );

  box(
    components,
    metadata("rear-yard", "Rear yard service area", "site", "pervious yard surface", sources.naturalResources, 0, false),
    "#427d40",
    config.lotWidthFt,
    Math.max(0, config.lotDepthFt - d),
    0.08,
    { x: config.lotWidthFt / 2, y: d + (config.lotDepthFt - d) / 2, z: 0.02 }
  );

  if (config.includeTree) {
    components.push(makeCylinderComponent(
      metadata("street-tree-trunk", "Street tree trunk", "landscape", "urban tree", sources.completeStreets, 650),
      "#6c3f20",
      0.3,
      8,
      { x: 1.5, y: -7.7, z: 4 }
    ));
    box(
      components,
      metadata("street-tree-canopy", "Street tree canopy", "landscape", "urban tree canopy", sources.completeStreets, 0, false),
      "#2b7135",
      6,
      6,
      5,
      { x: 1.5, y: -7.7, z: 10.5 }
    );
  }

  const model: RowhomeModel = {
    name: "Baltimore R-8 Rowhome Concept Model",
    units: "feet",
    components,
    validation: []
  };
  model.validation = validateRowhome(config, model);
  return model;
}
