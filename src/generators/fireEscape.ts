import type { ModelComponent, RowhomeConfig } from "../core/types";
import { sources } from "../core/sources";
import { box, metadata } from "./builder";

export function addRearExitAndFireEscape(components: ModelComponent[], config: RowhomeConfig): void {
  const w = config.buildingWidthFt;
  const d = config.buildingDepthFt;
  const notes = [
    "Schematic rear egress and fire-escape assembly; final means-of-egress role, landing sizes, guards, attachment, corrosion protection, and fire-department review require professional design.",
    "Modeled as steel exterior platforms, guards, ladder/stair access, and rear exit doors."
  ];

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
    const platformY = d + 2.55;
    box(
      components,
      metadata(`fire-escape-platform-${level}`, `Rear fire escape platform level ${level}`, "circulation", "galvanized steel grating fire escape platform", sources.residentialCode, 3600, true, notes),
      "#59656b",
      6.2,
      3.2,
      0.22,
      { x: w / 2, y: platformY, z: platformZ }
    );
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
      6.2,
      0.16,
      3.5,
      { x: w / 2, y: d + 4.15, z: platformZ + 1.85 }
    );
  }

  for (let flight = 1; flight < config.stories; flight += 1) {
    const fromZ = flight * config.storyHeightFt;
    const toZ = (flight - 1) * config.storyHeightFt;
    const steps = 11;
    for (let step = 0; step < steps; step += 1) {
      const t = step / (steps - 1);
      box(
        components,
        metadata(`fire-escape-stair-${flight}-tread-${step + 1}`, `Fire escape stair ${flight} tread ${step + 1}`, "circulation", "galvanized steel fire escape stair tread", sources.residentialCode, 120, true, notes),
        "#6c777d",
        3.0,
        0.72,
        0.16,
        { x: w / 2, y: d + 4.0 + t * 5.6, z: fromZ - t * (fromZ - toZ) - 0.15 }
      );
    }
    for (const [side, x] of [["left", w / 2 - 1.62], ["right", w / 2 + 1.62]] as const) {
      box(
        components,
        metadata(`fire-escape-stair-${flight}-${side}-stringer`, `Fire escape stair ${flight} ${side} stringer`, "circulation", "galvanized steel stair stringer", sources.residentialCode, 650, true, notes),
        "#30383d",
        0.18,
        6.4,
        0.18,
        { x, y: d + 6.8, z: (fromZ + toZ) / 2 }
      );
    }
  }

  box(
    components,
    metadata("fire-escape-yard-landing", "Rear fire escape yard landing", "circulation", "galvanized steel landing at grade", sources.residentialCode, 1900, true, notes),
    "#59656b",
    5.6,
    3.0,
    0.2,
    { x: w / 2, y: d + 10.0, z: 0.1 }
  );
}
