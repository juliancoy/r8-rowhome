import { Box3, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { defaultRowhomeConfig } from "../src/core/config";
import type { ModelComponent } from "../src/core/types";
import { generateRowhome } from "../src/generators/rowhome";
import { frontSpiralStairPlan } from "../src/generators/stairs";
import { collidesWithNavigation, navigationBoundsForComponents, nathanNavigationOptions, resolveNavigationMove } from "../src/viewer/navigation";

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

function planOverlapLength(a: Bounds, b: Bounds, axis: "x" | "z"): number {
  return Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]);
}

function center(bounds: Bounds): Vector3 {
  return bounds.min.clone().add(bounds.max).multiplyScalar(0.5);
}

describe("rowhome collision checks", () => {
  it("keeps Nathan from tunneling through house walls during fly movement", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const blockers = navigationBoundsForComponents(model.components);
    const leftPartyWall = blockers.find((blocker) => blocker.id === "party-wall-left");

    expect(leftPartyWall).toBeDefined();
    const start = new Vector3(
      leftPartyWall!.bounds.max.x + nathanNavigationOptions.radiusFt + 0.25,
      6.2,
      defaultRowhomeConfig.buildingDepthFt / 2
    );
    const attemptedOutsideMove = new Vector3(
      leftPartyWall!.bounds.min.x - nathanNavigationOptions.radiusFt - 2.5,
      start.y,
      start.z
    );

    const resolved = resolveNavigationMove(start, attemptedOutsideMove, blockers);

    expect(collidesWithNavigation(resolved, blockers)).toBe(false);
    expect(resolved.x).toBeGreaterThanOrEqual(leftPartyWall!.bounds.max.x + nathanNavigationOptions.radiusFt - 0.02);
  });

  it("unsticks Nathan from an invalid pose inside a wall instead of leaving him glitched", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const blockers = navigationBoundsForComponents(model.components);
    const leftPartyWall = blockers.find((blocker) => blocker.id === "party-wall-left");

    expect(leftPartyWall).toBeDefined();
    const wallCenter = leftPartyWall!.bounds.getCenter(new Vector3());
    const glitchedPose = new Vector3(wallCenter.x, 6.2, defaultRowhomeConfig.buildingDepthFt / 2);
    const desiredMove = glitchedPose.clone().add(new Vector3(0, 0, 1.0));

    const resolved = resolveNavigationMove(glitchedPose, desiredMove, blockers);

    expect(collidesWithNavigation(resolved, blockers)).toBe(false);
    expect(resolved.distanceTo(glitchedPose)).toBeGreaterThan(0.1);
  });

  it("keeps stair and fire escape components clear of wall and foundation geometry", () => {
    const configs = [
      defaultRowhomeConfig,
      { ...defaultRowhomeConfig, stairImplementation: "spiral" as const, facadeStyleId: "bowed-front" },
      { ...defaultRowhomeConfig, structuralSupportScheme: "steel-post-beam" as const }
    ];
    const collisions: string[] = [];

    for (const config of configs) {
      const model = generateRowhome(config);
      const stairComponents = model.components.filter((component) =>
        /^(stair-|basement-stair-|spiral-stair-|fire-escape-stair-|fire-escape-platform-)/.test(component.metadata.id)
        && !/wall-bracket$/.test(component.metadata.id)
      );
      const wallComponents = model.components.filter((component) =>
        /^(party-wall-|rear-wall|front-facade|front-wall-|basement-(party-wall|front-foundation|rear-foundation)|first-floor-partition|second-floor-(front|rear)-partition|third-floor-partition)/.test(component.metadata.id)
      );

      for (const stair of stairComponents) {
        const stairBounds = boundsFor(stair);
        for (const wall of wallComponents) {
          if (intersects(stairBounds, boundsFor(wall), 0.02)) {
            collisions.push(`${config.stairImplementation}/${config.facadeStyleId}/${config.structuralSupportScheme}: ${collisionLabels(stair, wall)}`);
          }
        }
      }
    }

    expect(collisions).toEqual([]);
  });

  it("provides continuous egress from each stair landing to the arrival floor plate", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const missingOrDisconnected: string[] = [];

    for (let floor = 1; floor <= defaultRowhomeConfig.stories; floor += 1) {
      const landing = model.components.find((component) => component.metadata.id === `stair-landing-${floor}`);
      const bridge = model.components.find((component) => component.metadata.id === `stair-egress-bridge-${floor}`);
      const floorPlate = model.components.find((component) => component.metadata.id === `floor-plate-${floor}-right`);

      if (!landing || !bridge || !floorPlate) {
        missingOrDisconnected.push(`missing landing, bridge, or arrival floor plate for stair ${floor}`);
        continue;
      }

      const landingBounds = boundsFor(landing);
      const bridgeBounds = boundsFor(bridge);
      const floorBounds = boundsFor(floorPlate);
      const isFlushWithLanding = Math.abs(bridgeBounds.min.x - landingBounds.max.x) <= 0.04;
      const reachesFloorPlate = Math.abs(bridgeBounds.max.x - floorBounds.min.x) <= 0.04;
      const overlapsLandingDepth = planOverlapLength(bridgeBounds, landingBounds, "z") >= 2.8;
      const overlapsFloorDepth = planOverlapLength(bridgeBounds, floorBounds, "z") >= 2.8;
      const sameElevationAsLanding = Math.abs(bridgeBounds.min.y - landingBounds.min.y) <= 0.02 && Math.abs(bridgeBounds.max.y - landingBounds.max.y) <= 0.02;
      const sameElevationAsFloor = Math.abs(bridgeBounds.min.y - floorBounds.min.y) <= 0.02 && Math.abs(bridgeBounds.max.y - floorBounds.max.y) <= 0.02;

      if (!isFlushWithLanding || !reachesFloorPlate || !overlapsLandingDepth || !overlapsFloorDepth || !sameElevationAsLanding || !sameElevationAsFloor) {
        missingOrDisconnected.push(`stair ${floor} landing is not continuously connected to floor-plate-${floor}-right`);
      }
    }

    expect(missingOrDisconnected).toEqual([]);
  });

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

  it("connects fire escape stair flights to supported platforms and yard landing", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const platform2 = model.components.find((component) => component.metadata.id === "fire-escape-platform-2");
    const platform3 = model.components.find((component) => component.metadata.id === "fire-escape-platform-3");
    const yardLanding = model.components.find((component) => component.metadata.id === "fire-escape-yard-landing");
    const unsupportedOrMisrouted: string[] = [];

    if (!platform2 || !platform3 || !yardLanding) {
      unsupportedOrMisrouted.push("missing fire escape platforms or yard landing");
    } else {
      const platform2Bounds = boundsFor(platform2);
      const platform3Bounds = boundsFor(platform3);
      const yardBounds = boundsFor(yardLanding);
      const switchback1 = model.components.find((component) => component.metadata.id === "fire-escape-switchback-landing-1");
      const switchback2 = model.components.find((component) => component.metadata.id === "fire-escape-switchback-landing-2");
      const flight1UpperFirst = model.components.find((component) => component.metadata.id === "fire-escape-stair-1-upper-tread-1");
      const flight1UpperLast = model.components.find((component) => component.metadata.id === "fire-escape-stair-1-upper-tread-8");
      const flight1LowerFirst = model.components.find((component) => component.metadata.id === "fire-escape-stair-1-lower-tread-1");
      const flight1LowerLast = model.components.find((component) => component.metadata.id === "fire-escape-stair-1-lower-tread-8");
      const flight2UpperFirst = model.components.find((component) => component.metadata.id === "fire-escape-stair-2-upper-tread-1");
      const flight2UpperLast = model.components.find((component) => component.metadata.id === "fire-escape-stair-2-upper-tread-8");
      const flight2LowerFirst = model.components.find((component) => component.metadata.id === "fire-escape-stair-2-lower-tread-1");
      const flight2LowerLast = model.components.find((component) => component.metadata.id === "fire-escape-stair-2-lower-tread-8");

      if (!switchback1 || !switchback2 || !flight1UpperFirst || !flight1UpperLast || !flight1LowerFirst || !flight1LowerLast || !flight2UpperFirst || !flight2UpperLast || !flight2LowerFirst || !flight2LowerLast) {
        unsupportedOrMisrouted.push("missing fire escape stair treads");
      } else {
        const switchback1Bounds = boundsFor(switchback1);
        const switchback2Bounds = boundsFor(switchback2);
        const flight1UpperFirstBounds = boundsFor(flight1UpperFirst);
        const flight1UpperLastBounds = boundsFor(flight1UpperLast);
        const flight1LowerFirstBounds = boundsFor(flight1LowerFirst);
        const flight1LowerLastBounds = boundsFor(flight1LowerLast);
        const flight2UpperFirstBounds = boundsFor(flight2UpperFirst);
        const flight2UpperLastBounds = boundsFor(flight2UpperLast);
        const flight2LowerFirstBounds = boundsFor(flight2LowerFirst);
        const flight2LowerLastBounds = boundsFor(flight2LowerLast);

        if (planOverlapLength(flight2UpperFirstBounds, platform3Bounds, "x") < 1.5 || planOverlapLength(flight2UpperFirstBounds, platform3Bounds, "z") < 0.2) {
          unsupportedOrMisrouted.push("upper fire escape flight does not start on the third-floor platform");
        }
        if (planOverlapLength(flight2UpperLastBounds, switchback2Bounds, "x") < 1.5 || planOverlapLength(flight2UpperLastBounds, switchback2Bounds, "z") < 0.2) {
          unsupportedOrMisrouted.push("upper fire escape flight does not land on the third-to-second switchback landing");
        }
        if (planOverlapLength(flight2LowerFirstBounds, switchback2Bounds, "x") < 1.5 || planOverlapLength(flight2LowerFirstBounds, switchback2Bounds, "z") < 0.2) {
          unsupportedOrMisrouted.push("lower half of upper fire escape flight does not start on the switchback landing");
        }
        if (planOverlapLength(flight2LowerLastBounds, platform2Bounds, "x") < 1.5 || planOverlapLength(flight2LowerLastBounds, platform2Bounds, "z") < 0.2) {
          unsupportedOrMisrouted.push("upper fire escape flight does not land on the second-floor platform");
        }
        if (center(flight2UpperLastBounds).z <= center(flight2UpperFirstBounds).z || center(flight2LowerLastBounds).z >= center(flight2LowerFirstBounds).z) {
          unsupportedOrMisrouted.push("upper fire escape switchback does not alternate outward then inward");
        }
        if (center(flight2UpperLastBounds).z - center(flight2UpperFirstBounds).z < 5.0 || center(flight2LowerFirstBounds).z - center(flight2LowerLastBounds).z < 5.0) {
          unsupportedOrMisrouted.push("upper fire escape half-flights do not have enough plan run");
        }
        if (planOverlapLength(flight1UpperFirstBounds, platform2Bounds, "x") < 1.5 || planOverlapLength(flight1UpperFirstBounds, platform2Bounds, "z") < 0.2) {
          unsupportedOrMisrouted.push("lower fire escape flight does not start on the second-floor platform");
        }
        if (planOverlapLength(flight1UpperLastBounds, switchback1Bounds, "x") < 1.5 || planOverlapLength(flight1UpperLastBounds, switchback1Bounds, "z") < 0.2) {
          unsupportedOrMisrouted.push("lower fire escape flight does not land on the second-to-yard switchback landing");
        }
        if (planOverlapLength(flight1LowerFirstBounds, switchback1Bounds, "x") < 1.5 || planOverlapLength(flight1LowerFirstBounds, switchback1Bounds, "z") < 0.2) {
          unsupportedOrMisrouted.push("lower half of lower fire escape flight does not start on the switchback landing");
        }
        if (planOverlapLength(flight1LowerLastBounds, yardBounds, "x") < 1.5 || planOverlapLength(flight1LowerLastBounds, yardBounds, "z") < 0.2) {
          unsupportedOrMisrouted.push("lower fire escape flight does not land on the yard landing");
        }
        if (center(flight1UpperLastBounds).z <= center(flight1UpperFirstBounds).z || center(flight1LowerLastBounds).z >= center(flight1LowerFirstBounds).z) {
          unsupportedOrMisrouted.push("lower fire escape switchback does not alternate outward then inward");
        }
        if (center(flight1UpperLastBounds).z - center(flight1UpperFirstBounds).z < 5.0 || center(flight1LowerFirstBounds).z - center(flight1LowerLastBounds).z < 5.0) {
          unsupportedOrMisrouted.push("lower fire escape half-flights do not have enough plan run");
        }
      }

      for (const id of ["fire-escape-platform-2", "fire-escape-platform-3", "fire-escape-switchback-landing-1", "fire-escape-switchback-landing-2"]) {
        const platform = model.components.find((component) => component.metadata.id === id);
        const posts = model.components.filter((component) => new RegExp(`^${id}-(front|rear)-(left|right)-post$`).test(component.metadata.id));
        if (!platform || posts.length !== 4) {
          unsupportedOrMisrouted.push(`${id} is missing four support posts`);
          continue;
        }
        const platformBounds = boundsFor(platform);
        for (const post of posts) {
          const postBounds = boundsFor(post);
          if (Math.abs(postBounds.max.y - platformBounds.min.y) > 0.04) {
            unsupportedOrMisrouted.push(`${post.metadata.id} does not bear up to ${id}`);
          }
        }
      }
    }

    expect(unsupportedOrMisrouted).toEqual([]);
  });
});
