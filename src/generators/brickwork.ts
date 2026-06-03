import { Matrix4, Vector3 } from "three";
import type { ComponentCategory, ComponentMetadata, ModelComponent } from "../core/types";
import { sources } from "../core/sources";
import { makeInstancedBoxComponent } from "../geometry/component";
import { metadata } from "./builder";

export const standardBrick = {
  actualLengthFt: 7.625 / 12,
  actualDepthFt: 3.625 / 12,
  actualHeightFt: 2.25 / 12,
  moduleLengthFt: 8 / 12,
  moduleHeightFt: 2.625 / 12
} as const;

type BrickWallOrientation = "front-rear" | "party";

interface BrickWallInput {
  id: string;
  name: string;
  category: ComponentCategory;
  color: string;
  lengthFt: number;
  heightFt: number;
  center: { x: number; y: number; z: number };
  orientation: BrickWallOrientation;
  wytheCount?: number;
  source: string;
  estimatedCostUsd?: number;
  notes?: readonly string[];
}

function brickQuantity(count: number): ComponentMetadata["quantity"] {
  return {
    kind: "standard-brick",
    count,
    unit: "each",
    actualSizeIn: {
      length: 7.625,
      width: 3.625,
      height: 2.25
    },
    nominalModuleIn: {
      length: 8,
      height: 2.625
    }
  };
}

export function brickCountForRectangle(lengthFt: number, heightFt: number): number {
  const courses = Math.floor(heightFt / standardBrick.moduleHeightFt);
  let count = 0;
  for (let course = 0; course < courses; course += 1) {
    const offset = course % 2 === 0 ? 0 : standardBrick.moduleLengthFt / 2;
    count += Math.floor((lengthFt - offset) / standardBrick.moduleLengthFt);
  }
  return count;
}

export function brickCountForWall(input: Pick<BrickWallInput, "lengthFt" | "heightFt" | "wytheCount">): number {
  return brickCountForRectangle(input.lengthFt, input.heightFt) * (input.wytheCount ?? 1);
}

export function addInstancedBrickWall(components: ModelComponent[], input: BrickWallInput): void {
  const courses = Math.floor(input.heightFt / standardBrick.moduleHeightFt);
  const wytheCount = input.wytheCount ?? 1;
  const transforms: Matrix4[] = [];
  const bottomZ = input.center.z - input.heightFt / 2;
  const lengthStart = -input.lengthFt / 2;

  for (let wythe = 0; wythe < wytheCount; wythe += 1) {
    const wytheOffset = (wythe - (wytheCount - 1) / 2) * standardBrick.actualDepthFt;
    for (let course = 0; course < courses; course += 1) {
      const courseOffset = course % 2 === 0 ? 0 : standardBrick.moduleLengthFt / 2;
      const bricksInCourse = Math.floor((input.lengthFt - courseOffset) / standardBrick.moduleLengthFt);
      const verticalCenter = bottomZ + course * standardBrick.moduleHeightFt + standardBrick.actualHeightFt / 2;

      for (let brick = 0; brick < bricksInCourse; brick += 1) {
        const along = lengthStart + courseOffset + brick * standardBrick.moduleLengthFt + standardBrick.actualLengthFt / 2;
        const matrix = new Matrix4();
        if (input.orientation === "front-rear") {
          matrix.setPosition(new Vector3(input.center.x + along, verticalCenter, input.center.y + wytheOffset));
        } else {
          matrix.makeRotationY(Math.PI / 2);
          matrix.setPosition(new Vector3(input.center.x + wytheOffset, verticalCenter, input.center.y + along));
        }
        transforms.push(matrix);
      }
    }
  }

  const meta = metadata(
    input.id,
    input.name,
    input.category,
    "standard modular brick units in running bond",
    input.source,
    input.estimatedCostUsd ?? 0,
    true,
    [
      "Instanced brickwork uses standard modular brick: 7 5/8 in long x 3 5/8 in deep x 2 1/4 in high, with an 8 in x 2 5/8 in mortar module.",
      `Modeled as ${wytheCount} ${wytheCount === 1 ? "wythe" : "wythes"} of individually placed instanced brick units.`,
      "Brick count is based on visible wall rectangles segmented around modeled rough openings; waste, cuts, returns, corners, bond beams, and field breakage require professional takeoff.",
      ...(input.notes ?? [])
    ]
  );
  meta.quantity = brickQuantity(brickCountForWall(input));

  components.push(makeInstancedBoxComponent(
    meta,
    input.color,
    standardBrick.actualLengthFt,
    standardBrick.actualDepthFt,
    standardBrick.actualHeightFt,
    transforms,
    { cast: false, receive: true }
  ));
}

export function addBrickCountSummary(components: ModelComponent[], calculatedTotal?: number): void {
  const total = calculatedTotal ?? components.reduce((sum, component) => sum + (component.metadata.quantity?.kind === "standard-brick" ? component.metadata.quantity.count : 0), 0);
  const meta = metadata(
    "brick-takeoff-summary",
    "Standard brick takeoff summary",
    "structure",
    "standard modular brick takeoff",
    sources.residentialCode,
    0,
    false,
    [
      "Summarizes standard modular brick takeoff generated for the conceptual rowhome model.",
      "The default visual model uses solid textured walls; individual brick instances are optional and are not required for this count."
    ]
  );
  meta.quantity = brickQuantity(total);
  components.push(makeInstancedBoxComponent(meta, "#96311f", 0.001, 0.001, 0.001, []));
}
