import { describe, expect, it } from "vitest";
import { InstancedMesh, Matrix4 } from "three";
import { defaultRowhomeConfig } from "../src/core/config";
import { generateRowhome } from "../src/generators/rowhome";
import { cityBlockLayout, homePlacements } from "../src/generators/cityBlock";

describe("city block instancing", () => {
  it("adds no massing at single scale", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    expect(model.components.some((component) => component.metadata.id.startsWith("city-block-"))).toBe(false);
  });

  it("arranges 32 homes into one block of two back-to-back rows of sixteen", () => {
    const config = { ...defaultRowhomeConfig, urbanScale: "block-32" as const };
    const layout = cityBlockLayout(config);
    expect(layout?.totalHomes).toBe(32);
    expect(layout?.blocks).toBe(1);
    const placements = homePlacements(config);
    expect(placements).toHaveLength(32);
    expect(placements.filter((placement) => placement.flipped)).toHaveLength(16);
    expect(new Set(placements.map((placement) => placement.y)).size).toBe(2);
  });

  it("multiplies to 128 homes across four blocks on a street grid", () => {
    const config = { ...defaultRowhomeConfig, urbanScale: "district-128" as const };
    const layout = cityBlockLayout(config);
    expect(layout?.totalHomes).toBe(128);
    expect(layout?.blocks).toBe(4);
    const placements = homePlacements(config);
    expect(placements).toHaveLength(128);
    const xValues = placements.map((placement) => placement.x);
    const yValues = placements.map((placement) => placement.y);
    // 2x2 block grid: extents span two block widths/depths plus a street.
    expect(Math.max(...xValues) - Math.min(...xValues)).toBeGreaterThan(layout!.blockWidthFt);
    expect(Math.max(...yValues) - Math.min(...yValues)).toBeGreaterThan(layout!.blockDepthFt);
  });

  it("instances every visible city-block home from the same zero-cost massing kit", () => {
    const config = { ...defaultRowhomeConfig, urbanScale: "district-128" as const };
    const model = generateRowhome(config);
    const shells = model.components.find((component) => component.metadata.id === "city-block-massing-shells");
    expect(shells).toBeDefined();
    expect(shells?.object).toBeInstanceOf(InstancedMesh);
    expect((shells?.object as InstancedMesh).count).toBe(128);
    const solar = model.components.find((component) => component.metadata.id === "city-block-massing-solar");
    expect((solar?.object as InstancedMesh).count).toBe(128);
    expect(shells?.metadata.estimatedCostUsd).toBe(0);
    expect(shells?.metadata.printable).toBe(false);
  });

  it("puts a parcel on every block", () => {
    const district = generateRowhome({ ...defaultRowhomeConfig, urbanScale: "district-128" as const });
    const parcels = district.components.filter((component) => component.metadata.id.startsWith("city-block-parcel-"));
    expect(parcels).toHaveLength(4);
    expect(parcels.every((parcel) => parcel.metadata.notes?.some((note) => note.includes("investor dashboard")))).toBe(true);

    const block = generateRowhome({ ...defaultRowhomeConfig, urbanScale: "block-32" as const });
    expect(block.components.filter((component) => component.metadata.id.startsWith("city-block-parcel-"))).toHaveLength(1);
  });

  it("adds legible city-block context instead of bare massing bars", () => {
    const config = { ...defaultRowhomeConfig, urbanScale: "block-32" as const };
    const model = generateRowhome(config);
    const requiredContext = [
      "city-block-ground-plane",
      "city-block-front-street-1",
      "city-block-back-street-1",
      "city-block-left-street-1",
      "city-block-right-street-1",
      "city-block-crosswalk-1-front-left",
      "city-block-rear-alley-1",
      "city-block-front-sidewalk-1",
      "city-block-back-sidewalk-1",
      "city-block-stoops",
      "city-block-front-doors",
      "city-block-window-frames",
      "city-block-window-rhythm",
      "city-block-side-walls",
      "city-block-rear-doors",
      "city-block-rear-window-frames",
      "city-block-rear-window-rhythm",
      "city-block-parapet-caps",
      "city-block-cornice-bands",
      "city-block-street-tree-canopies",
      "city-block-street-light-posts",
      "city-block-scale-person-torsos",
      "city-block-hvac-condensers",
      "city-block-hvac-disconnects",
      "city-block-electrical-meter-sockets",
      "city-block-electrical-service-masts",
      "city-block-fire-escape-platforms",
      "city-block-fire-escape-rails",
      "city-block-fire-escape-ladders"
    ];
    for (const id of requiredContext) {
      expect(model.components.some((component) => component.metadata.id === id)).toBe(true);
    }

    const windows = model.components.find((component) => component.metadata.id === "city-block-window-rhythm");
    expect((windows?.object as InstancedMesh).count).toBe(32 * config.stories * 2);
    const windowFrames = model.components.find((component) => component.metadata.id === "city-block-window-frames");
    expect((windowFrames?.object as InstancedMesh).count).toBe(32 * config.stories * 2);
    const stoops = model.components.find((component) => component.metadata.id === "city-block-stoops");
    expect((stoops?.object as InstancedMesh).count).toBe(32);
    const treeCanopies = model.components.find((component) => component.metadata.id === "city-block-street-tree-canopies");
    expect((treeCanopies?.object as InstancedMesh).count).toBe(32);
    const lightPosts = model.components.find((component) => component.metadata.id === "city-block-street-light-posts");
    expect((lightPosts?.object as InstancedMesh).count).toBe(32);
    const sideWalls = model.components.find((component) => component.metadata.id === "city-block-side-walls");
    expect((sideWalls?.object as InstancedMesh).count).toBe(64);
    const rearWindows = model.components.find((component) => component.metadata.id === "city-block-rear-window-rhythm");
    expect((rearWindows?.object as InstancedMesh).count).toBe(32 * config.stories * 2);
    const rearWindowFrames = model.components.find((component) => component.metadata.id === "city-block-rear-window-frames");
    expect((rearWindowFrames?.object as InstancedMesh).count).toBe(32 * config.stories * 2);
    const hvacCondensers = model.components.find((component) => component.metadata.id === "city-block-hvac-condensers");
    expect((hvacCondensers?.object as InstancedMesh).count).toBe(32);
    const electricalMeters = model.components.find((component) => component.metadata.id === "city-block-electrical-meter-sockets");
    expect((electricalMeters?.object as InstancedMesh).count).toBe(32);
    const fireEscapePlatforms = model.components.find((component) => component.metadata.id === "city-block-fire-escape-platforms");
    expect((fireEscapePlatforms?.object as InstancedMesh).count).toBe(32 * (config.stories - 1));
    const fireEscapeLadders = model.components.find((component) => component.metadata.id === "city-block-fire-escape-ladders");
    expect((fireEscapeLadders?.object as InstancedMesh).count).toBe(32);
  });

  it("instances dummy scale people with the city-block houses", () => {
    const config = { ...defaultRowhomeConfig, urbanScale: "block-32" as const };
    const model = generateRowhome(config);
    const torso = model.components.find((component) => component.metadata.id === "city-block-scale-person-torsos");
    const head = model.components.find((component) => component.metadata.id === "city-block-scale-person-heads");
    const legs = model.components.find((component) => component.metadata.id === "city-block-scale-person-legs");

    expect(torso?.object).toBeInstanceOf(InstancedMesh);
    expect(head?.object).toBeInstanceOf(InstancedMesh);
    expect(legs?.object).toBeInstanceOf(InstancedMesh);
    expect((torso?.object as InstancedMesh).count).toBe(32);
    expect((head?.object as InstancedMesh).count).toBe((torso?.object as InstancedMesh).count);
    expect((legs?.object as InstancedMesh).count).toBe((torso?.object as InstancedMesh).count * 2);
    expect(torso?.metadata.estimatedCostUsd).toBe(0);
    expect(torso?.metadata.printable).toBe(false);
  });

  it("hides the detailed unit in urban-scale views so every visible house uses the same instanced kit", () => {
    const model = generateRowhome({ ...defaultRowhomeConfig, urbanScale: "block-32" as const });
    const detailedVisible = model.components.filter((component) =>
      !component.metadata.id.startsWith("city-block-") && component.object.visible !== false
    );

    expect(detailedVisible).toHaveLength(0);
    expect(model.components.find((component) => component.metadata.id === "front-facade")?.object.userData.forceHiddenInUrbanScale).toBe(true);
    expect(model.components.find((component) => component.metadata.id === "front-window-left-1")?.object.userData.forceHiddenInUrbanScale).toBe(true);
    expect(model.components.find((component) => component.metadata.id === "stoop")?.object.userData.forceHiddenInUrbanScale).toBe(true);
    expect(model.components.find((component) => component.metadata.id === "city-block-massing-shells")?.object.visible).toBe(true);
  });

  it("carries complete hierarchical ownership for every replicated house", () => {
    const config = { ...defaultRowhomeConfig, urbanScale: "block-32" as const };
    const model = generateRowhome(config);
    const hierarchy = model.hierarchy;
    expect(hierarchy?.mode).toBe("urban-block");
    expect(hierarchy?.buildingInstances).toHaveLength(32);

    const firstComponentIds = hierarchy!.buildingInstances[0].componentIds;
    expect(firstComponentIds).toContain("city-block-massing-shells");
    expect(firstComponentIds).toContain("city-block-front-doors");
    expect(firstComponentIds).toContain("city-block-window-frames");
    expect(firstComponentIds).toContain("city-block-window-rhythm");
    expect(firstComponentIds).toContain("city-block-side-walls");
    expect(firstComponentIds).toContain("city-block-rear-doors");
    expect(firstComponentIds).toContain("city-block-rear-window-frames");
    expect(firstComponentIds).toContain("city-block-rear-window-rhythm");
    expect(firstComponentIds).toContain("city-block-massing-solar");
    expect(firstComponentIds).toContain("city-block-scale-person-torsos");
    expect(firstComponentIds).toContain("city-block-hvac-condensers");
    expect(firstComponentIds).toContain("city-block-hvac-disconnects");
    expect(firstComponentIds).toContain("city-block-electrical-meter-sockets");
    expect(firstComponentIds).toContain("city-block-electrical-service-masts");
    expect(firstComponentIds).toContain("city-block-fire-escape-platforms");
    expect(firstComponentIds).toContain("city-block-fire-escape-rails");
    expect(firstComponentIds).toContain("city-block-fire-escape-ladders");
    expect(hierarchy!.buildingInstances.every((instance) => instance.componentIds.join("|") === firstComponentIds.join("|"))).toBe(true);
    expect(hierarchy!.hiddenDetailedComponentIds).toContain("front-facade");

    const perHouseComponents = model.components.filter((component) => component.metadata.ownership?.scope === "urban-building-instances");
    expect(perHouseComponents.length).toBeGreaterThan(10);
    expect(perHouseComponents.every((component) => component.metadata.ownership?.buildingInstanceIds?.length === 32)).toBe(true);
    expect(perHouseComponents.every((component) =>
      component.metadata.ownership?.buildingInstanceIds?.[0] === hierarchy!.buildingInstances[0].id
    )).toBe(true);
  });

  it("uses the project coordinate convention for urban-scale instanced shells", () => {
    const config = { ...defaultRowhomeConfig, urbanScale: "block-32" as const };
    const model = generateRowhome(config);
    const shells = model.components.find((component) => component.metadata.id === "city-block-massing-shells")?.object as InstancedMesh;
    const matrix = new Matrix4();
    shells.getMatrixAt(0, matrix);
    const values = matrix.elements;
    expect(values[0]).toBeCloseTo(1);
    expect(values[5]).toBeCloseTo(1);
    expect(values[10]).toBeCloseTo(1);
    expect(values[13]).toBeCloseTo((config.stories * config.storyHeightFt) / 2);
    expect(values[14]).toBeCloseTo(config.buildingDepthFt / 2);
  });

  it("keeps per-home cost basis unchanged by massing", () => {
    const single = generateRowhome(defaultRowhomeConfig);
    const district = generateRowhome({ ...defaultRowhomeConfig, urbanScale: "district-128" as const });
    const cost = (model: typeof single) => Math.round(model.components.reduce((sum, component) => sum + component.metadata.estimatedCostUsd, 0));
    expect(cost(district)).toBe(cost(single));
  });
});
