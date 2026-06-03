import type { ModelComponent, RowhomeConfig } from "../core/types";
import { sources } from "../core/sources";
import { box, metadata } from "./builder";

const steelColumnSizeFt = 0.42;
const steelBeamWidthFt = 0.52;
const steelBeamDepthFt = 0.72;

export const steelSupportGrid = [
  { id: "front-left", x: 5.0, y: 15.0 },
  { id: "front-right", x: 13.0, y: 15.0 },
  { id: "rear-left", x: 5.0, y: 33.0 },
  { id: "rear-right", x: 13.0, y: 33.0 }
] as const;

export function addSteelSupportSystem(components: ModelComponent[], config: RowhomeConfig, buildingHeight: number): void {
  for (const point of steelSupportGrid) {
    box(
      components,
      metadata(
        `steel-column-${point.id}`,
        `Schematic steel column ${point.id}`,
        "structure",
        "painted structural steel HSS column",
        sources.residentialCode,
        3200,
        true,
        ["Conceptual alternate support option; member size, connections, fire protection, and foundations require structural design."]
      ),
      "#4d5963",
      steelColumnSizeFt,
      steelColumnSizeFt,
      buildingHeight,
      { x: point.x, y: point.y, z: buildingHeight / 2 }
    );
  }

  for (let level = 1; level <= config.stories; level += 1) {
    const z = level * config.storyHeightFt + 0.62;
    for (const [id, y] of [["front", 15.0], ["rear", 33.0]] as const) {
      box(
        components,
        metadata(
          `steel-beam-${id}-level-${level}`,
          `Schematic steel beam ${id} level ${level}`,
          "structure",
          "painted structural steel W-shape beam",
          sources.residentialCode,
          2800,
          true,
          ["Conceptual alternate support beam; not a selected member size or code-checked design."]
        ),
        "#59636c",
        8.7,
        steelBeamWidthFt,
        steelBeamDepthFt,
        { x: 9.0, y, z }
      );
    }
    for (const [id, x] of [["left", 5.0], ["right", 13.0]] as const) {
      box(
        components,
        metadata(
          `steel-girder-${id}-level-${level}`,
          `Schematic steel girder ${id} level ${level}`,
          "structure",
          "painted structural steel W-shape girder",
          sources.residentialCode,
          3400,
          true,
          ["Conceptual alternate support girder; not a selected member size or code-checked design."]
        ),
        "#535f68",
        steelBeamWidthFt,
        18.7,
        steelBeamDepthFt,
        { x, y: 24.0, z }
      );
    }
  }
}
