import type { ModelComponent } from "../core/types";
import { makeCylinderComponent } from "../geometry/component";
import { box, metadata } from "./builder";

export const frontSpiralStairPlan = {
  centerX: 9.0,
  centerY: 7.8,
  clearWidthFt: 2.25,
  walklineRadiusFt: 2.0,
  outerRadiusFt: 2.7,
  floorOpeningHalfFt: 3.65
} as const;

const alternatingStairPlan = {
  x: 2.8,
  width: 3.2,
  treadDepth: 0.78,
  riserHeight: 0.625,
  treadThickness: 0.18,
  steps: 16,
  landingDepth: 3.4,
  landingExtraWidth: 0.2,
  floorOpeningXMax: 5.15
} as const;

function alternatingStairDirection(floor: number): 1 | -1 {
  return floor % 2 === 0 ? 1 : -1;
}

function alternatingStairYStart(direction: 1 | -1): number {
  return direction === 1 ? 18.4 : 32.6;
}

function alternatingStairTopY(floor: number): number {
  const direction = alternatingStairDirection(floor);
  return alternatingStairYStart(direction) + direction * (alternatingStairPlan.steps * alternatingStairPlan.treadDepth + 1.7);
}

export function addAlternatingRunStairFlight(
  components: ModelComponent[],
  floor: number,
  baseZ: number,
  source: string
): void {
  const stairWidth = alternatingStairPlan.width;
  const treadDepth = alternatingStairPlan.treadDepth;
  const riserHeight = alternatingStairPlan.riserHeight;
  const treadThickness = alternatingStairPlan.treadThickness;
  const steps = alternatingStairPlan.steps;
  const x = alternatingStairPlan.x;
  const direction = alternatingStairDirection(floor);
  const yStart = alternatingStairYStart(direction);
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
    const z = baseZ + (step + 1) * riserHeight + treadThickness / 2;
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
  const topY = alternatingStairTopY(floor);
  for (const [side, stringerX] of [["left", x - stairWidth / 2 + 0.12], ["right", x + stairWidth / 2 - 0.12]] as const) {
    box(
      components,
      metadata(`stair-stringer-${side}-${floor + 1}`, `Stair ${side} structural stringer flight ${floor + 1}`, "structure", "engineered wood stair stringer", source, 620, true, [
        ...stairNotes,
        "Schematic stair stringer; final stair framing, hangers, bearing, fastening, and lateral restraint require structural review."
      ]),
      "#6f4728",
      0.18,
      steps * treadDepth + 0.8,
      0.42,
      { x: stringerX, y: runCenterY, z: baseZ + storyHeightLikeStairRunHeight(steps, riserHeight) / 2 }
    );
  }
  for (const step of [4, 8, 12, 16]) {
    const y = yStart + direction * ((step - 0.5) * treadDepth);
    const postHeight = Math.max(0.5, step * riserHeight);
    for (const postX of [x - stairWidth / 2 + 0.28, x + stairWidth / 2 - 0.28]) {
      box(
        components,
        metadata(`stair-post-${floor + 1}-${step}-${postX < x ? "left" : "right"}`, `Stair support post flight ${floor + 1} step ${step} ${postX < x ? "left" : "right"}`, "structure", "wood stair support post", source, 210, true, [
          ...stairNotes,
          "Schematic post under stair framing; final load path, bearing, blocking, and connection design required."
        ]),
        "#5f3d24",
        0.22,
        0.22,
        postHeight,
        { x: postX, y, z: baseZ + postHeight / 2 }
      );
    }
  }
  box(
    components,
    metadata(`stair-landing-${floor + 1}`, `Alternating stair landing ${floor + 1}`, "circulation", "wood stair landing", source, 1200, true, stairNotes),
    "#8a5e38",
    stairWidth + alternatingStairPlan.landingExtraWidth,
    alternatingStairPlan.landingDepth,
    0.32,
    { x, y: topY, z: topZ + 0.16 }
  );
  for (const postX of [x - stairWidth / 2 + 0.25, x + stairWidth / 2 - 0.25]) {
    for (const postY of [topY - alternatingStairPlan.landingDepth / 2 + 0.25, topY + alternatingStairPlan.landingDepth / 2 - 0.25]) {
      const landingPostHeight = Math.max(0.5, topZ - baseZ);
      box(
        components,
        metadata(`stair-landing-post-${floor + 1}-${postX < x ? "left" : "right"}-${postY < topY ? "front" : "rear"}`, `Stair landing support post ${floor + 1}`, "structure", "wood landing support post", source, 260, true, [
          ...stairNotes,
          "Schematic landing post; final bearing and connection design required."
        ]),
        "#5f3d24",
        0.24,
        0.24,
        landingPostHeight,
        { x: postX, y: postY, z: baseZ + landingPostHeight / 2 }
      );
    }
  }
  box(
    components,
    metadata(`stair-landing-ledger-${floor + 1}`, `Stair landing wall ledger ${floor + 1}`, "structure", "wood landing ledger board", source, 430, true, [
      ...stairNotes,
      "Schematic landing ledger/beam showing bearing at the floor opening; final fastener and support design required."
    ]),
    "#6f4728",
    stairWidth + alternatingStairPlan.landingExtraWidth,
    0.28,
    0.36,
    { x, y: topY + direction * alternatingStairPlan.landingDepth / 2, z: topZ - 0.18 }
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

function storyHeightLikeStairRunHeight(steps: number, riserHeight: number): number {
  return steps * riserHeight;
}

export function addAlternatingRunStairEgressBridge(
  components: ModelComponent[],
  floor: number,
  baseZ: number,
  source: string
): void {
  const landingWidth = alternatingStairPlan.width + alternatingStairPlan.landingExtraWidth;
  const landingMaxX = alternatingStairPlan.x + landingWidth / 2;
  const bridgeWidth = alternatingStairPlan.floorOpeningXMax - landingMaxX;
  if (bridgeWidth <= 0.01) {
    return;
  }

  const topZ = baseZ + alternatingStairPlan.steps * alternatingStairPlan.riserHeight;
  const topY = alternatingStairTopY(floor);
  box(
    components,
    metadata(
      `stair-egress-bridge-${floor + 1}`,
      `Stair egress bridge ${floor + 1}`,
      "circulation",
      "wood stair landing bridge to adjacent floor plate",
      source,
      650,
      true,
      [
        "Connects the stair arrival landing flush to the adjacent floor or roof plate.",
        "Prevents the modeled flight from terminating at an isolated landing within the stairwell opening."
      ]
    ),
    "#9a6a3f",
    bridgeWidth,
    alternatingStairPlan.landingDepth,
    0.32,
    { x: landingMaxX + bridgeWidth / 2, y: topY, z: topZ + 0.16 }
  );
}

export function addSpiralStairFlight(
  components: ModelComponent[],
  floor: number,
  baseZ: number,
  storyHeight: number,
  source: string
): void {
  const steps = 18;
  const centerX = frontSpiralStairPlan.centerX;
  const centerY = frontSpiralStairPlan.centerY;
  const treadCenterRadius = frontSpiralStairPlan.walklineRadiusFt - frontSpiralStairPlan.clearWidthFt / 4;
  const treadWidth = frontSpiralStairPlan.clearWidthFt;
  const treadDepth = 2.05;
  const treadThickness = 0.18;
  const riserHeight = storyHeight / steps;
  const clockwise = floor % 2 === 0 ? 1 : -1;
  const spiralNotes = [
    "Front-hall spiral stair is placed inside the curved urban facade zone to preserve the bowed street-wall reading.",
    "IRC R311.7.10.1 reference: modeled with 27 in clear width, 24 in walkline radius, and 6.7 in risers; egress role and final dimensions require professional review.",
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
    const x = centerX + Math.cos(angle) * treadCenterRadius;
    const y = centerY + Math.sin(angle) * treadCenterRadius;
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
    3.8,
    2.8,
    0.26,
    { x: centerX, y: centerY + 2.25 * clockwise, z: baseZ + storyHeight - 0.13 }
  );
}
