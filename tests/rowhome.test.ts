import { describe, expect, it } from "vitest";
import { Mesh, type Material } from "three";
import { defaultRowhomeConfig } from "../src/core/config";
import { generateRowhome } from "../src/generators/rowhome";
import { buildBom, totalEstimatedCost } from "../src/export/bom";
import { exportComponentStl } from "../src/export/stl";
import { geometryTriangleCount } from "../src/geometry/component";
import { estimateFacadeMaterialCost, facadeMaterialOptions } from "../src/core/facadeMaterials";
import { facadeStyleOptions, selectedFacadeStyle } from "../src/core/facadeStyles";
import { componentMatchesViewMode, viewLayerOptions, type ViewMode } from "../src/viewer/layers";

describe("rowhome generator", () => {
  it("generates a default source-traced rowhome model", () => {
    const model = generateRowhome(defaultRowhomeConfig);

    expect(model.name).toContain("R-8");
    expect(model.units).toBe("feet");
    expect(model.components.length).toBeGreaterThan(20);
    expect(model.components.every((component) => component.metadata.source.length > 0)).toBe(true);
    expect(model.validation.some((message) => message.code === "professional_review_required")).toBe(true);
  });

  it("contains no gas-fitted components", () => {
    const model = generateRowhome(defaultRowhomeConfig);

    expect(model.validation.some((message) => message.code === "gas_component_present")).toBe(false);
    expect(model.components.some((component) => /gas/i.test(component.metadata.name))).toBe(false);
  });

  it("generates inspectable electrical and HVAC systems", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const ids = new Set(model.components.map((component) => component.metadata.id));

    expect(ids.has("electrical-panel")).toBe(true);
    expect(ids.has("main-feeder-run")).toBe(true);
    expect(ids.has("range-240v-circuit")).toBe(true);
    expect(ids.has("heat-pump-condenser")).toBe(true);
    expect(ids.has("air-handler")).toBe(true);
    expect(ids.has("bath-exhaust-duct")).toBe(true);
    expect(model.components.some((component) => component.metadata.category === "systems")).toBe(true);
    expect(model.components.some((component) => component.metadata.material.includes("duct"))).toBe(true);
  });

  it("includes explicit fire-resistance gypsum and insulation assemblies", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const ids = new Set(model.components.map((component) => component.metadata.id));

    expect(ids.has("party-wall-left-type-x-gypsum")).toBe(true);
    expect(ids.has("party-wall-right-type-x-gypsum")).toBe(true);
    expect(ids.has("party-wall-left-mineral-wool-fire-insulation")).toBe(true);
    expect(ids.has("front-wall-cavity-insulation")).toBe(true);
    expect(ids.has("rear-wall-cavity-insulation")).toBe(true);
    expect(ids.has("roof-insulation-and-air-barrier")).toBe(true);
    expect(ids.has("foundation-rim-joist-insulation")).toBe(true);
    expect(model.components.filter((component) => component.metadata.material.includes("Type X gypsum")).length).toBeGreaterThanOrEqual(5);
    expect(model.components.filter((component) => component.metadata.material.includes("fireblocking")).length).toBe(6);
    expect(model.components.some((component) => component.metadata.source.includes("part-ix-b-residential-energy-code"))).toBe(true);
  });

  it("generates a below-grade basement with foundation systems and access stairs", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const ids = new Set(model.components.map((component) => component.metadata.id));

    expect(defaultRowhomeConfig.includeBasement).toBe(true);
    expect(ids.has("basement-slab")).toBe(true);
    expect(ids.has("basement-party-wall-left")).toBe(true);
    expect(ids.has("basement-party-wall-right")).toBe(true);
    expect(ids.has("basement-front-foundation-wall")).toBe(true);
    expect(ids.has("basement-rear-foundation-wall")).toBe(true);
    expect(ids.has("basement-ceiling-underside")).toBe(true);
    expect(ids.has("basement-rear-waterproofing")).toBe(true);
    expect(ids.has("basement-rear-foundation-insulation")).toBe(true);
    expect(ids.has("basement-perimeter-drain")).toBe(true);
    expect(ids.has("basement-sump-pit")).toBe(true);
    expect(ids.has("electric-water-heater")).toBe(true);
    expect(ids.has("basement-stair-run")).toBe(true);
    expect(model.components.filter((component) => component.metadata.id.startsWith("basement-stair-tread-")).length).toBe(13);
  });

  it("generates rooms, stairs, furniture, and kitchen fixtures", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const ids = new Set(model.components.map((component) => component.metadata.id));

    expect(ids.has("stair-run-1")).toBe(true);
    expect(ids.has("stair-landing-1")).toBe(true);
    expect(ids.has("stair-tread-1-1")).toBe(true);
    expect(ids.has("stair-riser-1-1")).toBe(true);
    expect(ids.has("stair-handrail-left-1")).toBe(true);
    expect(ids.has("living-room-zone")).toBe(true);
    expect(ids.has("primary-bedroom-zone")).toBe(true);
    expect(ids.has("living-room-couch")).toBe(true);
    expect(ids.has("living-room-tv")).toBe(true);
    expect(ids.has("primary-bed")).toBe(true);
    expect(ids.has("kitchen-island")).toBe(true);
    expect(ids.has("electric-range")).toBe(true);
    expect(ids.has("refrigerator")).toBe(true);
    expect(ids.has("kitchen-sink")).toBe(true);
    expect(model.components.filter((component) => component.metadata.id.startsWith("stair-tread-")).length).toBe(48);
  });

  it("models wall assemblies with real material layers and depth", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const ids = new Set(model.components.map((component) => component.metadata.id));

    expect(model.components.find((component) => component.metadata.id === "party-wall-left")?.metadata.material).toContain("brick or CMU");
    expect(model.components.find((component) => component.metadata.id === "rear-wall")?.metadata.material).toContain("brick or CMU");
    expect(ids.has("front-wall-structural-backup")).toBe(true);
    expect(ids.has("front-wall-sheathing")).toBe(true);
    expect(ids.has("front-wall-weather-barrier")).toBe(true);
    expect(ids.has("front-wall-interior-gypsum")).toBe(true);
    expect(ids.has("first-floor-partition-front-gypsum")).toBe(true);
    expect(ids.has("first-floor-partition-rear-gypsum")).toBe(true);
    expect(model.components.find((component) => component.metadata.id === "first-floor-partition")?.metadata.material).toContain("2x4 wood stud");
  });

  it("alternates straight stair flight direction by floor", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const firstFlightStart = model.components.find((component) => component.metadata.id === "stair-tread-1-1")?.object as Mesh | undefined;
    const firstFlightEnd = model.components.find((component) => component.metadata.id === "stair-tread-1-16")?.object as Mesh | undefined;
    const secondFlightStart = model.components.find((component) => component.metadata.id === "stair-tread-2-1")?.object as Mesh | undefined;
    const secondFlightEnd = model.components.find((component) => component.metadata.id === "stair-tread-2-16")?.object as Mesh | undefined;

    expect(firstFlightStart?.position.z).toBeLessThan(firstFlightEnd?.position.z ?? 0);
    expect(secondFlightStart?.position.z).toBeGreaterThan(secondFlightEnd?.position.z ?? 0);
  });

  it("supports a spiral staircase implementation option", () => {
    const model = generateRowhome({ ...defaultRowhomeConfig, stairImplementation: "spiral" });
    const ids = new Set(model.components.map((component) => component.metadata.id));

    expect(ids.has("spiral-stair-pole-1")).toBe(true);
    expect(ids.has("spiral-stair-landing-1")).toBe(true);
    expect(ids.has("spiral-stair-tread-1-1")).toBe(true);
    expect(model.components.filter((component) => component.metadata.id.startsWith("spiral-stair-tread-")).length).toBe(54);
    expect(model.components.some((component) => component.metadata.material.includes("spiral stair"))).toBe(true);
  });

  it("classifies generated components into inspectable layer views", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const modes: ViewMode[] = ["electrical", "hvac", "wood-structure", "load-bearing", "envelope", "fire", "insulation", "interior", "site", "architecture"];

    expect(viewLayerOptions.map((option) => option.id)).toEqual([
      "all",
      "electrical",
      "hvac",
      "wood-structure",
      "load-bearing",
      "envelope",
      "fire",
      "insulation",
      "interior",
      "site",
      "architecture"
    ]);
    for (const mode of modes) {
      expect(model.components.some((component) => componentMatchesViewMode(component, mode)), mode).toBe(true);
    }
    expect(componentMatchesViewMode(model.components.find((component) => component.metadata.id === "electrical-panel")!, "electrical")).toBe(true);
    expect(componentMatchesViewMode(model.components.find((component) => component.metadata.id === "supply-trunk-1")!, "hvac")).toBe(true);
    expect(componentMatchesViewMode(model.components.find((component) => component.metadata.id === "floor-plate-1")!, "wood-structure")).toBe(true);
    expect(componentMatchesViewMode(model.components.find((component) => component.metadata.id === "party-wall-left")!, "load-bearing")).toBe(true);
    expect(componentMatchesViewMode(model.components.find((component) => component.metadata.id === "front-wall-weather-barrier")!, "envelope")).toBe(true);
    expect(componentMatchesViewMode(model.components.find((component) => component.metadata.id === "party-wall-left-type-x-gypsum")!, "fire")).toBe(true);
    expect(componentMatchesViewMode(model.components.find((component) => component.metadata.id === "roof-insulation-and-air-barrier")!, "insulation")).toBe(true);
  });

  it("builds BOM and estimated cost metadata", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const bom = buildBom(model);

    expect(bom.length).toBeGreaterThan(5);
    expect(totalEstimatedCost(model)).toBeGreaterThan(100000);
  });

  it("supports facade material options with cost estimates", () => {
    expect(facadeMaterialOptions.length).toBeGreaterThanOrEqual(5);
    for (const option of facadeMaterialOptions) {
      const cost = estimateFacadeMaterialCost(defaultRowhomeConfig, option);
      expect(cost).toBeGreaterThan(0);

      const model = generateRowhome({ ...defaultRowhomeConfig, facadeMaterialId: option.id });
      const facade = model.components.find((component) => component.metadata.id === "front-facade");
      const backup = model.components.find((component) => component.metadata.id === "front-wall-structural-backup");
      expect(facade?.metadata.material).toBe(option.material);
      expect(facade?.metadata.estimatedCostUsd).toBe(cost);
      expect(facade?.geometry?.boundingBox).toBeNull();
      facade?.geometry?.computeBoundingBox();
      const claddingDepth = (facade?.geometry?.boundingBox?.max.z ?? 0) - (facade?.geometry?.boundingBox?.min.z ?? 0);
      expect(claddingDepth).toBeCloseTo(option.claddingThicknessFt, 2);
      expect(backup?.metadata.material).toBe(option.backupMaterial);
    }
  });

  it("supports better-looking facade form options", () => {
    expect(facadeStyleOptions.map((option) => option.id)).toEqual(["flat-front", "bowed-front", "bay-front"]);

    const bowedModel = generateRowhome({ ...defaultRowhomeConfig, facadeStyleId: "bowed-front" });
    const bowedFacade = bowedModel.components.find((component) => component.metadata.id === "front-facade");
    expect(bowedFacade?.metadata.name).toContain("Curved bowed front");
    expect(bowedFacade?.geometry ? geometryTriangleCount(bowedFacade.geometry) : 0).toBeGreaterThan(12);

    const bayModel = generateRowhome({ ...defaultRowhomeConfig, facadeStyleId: "bay-front" });
    expect(bayModel.components.some((component) => component.metadata.id === "upper-box-bay")).toBe(true);

    const flatCost = estimateFacadeMaterialCost(defaultRowhomeConfig, facadeMaterialOptions[0], selectedFacadeStyle("flat-front"));
    const bowedCost = estimateFacadeMaterialCost(defaultRowhomeConfig, facadeMaterialOptions[0], selectedFacadeStyle("bowed-front"));
    expect(bowedCost).toBeGreaterThan(flatCost);
  });

  it("exports printable components to ASCII STL", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const component = model.components.find((item) => item.metadata.printable);
    expect(component).toBeDefined();

    const stl = exportComponentStl(component!);
    expect(stl.startsWith("solid exported")).toBe(true);
    expect(stl).toContain("facet normal");
  });

  it("produces geometry with triangles", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const triangles = model.components.reduce((sum, component) => {
      return sum + (component.geometry ? geometryTriangleCount(component.geometry) : 0);
    }, 0);

    expect(triangles).toBeGreaterThan(100);
  });

  it("uses see-through glass material for windows", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const windowComponent = model.components.find((component) => component.metadata.id.startsWith("front-window"));
    expect(windowComponent?.object).toBeInstanceOf(Mesh);
    const material = (windowComponent!.object as Mesh).material as Material;
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBeLessThan(1);
  });
});
