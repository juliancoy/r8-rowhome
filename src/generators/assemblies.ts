import type { ModelComponent, RowhomeConfig } from "../core/types";
import { sources } from "../core/sources";
import { selectedFacadeMaterial } from "../core/facadeMaterials";
import { box, frontWallOpenings, metadata, rearWallOpenings, wallSegmentsAroundOpenings } from "./builder";

function stairOpening(config: RowhomeConfig): { xMin: number; xMax: number; yMin: number; yMax: number } {
  if (config.stairImplementation === "spiral") {
    return { xMin: 5.35, xMax: 12.65, yMin: 4.15, yMax: 11.45 };
  }
  return { xMin: 0.85, xMax: 5.15, yMin: 6.2, yMax: 35.2 };
}

function addLayerAroundStairOpening(
  components: ModelComponent[],
  config: RowhomeConfig,
  baseId: string,
  name: string,
  category: "structure" | "roof",
  material: string,
  color: string,
  thickness: number,
  z: number,
  source: string,
  cost: number,
  notes: string[]
): void {
  const w = config.buildingWidthFt;
  const d = config.buildingDepthFt;
  const opening = stairOpening(config);
  for (const [segmentId, x0, x1, y0, y1] of [
    ["left", 0.5, opening.xMin, 0.35, d - 0.35],
    ["right", opening.xMax, w - 0.5, 0.35, d - 0.35],
    ["front", opening.xMin, opening.xMax, 0.35, opening.yMin],
    ["rear", opening.xMin, opening.xMax, opening.yMax, d - 0.35]
  ] as const) {
    const width = x1 - x0;
    const depth = y1 - y0;
    if (width <= 0.01 || depth <= 0.01) continue;
    box(
      components,
      metadata(segmentId === "left" ? baseId : `${baseId}-${segmentId}`, `${name} ${segmentId} of stair opening`, category, material, source, segmentId === "left" ? cost : 0, true, notes),
      color,
      width,
      depth,
      thickness,
      { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z }
    );
  }
}

export function addFireAndThermalAssemblies(
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
    addLayerAroundStairOpening(
      components,
      config,
      `ceiling-${floor + 1}-type-x-gypsum`,
      `Level ${floor + 1} gypsum ceiling fire membrane`,
      floor + 1 === config.stories ? "roof" : "structure",
      "5/8 in Type X gypsum ceiling board",
      "#f2eadc",
      gypsumThickness,
      ceilingZ,
      sources.residentialCode,
      3100,
      fireAssemblyNotes
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

  for (const [index, segment] of wallSegmentsAroundOpenings(w, buildingHeight, frontWallOpenings(config)).entries()) {
    box(
      components,
      metadata(
        index === 0 ? "front-wall-cavity-insulation" : `front-wall-cavity-insulation-${index + 1}`,
        "Front exterior wall cavity insulation",
        "facade",
        "dense-pack cellulose or mineral wool exterior wall insulation",
        sources.energyCode,
        index === 0 ? 3400 : 0,
        true,
        [...insulationNotes, "Segmented around door and window rough openings."]
      ),
      "#b9a771",
      segment.width,
      exteriorInsulationThickness,
      segment.height,
      { x: segment.xCenter, y: 0.16, z: segment.zCenter }
    );
  }
  for (const opening of frontWallOpenings(config)) {
    const openingHeight = opening.zTop - opening.zBottom;
    const openingCenterZ = (opening.zBottom + opening.zTop) / 2;
    const returnNotes = [
      ...insulationNotes,
      "Exposed return at rough openings makes the insulation layer visible in the full model and shows continuity around windows and doors."
    ];
    for (const [side, x] of [["left", opening.xCenter - opening.width / 2 + 0.08], ["right", opening.xCenter + opening.width / 2 - 0.08]] as const) {
      box(
        components,
        metadata(
          `${opening.id}-${side}-insulation-return`,
          `Front ${opening.id} ${side} insulation return`,
          "facade",
          "visible mineral wool insulation return at rough opening",
          sources.energyCode,
          0,
          true,
          returnNotes
        ),
        "#d9c45f",
        0.16,
        0.34,
        openingHeight,
        { x, y: 0.13, z: openingCenterZ }
      );
    }
    for (const [edge, z] of [["head", opening.zTop - 0.08], ["sill", opening.zBottom + 0.08]] as const) {
      box(
        components,
        metadata(
          `${opening.id}-${edge}-insulation-return`,
          `Front ${opening.id} ${edge} insulation return`,
          "facade",
          "visible mineral wool insulation return at rough opening",
          sources.energyCode,
          0,
          true,
          returnNotes
        ),
        "#d9c45f",
        opening.width,
        0.34,
        0.16,
        { x: opening.xCenter, y: 0.13, z }
      );
    }
  }
  for (const [index, segment] of wallSegmentsAroundOpenings(w, buildingHeight, rearWallOpenings(config)).entries()) {
    box(
      components,
      metadata(
        index === 0 ? "rear-wall-cavity-insulation" : `rear-wall-cavity-insulation-${index + 1}`,
        "Rear exterior wall cavity insulation",
        "structure",
        "dense-pack cellulose or mineral wool exterior wall insulation",
        sources.energyCode,
        index === 0 ? 3400 : 0,
        true,
        [...insulationNotes, "Segmented around rear egress door rough openings."]
      ),
      "#b9a771",
      segment.width,
      exteriorInsulationThickness,
      segment.height,
      { x: segment.xCenter, y: d - 0.16, z: segment.zCenter }
    );
  }
  addLayerAroundStairOpening(
    components,
    config,
    "roof-insulation-and-air-barrier",
    "Roof insulation and air barrier",
    "roof",
    "high-R roof insulation with continuous air barrier",
    "#d8c782",
    roofInsulationThickness,
    buildingHeight - roofInsulationThickness / 2 - 0.35,
    sources.energyCode,
    7800,
    [
      ...insulationNotes,
      "Modeled as a deep roof insulation package consistent with high-performance flat-roof practice.",
      "Segmented around the stair bulkhead/opening so roof access is not blocked."
    ]
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

export function addFrontWallAssemblyLayers(
  components: ModelComponent[],
  config: RowhomeConfig,
  buildingHeight: number,
  facadeYAt: (x: number, offset?: number) => number
): void {
  const w = config.buildingWidthFt;
  const facadeMaterial = selectedFacadeMaterial(config);
  const segments = wallSegmentsAroundOpenings(w, buildingHeight, frontWallOpenings(config));
  const assemblyNotes = [
    `Selected cladding thickness: ${facadeMaterial.claddingThicknessFt.toFixed(2)} ft.`,
    `Backup: ${facadeMaterial.backupMaterial}.`,
    "Schematic layered wall assembly; flashing, ties, air gaps, fasteners, and opening details require professional review."
  ];

  for (const [index, segment] of segments.entries()) {
    box(
      components,
      metadata(
        index === 0 ? "front-wall-structural-backup" : `front-wall-structural-backup-${index + 1}`,
        "Front wall structural backup",
        "facade",
        facadeMaterial.backupMaterial,
        sources.residentialCode,
        index === 0 ? 6200 : 0,
        true,
        [...assemblyNotes, "Segmented around door and window openings so the glazing and entry are open through the wall."]
      ),
      "#a8825d",
      segment.width,
      0.5,
      segment.height,
      { x: segment.xCenter, y: facadeYAt(segment.xCenter, 0.02), z: segment.zCenter }
    );
    box(
      components,
      metadata(
        index === 0 ? "front-wall-sheathing" : `front-wall-sheathing-${index + 1}`,
        "Front wall exterior sheathing",
        "facade",
        "7/16 in OSB or plywood exterior wall sheathing",
        sources.residentialCode,
        index === 0 ? 1800 : 0,
        true,
        assemblyNotes
      ),
      "#b88b55",
      segment.width,
      7 / 16 / 12,
      segment.height,
      { x: segment.xCenter, y: facadeYAt(segment.xCenter, 0.24), z: segment.zCenter }
    );
    box(
      components,
      metadata(
        index === 0 ? "front-wall-weather-barrier" : `front-wall-weather-barrier-${index + 1}`,
        "Front wall weather-resistive barrier",
        "facade",
        "weather-resistive barrier and flashing plane",
        sources.residentialCode,
        index === 0 ? 1200 : 0,
        true,
        assemblyNotes
      ),
      "#24383d",
      segment.width,
      0.03,
      segment.height,
      { x: segment.xCenter, y: facadeYAt(segment.xCenter, 0.31), z: segment.zCenter }
    );
    box(
      components,
      metadata(
        index === 0 ? "front-wall-interior-gypsum" : `front-wall-interior-gypsum-${index + 1}`,
        "Front wall interior gypsum finish",
        "facade",
        "1/2 in interior gypsum wallboard",
        sources.residentialCode,
        index === 0 ? 2100 : 0,
        true,
        assemblyNotes
      ),
      "#efe9dd",
      segment.width,
      0.5 / 12,
      segment.height,
      { x: segment.xCenter, y: 0.42, z: segment.zCenter }
    );
  }
}

export function addInteriorPartitionAssembly(
  components: ModelComponent[],
  id: string,
  y: number,
  floor: number,
  config: RowhomeConfig
): void {
  const w = config.buildingWidthFt;
  const partitionHeight = Math.max(0.1, config.storyHeightFt - 0.32);
  const z = floor * config.storyHeightFt + partitionHeight / 2;
  const doorWidth = 3.0;
  const doorHeight = 7.0;
  const doorCenterX = config.buildingWidthFt / 2 - 1.2;
  const partitionXMin = 0.8;
  const partitionXMax = w - 0.8;
  const openings = [
    {
      id: "stair-opening",
      left: 0.75,
      right: 5.45,
      fullHeight: true,
      note: "Segmented around the stair hall so stair flights, treads, guards, and handrails do not pass through the partition."
    },
    {
      id: "door-opening",
      left: doorCenterX - doorWidth / 2,
      right: doorCenterX + doorWidth / 2,
      fullHeight: false,
      note: "Segmented around a room door opening."
    }
  ].map((opening) => ({
    ...opening,
    left: Math.max(partitionXMin, opening.left),
    right: Math.min(partitionXMax, opening.right)
  })).filter((opening) => opening.right > opening.left + 0.01).sort((a, b) => a.left - b.left);
  const notes = [
    "Interior partition modeled as dimensional wood studs with gypsum board each side.",
    "Schematic framing only; structural, acoustic, fire, and MEP penetrations require professional review.",
    "Segmented with door and stair-hall openings so rooms remain connected and stairs do not intersect wall geometry."
  ];

  const segments: Array<{ id: string; x: number; width: number; z: number; height: number; notes: string[] }> = [];
  let cursor = partitionXMin;
  let solidIndex = 1;
  for (const opening of openings) {
    if (opening.left > cursor + 0.01) {
      const width = opening.left - cursor;
      segments.push({
        id: solidIndex === 1 ? "left" : `solid-${solidIndex}`,
        x: cursor + width / 2,
        width,
        z,
        height: partitionHeight,
        notes
      });
      solidIndex += 1;
    }
    if (!opening.fullHeight) {
      segments.push({
        id: "header",
        x: (opening.left + opening.right) / 2,
        width: opening.right - opening.left,
        z: floor * config.storyHeightFt + doorHeight + (partitionHeight - doorHeight) / 2,
        height: partitionHeight - doorHeight,
        notes: [...notes, opening.note]
      });
    }
    cursor = Math.max(cursor, opening.right);
  }
  if (cursor < partitionXMax - 0.01) {
    const width = partitionXMax - cursor;
    segments.push({
      id: "right",
      x: cursor + width / 2,
      width,
      z,
      height: partitionHeight,
      notes
    });
  }

  for (const segment of segments) {
    const segmentId = segment.id;
    const segmentX = segment.x;
    const segmentWidth = segment.width;
    const segmentZ = segment.z;
    const segmentHeight = segment.height;
    if (segmentWidth <= 0.01 || segmentHeight <= 0.01) continue;
    box(
      components,
      metadata(
        segmentId === "left" ? id : `${id}-${segmentId}`,
        `${id.replaceAll("-", " ")} ${segmentId} stud core`,
        "interior",
        "2x4 wood stud partition framing",
        sources.residentialCode,
        segmentId === "left" ? 1100 : 0,
        true,
        segment.notes
      ),
      "#c49a67",
      segmentWidth,
      3.5 / 12,
      segmentHeight,
      { x: segmentX, y, z: segmentZ }
    );
    for (const [face, offset] of [["front", -0.19], ["rear", 0.19]] as const) {
      box(
        components,
        metadata(
          segmentId === "left" ? `${id}-${face}-gypsum` : `${id}-${segmentId}-${face}-gypsum`,
          `${id.replaceAll("-", " ")} ${segmentId} ${face} gypsum face`,
          "interior",
          "1/2 in gypsum wallboard",
          sources.residentialCode,
          segmentId === "left" && face === "front" ? 420 : 0,
          true,
          segment.notes
        ),
      "#e6dfcf",
        segmentWidth,
      0.5 / 12,
        segmentHeight,
        { x: segmentX, y: y + offset, z: segmentZ }
      );
    }
  }
}
