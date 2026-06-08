import type { ModelComponent, RowhomeConfig } from "../core/types";
import { sources } from "../core/sources";
import { box, metadata } from "./builder";

export function addRearExitAndFireEscape(components: ModelComponent[], config: RowhomeConfig): void {
  const w = config.buildingWidthFt;
  const d = config.buildingDepthFt;
  const platformWidth = 6.2;
  const platformDepth = 3.2;
  const platformY = d + 2.55;
  const platformFrontY = platformY - platformDepth / 2;
  const platformRearY = platformY + platformDepth / 2;
  const switchbackY = d + 10.8;
  const halfFlightSteps = 8;
  const halfFlightRun = switchbackY - platformRearY;
  const notes = [
    "Schematic rear egress and fire-escape assembly; final means-of-egress role, landing sizes, guards, attachment, corrosion protection, and fire-department review require professional design.",
    "Modeled as steel exterior platforms, guards, alternating stair flights, posts, footings, wall brackets, and rear exit doors."
  ];

  const addSupportedLanding = (
    id: string,
    name: string,
    center: { x: number; y: number; z: number },
    width: number,
    depth: number,
    cost: number,
    includeWallBrackets: boolean
  ) => {
    box(
      components,
      metadata(id, name, "circulation", "galvanized steel grating fire escape platform", sources.residentialCode, cost, true, notes),
      "#59656b",
      width,
      depth,
      0.22,
      center
    );
    for (const [xSide, x] of [["left", center.x - width / 2 + 0.28], ["right", center.x + width / 2 - 0.28]] as const) {
      for (const [ySide, y] of [["front", center.y - depth / 2 + 0.22], ["rear", center.y + depth / 2 - 0.22]] as const) {
        const postHeight = center.z - 0.11;
        box(
          components,
          metadata(`${id}-${ySide}-${xSide}-post`, `${name} ${ySide} ${xSide} support post`, "structure", "galvanized steel fire escape support post", sources.residentialCode, 700, true, notes),
          "#252d31",
          0.24,
          0.24,
          Math.max(0.8, postHeight),
          { x, y, z: Math.max(0.8, postHeight) / 2 }
        );
        box(
          components,
          metadata(`${id}-${ySide}-${xSide}-footing`, `${name} ${ySide} ${xSide} concrete footing`, "structure", "concrete pier footing for fire escape post", sources.residentialCode, 450, true, notes),
          "#8b8f8a",
          0.85,
          0.85,
          0.28,
          { x, y, z: 0.14 }
        );
      }
    }
    if (includeWallBrackets) {
      for (const [side, x] of [["left", center.x - width / 2 + 0.85], ["right", center.x + width / 2 - 0.85]] as const) {
        box(
          components,
          metadata(`${id}-${side}-wall-bracket`, `${name} ${side} wall bracket`, "structure", "galvanized steel fire escape wall bracket", sources.residentialCode, 520, true, notes),
          "#30383d",
          0.22,
          1.25,
          0.22,
          { x, y: d + 0.88, z: center.z - 0.25 }
        );
      }
    }
  };

  const addStairHalfFlight = (
    id: string,
    name: string,
    from: { x: number; y: number; z: number },
    to: { x: number; y: number; z: number }
  ) => {
    for (let step = 0; step < halfFlightSteps; step += 1) {
      const t = step / (halfFlightSteps - 1);
      box(
        components,
        metadata(`${id}-tread-${step + 1}`, `${name} tread ${step + 1}`, "circulation", "galvanized steel fire escape stair tread", sources.residentialCode, 120, true, notes),
        "#6c777d",
        3.0,
        0.72,
        0.16,
        {
          x: from.x + t * (to.x - from.x),
          y: from.y + t * (to.y - from.y),
          z: from.z + t * (to.z - from.z)
        }
      );
    }
    const run = Math.hypot(to.x - from.x, to.y - from.y);
    for (const [side, xOffset] of [["left", -1.62], ["right", 1.62]] as const) {
      box(
        components,
        metadata(`${id}-${side}-stringer`, `${name} ${side} stringer`, "circulation", "galvanized steel stair stringer", sources.residentialCode, 650, true, notes),
        "#30383d",
        0.18,
        run + 0.8,
        0.18,
        { x: (from.x + to.x) / 2 + xOffset, y: (from.y + to.y) / 2, z: (from.z + to.z) / 2 }
      );
    }
  };

  for (let story = 0; story < config.stories; story += 1) {
    const level = story + 1;
    const baseZ = story * config.storyHeightFt;
    box(
      components,
      metadata(
        `rear-exit-door-${level}`,
        level === 1 ? "Rear yard exit door" : `Rear fire escape access door level ${level}`,
        "facade",
        "insulated steel rear egress door",
        sources.residentialCode,
        level === 1 ? 1600 : 1800,
        true,
        notes
      ),
      "#1d2830",
      3.0,
      0.18,
      7.0,
      { x: w / 2, y: d + 0.55, z: baseZ + 3.75 }
    );
    box(
      components,
      metadata(`rear-exit-door-${level}-frame`, `Rear exit door frame level ${level}`, "facade", "painted steel door frame", sources.residentialCode, 420, true, notes),
      "#d7d0bf",
      3.5,
      0.24,
      0.2,
      { x: w / 2, y: d + 0.66, z: baseZ + 7.45 }
    );
    for (const [side, x] of [["left", w / 2 - 1.72], ["right", w / 2 + 1.72]] as const) {
      box(
        components,
        metadata(`rear-exit-door-${level}-${side}-jamb`, `Rear exit door ${side} jamb level ${level}`, "facade", "painted steel full-height door jamb", sources.residentialCode, 360, true, [
          ...notes,
          "Full-height jamb completes the rear egress door frame around the rough opening."
        ]),
        "#d7d0bf",
        0.22,
        0.28,
        7.35,
        { x, y: d + 0.67, z: baseZ + 3.78 }
      );
    }
    box(
      components,
      metadata(`rear-exit-door-${level}-threshold`, `Rear exit threshold level ${level}`, "facade", "metal sill and threshold", sources.residentialCode, 260, true, notes),
      "#9ca1a4",
      3.4,
      0.55,
      0.18,
      { x: w / 2, y: d + 0.75, z: baseZ + 0.18 }
    );
    box(
      components,
      metadata(`rear-exit-door-${level}-panic-handle`, `Rear exit door latch hardware level ${level}`, "facade", "egress door latch hardware", sources.residentialCode, 190, true, notes),
      "#c49a45",
      0.16,
      0.12,
      0.2,
      { x: w / 2 + 1.05, y: d + 0.86, z: baseZ + 3.8 }
    );
  }

  for (let story = 1; story < config.stories; story += 1) {
    const level = story + 1;
    const platformZ = story * config.storyHeightFt + 0.15;
    addSupportedLanding(`fire-escape-platform-${level}`, `Rear fire escape platform level ${level}`, { x: w / 2, y: platformY, z: platformZ }, platformWidth, platformDepth, 3600, true);
    for (const [side, x] of [["left", w / 2 - 3.0], ["right", w / 2 + 3.0]] as const) {
      box(
        components,
        metadata(`fire-escape-platform-${level}-${side}-guard`, `Fire escape ${side} guard level ${level}`, "circulation", "galvanized steel guard rail", sources.residentialCode, 900, true, notes),
        "#30383d",
        0.16,
        3.25,
        3.5,
        { x, y: platformY, z: platformZ + 1.85 }
      );
    }
    box(
      components,
      metadata(`fire-escape-platform-${level}-rear-guard`, `Fire escape rear guard level ${level}`, "circulation", "galvanized steel guard rail", sources.residentialCode, 950, true, notes),
      "#30383d",
      platformWidth,
      0.16,
      3.5,
      { x: w / 2, y: d + 4.15, z: platformZ + 1.85 }
    );
  }

  for (let flight = 1; flight < config.stories; flight += 1) {
    const fromZ = flight * config.storyHeightFt + 0.1;
    const midZ = flight * config.storyHeightFt - config.storyHeightFt / 2 + 0.1;
    const toZ = (flight - 1) * config.storyHeightFt + 0.1;
    const lowerLandingName = flight === 1 ? "Rear fire escape yard landing" : `Rear fire escape platform level ${flight}`;
    const switchId = `fire-escape-switchback-landing-${flight}`;
    addSupportedLanding(switchId, `Fire escape switchback landing flight ${flight}`, { x: w / 2, y: switchbackY, z: midZ }, platformWidth, platformDepth, 2100, false);
    addStairHalfFlight(
      `fire-escape-stair-${flight}-upper`,
      `Fire escape stair ${flight} upper flight`,
      { x: w / 2 - 1.65, y: platformRearY, z: fromZ },
      { x: w / 2 - 1.65, y: switchbackY - platformDepth / 2, z: midZ }
    );
    addStairHalfFlight(
      `fire-escape-stair-${flight}-lower`,
      `Fire escape stair ${flight} lower flight to ${lowerLandingName}`,
      { x: w / 2 + 1.65, y: switchbackY - platformDepth / 2, z: midZ },
      { x: w / 2 + 1.65, y: platformRearY, z: toZ }
    );
  }

  addSupportedLanding("fire-escape-yard-landing", "Rear fire escape yard landing", { x: w / 2, y: platformY, z: 0.1 }, platformWidth, platformDepth, 1900, false);
}
