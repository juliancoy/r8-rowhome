import { describe, expect, it } from "vitest";
import { defaultRowhomeConfig } from "../src/core/config";
import { occupantRoutes, routeById, sampleRoute } from "../src/viewer/occupantWalkthrough";

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
    expect(route.points.some((point) => point.x <= 3 && point.z <= 16)).toBe(true);
  });
});
