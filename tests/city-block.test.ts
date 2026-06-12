import { describe, expect, it } from "vitest";
import { InstancedMesh } from "three";
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

  it("instances every non-detailed home as massing with zero cost", () => {
    const config = { ...defaultRowhomeConfig, urbanScale: "district-128" as const };
    const model = generateRowhome(config);
    const shells = model.components.find((component) => component.metadata.id === "city-block-massing-shells");
    expect(shells).toBeDefined();
    expect(shells?.object).toBeInstanceOf(InstancedMesh);
    expect((shells?.object as InstancedMesh).count).toBe(128 - config.rowhomeCount);
    const solar = model.components.find((component) => component.metadata.id === "city-block-massing-solar");
    expect((solar?.object as InstancedMesh).count).toBe(128 - config.rowhomeCount);
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

  it("keeps per-home cost basis unchanged by massing", () => {
    const single = generateRowhome(defaultRowhomeConfig);
    const district = generateRowhome({ ...defaultRowhomeConfig, urbanScale: "district-128" as const });
    const cost = (model: typeof single) => Math.round(model.components.reduce((sum, component) => sum + component.metadata.estimatedCostUsd, 0));
    expect(cost(district)).toBe(cost(single));
  });
});
