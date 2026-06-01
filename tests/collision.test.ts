import { Box3, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { defaultRowhomeConfig } from "../src/core/config";
import type { ModelComponent } from "../src/core/types";
import { generateRowhome } from "../src/generators/rowhome";
import { frontSpiralStairPlan } from "../src/generators/stairs";

interface Bounds {
  min: Vector3;
  max: Vector3;
}

function boundsFor(component: ModelComponent): Bounds {
  component.object.updateMatrixWorld(true);
  const box = new Box3().setFromObject(component.object);
  return { min: box.min.clone(), max: box.max.clone() };
}

function intersects(a: Bounds, b: Bounds, tolerance = 0.02): boolean {
  return (
    a.min.x < b.max.x - tolerance &&
    a.max.x > b.min.x + tolerance &&
    a.min.y < b.max.y - tolerance &&
    a.max.y > b.min.y + tolerance &&
    a.min.z < b.max.z - tolerance &&
    a.max.z > b.min.z + tolerance
  );
}

function centerInsidePlan(component: ModelComponent, x: number, z: number): boolean {
  const bounds = boundsFor(component);
  return x > bounds.min.x && x < bounds.max.x && z > bounds.min.z && z < bounds.max.z;
}

function collisionLabels(a: ModelComponent, b: ModelComponent): string {
  return `${a.metadata.id} intersects ${b.metadata.id}`;
}

describe("rowhome collision checks", () => {
  it("keeps stair components clear of floor plates and roof deck", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const stairComponents = model.components.filter((component) =>
      /^(stair-(tread|riser|landing|guard|handrail)|basement-stair-(tread|riser|handrail))/.test(component.metadata.id)
    );
    const floorComponents = model.components.filter((component) => component.metadata.id.startsWith("floor-plate-"));
    const collisions: string[] = [];

    for (const stair of stairComponents) {
      const stairBounds = boundsFor(stair);
      for (const floor of floorComponents) {
        if (intersects(stairBounds, boundsFor(floor))) {
          collisions.push(collisionLabels(stair, floor));
        }
      }
    }

    expect(collisions).toEqual([]);
  });

  it("keeps the front spiral stair inside its floor openings", () => {
    const model = generateRowhome({ ...defaultRowhomeConfig, stairImplementation: "spiral", facadeStyleId: "bowed-front" });
    const stairComponents = model.components.filter((component) => /^spiral-stair-(pole|tread|landing)-/.test(component.metadata.id));
    const floorComponents = model.components.filter((component) => component.metadata.id.startsWith("floor-plate-"));
    const collisions: string[] = [];

    for (const stair of stairComponents) {
      const stairBounds = boundsFor(stair);
      for (const floor of floorComponents) {
        if (intersects(stairBounds, boundsFor(floor))) {
          collisions.push(collisionLabels(stair, floor));
        }
      }
    }

    expect(collisions).toEqual([]);
    expect(stairComponents.every((component) => {
      const bounds = boundsFor(component);
      return (
        bounds.min.x >= frontSpiralStairPlan.centerX - frontSpiralStairPlan.floorOpeningHalfFt - 0.02 &&
        bounds.max.x <= frontSpiralStairPlan.centerX + frontSpiralStairPlan.floorOpeningHalfFt + 0.02 &&
        bounds.min.z >= frontSpiralStairPlan.centerY - frontSpiralStairPlan.floorOpeningHalfFt - 0.02 &&
        bounds.max.z <= frontSpiralStairPlan.centerY + frontSpiralStairPlan.floorOpeningHalfFt + 0.02
      );
    })).toBe(true);
  });

  it("keeps facade wall segments out of door and window rough openings", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const frontWallPieces = model.components.filter((component) =>
      /^(front-facade|front-wall-(structural-backup|sheathing|weather-barrier|interior-gypsum|cavity-insulation))/.test(component.metadata.id)
    );
    const openings = [
      { label: "front door", x: defaultRowhomeConfig.buildingWidthFt / 2 - 0.4, z: 3.8 },
      { label: "first floor left window", x: 3.7, z: 5.25 },
      { label: "first floor right window", x: 14.2, z: 5.25 },
      { label: "second floor left window", x: 3.7, z: 15.25 },
      { label: "second floor right window", x: 14.2, z: 15.25 },
      { label: "third floor left window", x: 3.7, z: 25.25 },
      { label: "third floor right window", x: 14.2, z: 25.25 }
    ];
    const blocked = openings.flatMap((opening) =>
      frontWallPieces
        .filter((component) => centerInsidePlan(component, opening.x, opening.z))
        .map((component) => `${opening.label} blocked by ${component.metadata.id}`)
    );

    expect(blocked).toEqual([]);
  });

  it("keeps rear wall segments out of rear exit rough openings", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const rearWallPieces = model.components.filter((component) => /^(rear-wall|rear-wall-cavity-insulation)/.test(component.metadata.id));
    const openings = [
      { label: "first floor rear exit", x: defaultRowhomeConfig.buildingWidthFt / 2, z: 3.8 },
      { label: "second floor rear exit", x: defaultRowhomeConfig.buildingWidthFt / 2, z: 13.8 },
      { label: "third floor rear exit", x: defaultRowhomeConfig.buildingWidthFt / 2, z: 23.8 }
    ];
    const blocked = openings.flatMap((opening) =>
      rearWallPieces
        .filter((component) => centerInsidePlan(component, opening.x, opening.z))
        .map((component) => `${opening.label} blocked by ${component.metadata.id}`)
    );

    expect(blocked).toEqual([]);
  });

  it("keeps major interior fixtures from occupying the same volume", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const fixtureIds = [
      "living-room-couch",
      "living-room-coffee-table",
      "living-room-tv",
      "primary-bed",
      "second-bedroom-bed",
      "third-bedroom-bed",
      "kitchen-island",
      "electric-range",
      "refrigerator",
      "kitchen-sink",
      "electric-water-heater",
      "air-handler"
    ];
    const fixtures = fixtureIds
      .map((id) => model.components.find((component) => component.metadata.id === id))
      .filter((component): component is ModelComponent => Boolean(component));
    const collisions: string[] = [];

    for (let i = 0; i < fixtures.length; i += 1) {
      const first = fixtures[i];
      const firstBounds = boundsFor(first);
      for (let j = i + 1; j < fixtures.length; j += 1) {
        const second = fixtures[j];
        if (intersects(firstBounds, boundsFor(second), 0.04)) {
          collisions.push(collisionLabels(first, second));
        }
      }
    }

    expect(collisions).toEqual([]);
  });

  it("keeps exterior equipment clear of the building shell", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const condenser = model.components.find((component) => component.metadata.id === "heat-pump-condenser");
    const shell = model.components.filter((component) =>
      /^(party-wall-|rear-wall|front-facade|basement-(party-wall|front-foundation|rear-foundation))/.test(component.metadata.id)
    );
    const collisions = condenser
      ? shell.filter((component) => intersects(boundsFor(condenser), boundsFor(component), 0.04)).map((component) => collisionLabels(condenser, component))
      : ["missing heat-pump-condenser"];

    expect(collisions).toEqual([]);
  });

  it("keeps the fire escape clear of exterior HVAC equipment", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const exteriorEquipment = model.components.filter((component) => /^(heat-pump-condenser|condenser-pad)$/.test(component.metadata.id));
    const fireEscape = model.components.filter((component) => /^fire-escape-/.test(component.metadata.id));
    const collisions = exteriorEquipment.flatMap((equipment) =>
      fireEscape
        .filter((component) => intersects(boundsFor(equipment), boundsFor(component), 0.04))
        .map((component) => collisionLabels(equipment, component))
    );

    expect(collisions).toEqual([]);
  });
});
