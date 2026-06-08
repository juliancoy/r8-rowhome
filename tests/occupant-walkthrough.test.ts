import { describe, expect, it } from "vitest";
import { Box3, Vector3 } from "three";
import { defaultRowhomeConfig } from "../src/core/config";
import { generateRowhome } from "../src/generators/rowhome";
import { makeBoxComponent } from "../src/geometry/component";
import {
  clampFollowCameraToSameSideOfWalls,
  createOccupantAvatar,
  type OccupantRoute,
  occupantRoutes,
  routeById,
  sampleRoute,
  updateOccupantAvatar,
  walkableSurfaceHeight
} from "../src/viewer/occupantWalkthrough";

describe("browser occupant walkthrough routes", () => {
  it("provides named browser routes through normal house use", () => {
    const routes = occupantRoutes(defaultRowhomeConfig);
    const ids = routes.map((route) => route.id);

    expect(ids).toEqual(["daily-use", "stairs-and-bedrooms", "roof-garden", "egress"]);
    expect(routes.every((route) => route.points.length >= 6)).toBe(true);
  });

  it("samples routes at person-height positions and loops by distance", () => {
    const route = routeById(defaultRowhomeConfig, "daily-use");
    const first = sampleRoute(route, 0, 4.2);
    const later = sampleRoute(route, 5, 4.2);

    expect(first.position.y).toBeCloseTo(1.25);
    expect(later.position.y).toBeCloseTo(1.25);
    expect(later.position.distanceTo(first.position)).toBeGreaterThan(1);
    expect(first.progress).toBeGreaterThanOrEqual(0);
    expect(later.progress).toBeLessThanOrEqual(1);
  });

  it("routes the roof garden walkthrough on the roof level", () => {
    const route = routeById(defaultRowhomeConfig, "roof-garden");
    const roofY = defaultRowhomeConfig.stories * defaultRowhomeConfig.storyHeightFt + 0.8;

    expect(route.points.some((point) => point.y === roofY)).toBe(true);
    expect(route.points.some((point) => point.x >= 5.5 && point.z >= 29)).toBe(true);
  });

  it("derives walkable surfaces from person-height route points", () => {
    expect(walkableSurfaceHeight(defaultRowhomeConfig, sampleRoute(routeById(defaultRowhomeConfig, "daily-use"), 0, 4.2).position)).toBeCloseTo(0);
    expect(routeById(defaultRowhomeConfig, "stairs-and-bedrooms").points.some((point) =>
      walkableSurfaceHeight(defaultRowhomeConfig, point) > 0 && walkableSurfaceHeight(defaultRowhomeConfig, point) < defaultRowhomeConfig.storyHeightFt
    )).toBe(true);
    const roofPoint = routeById(defaultRowhomeConfig, "roof-garden").points.find((point) => point.y === defaultRowhomeConfig.stories * defaultRowhomeConfig.storyHeightFt + 0.8);
    expect(roofPoint).toBeDefined();
    expect(walkableSurfaceHeight(defaultRowhomeConfig, roofPoint!)).toBeCloseTo(defaultRowhomeConfig.stories * defaultRowhomeConfig.storyHeightFt + 0.16);
  });

  it("clamps the follow camera to the occupant side of blocking walls", () => {
    const wall = makeBoxComponent(
      {
        id: "camera-test-wall",
        name: "Camera blocking wall",
        category: "structure",
        material: "solid gypsum partition wall",
        source: "test",
        estimatedCostUsd: 0,
        printable: true
      },
      "#ffffff",
      8,
      0.35,
      8,
      { x: 8, y: 0, z: 5 }
    );
    const focus = new Vector3(8, 3.2, -2);
    const desiredCamera = new Vector3(8, 6.2, 3.5);
    const clamped = clampFollowCameraToSameSideOfWalls(focus, desiredCamera, [wall]);

    expect(clamped.z).toBeLessThan(-0.45);
    expect(clamped.distanceTo(focus)).toBeGreaterThan(1.1);
    expect(clamped.distanceTo(desiredCamera)).toBeGreaterThan(2.5);
  });

  it("leaves the closer follow camera target unchanged when no wall blocks the sight line", () => {
    const focus = new Vector3(8, 3.2, 10);
    const desiredCamera = new Vector3(8, 6.2, 4.2);
    const clamped = clampFollowCameraToSameSideOfWalls(focus, desiredCamera, []);

    expect(clamped.distanceTo(desiredCamera)).toBeLessThan(0.001);
    expect(clamped.distanceTo(focus)).toBeLessThan(6.6);
  });

  it("keeps the physics-driven avatar feet on the active walking surface", () => {
    const avatar = createOccupantAvatar();
    const state = {
      enabled: true,
      paused: true,
      routeId: "daily-use" as const,
      elapsedSeconds: 0,
      speedFtPerSecond: 4.2,
      followCamera: false
    };

    updateOccupantAvatar(avatar, routeById(defaultRowhomeConfig, "daily-use"), state, 1 / 60, defaultRowhomeConfig);

    const bounds = new Box3().setFromObject(avatar);
    expect(bounds.min.y).toBeCloseTo(0, 2);
    expect(avatar.userData.occupantPhysics.grounded).toBe(true);
  });

  it("uses Cannon wall colliders instead of teleporting through solid components", () => {
    const avatar = createOccupantAvatar();
    const wall = makeBoxComponent(
      {
        id: "test-wall",
        name: "Test wall",
        category: "structure",
        material: "solid gypsum wall",
        source: "test",
        estimatedCostUsd: 0,
        printable: true
      },
      "#ffffff",
      2,
      0.2,
      4,
      { x: 8, y: 0, z: 2 }
    );
    const route: OccupantRoute = {
      id: "daily-use",
      label: "Wall collision",
      points: [new Vector3(8, 1.25, -2), new Vector3(8, 1.25, 2)]
    };
    const state = {
      enabled: true,
      paused: false,
      routeId: "daily-use" as const,
      elapsedSeconds: 0,
      speedFtPerSecond: 8,
      followCamera: false
    };

    for (let i = 0; i < 120; i += 1) {
      updateOccupantAvatar(avatar, route, state, 1 / 60, defaultRowhomeConfig, [wall]);
    }

    expect(avatar.position.z).toBeLessThan(-0.4);
  });

  it("keeps the goal planner on stairs for floor changes instead of flying between floors", () => {
    const route = routeById(defaultRowhomeConfig, "stairs-and-bedrooms");
    const climbingPoints = route.points.filter((point) => point.x >= 1 && point.x <= 5.4 && point.z >= 17 && point.z <= 34.8);
    const maxVerticalJump = route.points.reduce((max, point, index) => {
      if (index === 0) return max;
      return Math.max(max, Math.abs(point.y - route.points[index - 1].y));
    }, 0);

    expect(climbingPoints.length).toBeGreaterThan(20);
    expect(maxVerticalJump).toBeLessThanOrEqual(1.25);
  });

  it("does not let a route target make the avatar fly through a floor away from the stairwell", () => {
    const avatar = createOccupantAvatar();
    const route: OccupantRoute = {
      id: "daily-use",
      label: "Bad vertical jump",
      points: [new Vector3(9, 1.25, 8), new Vector3(9, defaultRowhomeConfig.storyHeightFt + 1.25, 8)]
    };
    const state = {
      enabled: true,
      paused: false,
      routeId: "daily-use" as const,
      elapsedSeconds: 0,
      speedFtPerSecond: 8,
      followCamera: false
    };

    for (let i = 0; i < 60; i += 1) {
      updateOccupantAvatar(avatar, route, state, 1 / 60, defaultRowhomeConfig, []);
    }

    expect(avatar.position.y).toBeLessThan(2.0);
  });

  it("collides with overhead roof and ceiling components", () => {
    const avatar = createOccupantAvatar();
    const ceiling = makeBoxComponent(
      {
        id: "test-ceiling-type-x-gypsum",
        name: "Test ceiling",
        category: "structure",
        material: "5/8 in Type X gypsum ceiling board",
        source: "test",
        estimatedCostUsd: 0,
        printable: true
      },
      "#ffffff",
      8,
      8,
      0.2,
      { x: 8, y: 8, z: 3.4 }
    );
    const route: OccupantRoute = {
      id: "daily-use",
      label: "Ceiling collision",
      points: [new Vector3(8, 1.25, 8), new Vector3(8, 6.25, 8)]
    };
    const state = {
      enabled: true,
      paused: false,
      routeId: "daily-use" as const,
      elapsedSeconds: 0,
      speedFtPerSecond: 8,
      followCamera: false
    };

    for (let i = 0; i < 240; i += 1) {
      updateOccupantAvatar(avatar, route, state, 1 / 60, defaultRowhomeConfig, [ceiling]);
    }

    expect(avatar.position.y).toBeLessThan(2.2);
  });

  it("treats beds and other furniture as occupant collision obstacles", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const avatar = createOccupantAvatar();
    const route: OccupantRoute = {
      id: "daily-use",
      label: "Bed collision",
      points: [
        new Vector3(11, defaultRowhomeConfig.storyHeightFt + 1.25, 2),
        new Vector3(11, defaultRowhomeConfig.storyHeightFt + 1.25, 12)
      ]
    };
    const state = {
      enabled: true,
      paused: false,
      routeId: "daily-use" as const,
      elapsedSeconds: 0,
      speedFtPerSecond: 8,
      followCamera: false
    };

    for (let i = 0; i < 150; i += 1) {
      updateOccupantAvatar(avatar, route, state, 1 / 60, defaultRowhomeConfig, model.components);
    }

    expect(avatar.position.z).toBeLessThan(4.8);
  });
});
