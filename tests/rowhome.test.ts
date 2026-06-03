import { describe, expect, it } from "vitest";
import { Box3, Group, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, type Material } from "three";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { defaultRowhomeConfig } from "../src/core/config";
import { generateRowhome } from "../src/generators/rowhome";
import { buildBom, totalEstimatedCost } from "../src/export/bom";
import { exportComponentStl } from "../src/export/stl";
import { geometryTriangleCount } from "../src/geometry/component";
import { estimateFacadeMaterialCost, facadeMaterialOptions } from "../src/core/facadeMaterials";
import { facadeStyleOptions, selectedFacadeStyle } from "../src/core/facadeStyles";
import { frontSpiralStairPlan } from "../src/generators/stairs";
import { createFrontDoorAssembly, createWindowAssemblies, isFrontDoorLeafComponent, setFrontDoorOpen, setWindowOpen } from "../src/viewer/door";
import { buildHouseLighting } from "../src/viewer/lighting";
import { componentMatchesViewMode, viewLayerOptions, type ViewMode } from "../src/viewer/layers";
import { syncRealProductModelVisibility } from "../src/viewer/productModels";
import { brickCountForRectangle } from "../src/generators/brickwork";

describe("rowhome generator", () => {
  it("generates a default source-traced rowhome model", () => {
    const model = generateRowhome(defaultRowhomeConfig);

    expect(model.name).toContain("R-8");
    expect(model.units).toBe("feet");
    expect(model.components.length).toBeGreaterThan(20);
    expect(model.components.every((component) => component.metadata.source.length > 0)).toBe(true);
    expect(model.validation.some((message) => message.code === "professional_review_required")).toBe(true);
    expect(model.components.some((component) => component.metadata.id === "front-sidewalk")).toBe(true);
    expect(model.components.some((component) => component.metadata.id === "front-roadway")).toBe(true);
    expect(model.components.some((component) => component.metadata.id === "side-roadway")).toBe(true);
    expect(model.components.some((component) => component.metadata.id === "side-sidewalk")).toBe(true);
    expect(model.components.filter((component) => component.metadata.id.startsWith("front-road-centerline-")).length).toBe(2);
    expect(model.components.filter((component) => component.metadata.id.startsWith("side-road-centerline-")).length).toBe(2);
    expect(model.components.filter((component) => component.metadata.id.startsWith("stop-sign-face-")).length).toBe(2);
    expect(model.components.filter((component) => component.metadata.id.startsWith("street-light-head-")).length).toBe(2);
    expect(model.components.filter((component) => component.metadata.id.startsWith("front-crosswalk-stripe-")).length).toBe(6);
    expect(model.components.filter((component) => component.metadata.id.startsWith("side-crosswalk-stripe-")).length).toBe(5);
  });

  it("keeps the public sidewalks outside the house footprint and brings the front walk to the lot line", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const frontSidewalk = model.components.find((component) => component.metadata.id === "front-sidewalk");
    const sideSidewalk = model.components.find((component) => component.metadata.id === "side-sidewalk");
    const leftPartyWall = model.components.find((component) => component.metadata.id === "party-wall-left");

    expect(frontSidewalk).toBeDefined();
    expect(sideSidewalk).toBeDefined();
    expect(leftPartyWall).toBeDefined();

    const sideSidewalkBounds = new Box3().setFromObject(sideSidewalk!.object);
    const leftPartyWallBounds = new Box3().setFromObject(leftPartyWall!.object);

    expect(frontSidewalk!.object.position.z + 7).toBeCloseTo(-5, 3);
    expect(sideSidewalkBounds.max.x).toBeLessThanOrEqual(leftPartyWallBounds.min.x + 0.01);
  });

  it("uses one continuous global street frontage for a multi-home row", () => {
    const model = generateRowhome({ ...defaultRowhomeConfig, rowhomeCount: 3 });
    const ids = model.components.map((component) => component.metadata.id);

    expect(ids.filter((id) => id === "front-sidewalk")).toHaveLength(1);
    expect(ids.filter((id) => id === "front-roadway")).toHaveLength(1);
    expect(ids.filter((id) => id === "side-roadway")).toHaveLength(1);
    expect(ids.filter((id) => id === "side-sidewalk")).toHaveLength(1);
    expect(ids.filter((id) => id.startsWith("unit-") && id.includes("front-sidewalk"))).toHaveLength(0);
    expect(ids.filter((id) => id.startsWith("unit-") && id.includes("side-roadway"))).toHaveLength(0);
    expect(ids.filter((id) => id.startsWith("unit-") && id.includes("side-sidewalk"))).toHaveLength(0);
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
    expect(ids.has("meter-socket")).toBe(true);
    expect(ids.has("service-disconnect")).toBe(true);
    expect(ids.has("electrical-panel-working-clearance")).toBe(true);
    expect(ids.has("breaker-main")).toBe(true);
    expect(ids.has("breaker-range-240v")).toBe(true);
    expect(ids.has("neutral-bus-bar")).toBe(true);
    expect(ids.has("equipment-grounding-bus-bar")).toBe(true);
    expect(ids.has("main-feeder-run")).toBe(true);
    expect(ids.has("range-240v-circuit")).toBe(true);
    expect(ids.has("junction-box-living-room")).toBe(true);
    expect(ids.has("switch-box-living-room")).toBe(true);
    expect(ids.has("receptacle-box-120v-1")).toBe(true);
    expect(ids.has("overhead-light-living-room")).toBe(true);
    expect(ids.has("overhead-light-kitchen")).toBe(true);
    expect(ids.has("floor-lamp-bulb")).toBe(true);
    expect(ids.has("air-handler-branch-circuit")).toBe(true);
    expect(ids.has("heat-pump-disconnect")).toBe(true);
    expect(ids.has("water-heater-branch-circuit")).toBe(true);
    expect(ids.has("heat-pump-condenser")).toBe(true);
    expect(ids.has("air-handler")).toBe(true);
    expect(ids.has("supply-plenum")).toBe(true);
    expect(ids.has("return-plenum")).toBe(true);
    expect(ids.has("supply-branch-front-1")).toBe(true);
    expect(ids.has("return-grille-zone-1")).toBe(true);
    expect(ids.has("bath-exhaust-duct")).toBe(true);
    expect(model.components.filter((component) => component.metadata.material.includes("LED")).length).toBeGreaterThanOrEqual(8);
    expect(model.components.some((component) => component.metadata.category === "systems")).toBe(true);
    expect(model.components.some((component) => component.metadata.material.includes("hollow"))).toBe(true);
  });

  it("models HVAC ducts as hollow connected flow segments for thermofluid analysis", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const ductComponents = model.components.filter((component) => component.object.userData.hvac?.hollow === true);
    const flowEdges = ductComponents.map((component) => component.object.userData.hvac as {
      hollow?: boolean;
      from?: string;
      to?: string;
      flowCfm?: number;
      hydraulicAreaSqFt?: number;
      innerWidthFt?: number;
      innerHeightFt?: number;
      wallThicknessFt?: number;
    });

    expect(ductComponents.length).toBeGreaterThanOrEqual(20);
    expect(flowEdges.every((edge) => edge.hollow === true)).toBe(true);
    expect(flowEdges.every((edge) => typeof edge.from === "string" && typeof edge.to === "string")).toBe(true);
    expect(flowEdges.every((edge) => (edge.flowCfm ?? 0) > 0)).toBe(true);
    expect(flowEdges.every((edge) => (edge.hydraulicAreaSqFt ?? 0) > 0)).toBe(true);
    expect(flowEdges.every((edge) => (edge.innerWidthFt ?? 0) > 0 && (edge.innerHeightFt ?? 0) > 0 && (edge.wallThicknessFt ?? 0) > 0)).toBe(true);
    expect(flowEdges.some((edge) => edge.from === "supply-plenum" && edge.to === "supply-trunk-1-end")).toBe(true);
    expect(flowEdges.some((edge) => edge.from === "range-hood" && edge.to === "rear-wall-exhaust-termination")).toBe(true);
    expect(ductComponents.some((component) => component.metadata.material.includes("low-leakage galvanized sheet-metal rectangular supply duct"))).toBe(true);
    expect(ductComponents.some((component) => component.metadata.material.includes("smooth-wall rigid metal range hood exhaust duct"))).toBe(true);
  });

  it("keeps the circuit breaker panel accessible on the first floor and connects standardized electrical parts", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const panel = model.components.find((component) => component.metadata.id === "electrical-panel")?.object as Mesh | undefined;
    const clearance = model.components.find((component) => component.metadata.id === "electrical-panel-working-clearance");
    const electricalParts = model.components.filter((component) => component.metadata.category === "electrical" && component.metadata.id !== "electrical-panel-working-clearance");

    expect(panel?.position.y).toBeGreaterThan(3.0);
    expect(panel?.position.y).toBeLessThan(defaultRowhomeConfig.storyHeightFt);
    expect(panel?.position.z).toBeLessThan(8.0);
    expect(clearance?.metadata.printable).toBe(false);
    expect(clearance?.metadata.source).toBe("sources/code-building-codes-part-iii-national-electrical-code-full.html");
    expect(electricalParts.every((component) => component.metadata.notes?.some((note) => /connected to|connected by/i.test(note)))).toBe(true);
  });

  it("generates rear exits and an exterior fire escape", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const ids = new Set(model.components.map((component) => component.metadata.id));

    expect(ids.has("rear-exit-door-1")).toBe(true);
    expect(ids.has("rear-exit-door-2")).toBe(true);
    expect(ids.has("rear-exit-door-3")).toBe(true);
    expect(ids.has("fire-escape-platform-2")).toBe(true);
    expect(ids.has("fire-escape-platform-3")).toBe(true);
    expect(ids.has("fire-escape-yard-landing")).toBe(true);
    expect(model.components.filter((component) => component.metadata.id.startsWith("fire-escape-stair-")).length).toBeGreaterThan(20);
    expect(model.components.find((component) => component.metadata.id === "rear-wall")?.metadata.material).toContain("segmented around rear exits");
  });

  it("creates runtime point lights from installed luminaires and window openings", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const lights = buildHouseLighting(model);
    const names = new Set(lights.children.map((light) => light.name));

    expect(names.has("overhead-light-living-room-point-light")).toBe(true);
    expect(names.has("overhead-light-kitchen-point-light")).toBe(true);
    expect(names.has("floor-lamp-point-light")).toBe(true);
    expect(names.has("front-window-left-1-daylight")).toBe(true);
    expect(lights.children.length).toBeGreaterThanOrEqual(16);
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

  it("includes a roof photovoltaic array clear of stair and roof service zones", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const panels = model.components.filter((component) => component.metadata.id.startsWith("roof-solar-panel-"));
    const racks = model.components.filter((component) => component.metadata.id.startsWith("roof-solar-rack-") || component.metadata.id.startsWith("roof-solar-rear-rack-"));
    const combiner = model.components.find((component) => component.metadata.id === "roof-solar-combiner");
    const raceway = model.components.find((component) => component.metadata.id === "roof-solar-dc-raceway");
    const buildingHeight = defaultRowhomeConfig.stories * defaultRowhomeConfig.storyHeightFt;

    expect(panels.length).toBe(9);
    expect(racks.length).toBe(18);
    expect(combiner?.metadata.material).toContain("photovoltaic");
    expect(raceway?.metadata.material).toContain("photovoltaic");
    for (const panel of panels) {
      panel.object.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(panel.object);
      expect(bounds.min.x).toBeGreaterThan(5.15);
      expect(bounds.max.x).toBeLessThan(defaultRowhomeConfig.buildingWidthFt - 1.0);
      expect(bounds.min.z).toBeGreaterThan(5.0);
      expect(bounds.max.z).toBeLessThan(25.5);
      expect(bounds.min.y).toBeGreaterThan(buildingHeight + 0.3);
    }
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
    const refrigerator = model.components.find((component) => component.metadata.id === "refrigerator");
    const fiddleLeafFig = model.components.find((component) => component.metadata.id === "living-room-fiddle-leaf-fig");
    const streetTree = model.components.find((component) => component.metadata.id === "street-tree-real-model-bounds");
    const waterHeater = model.components.find((component) => component.metadata.id === "electric-water-heater");

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
    expect(refrigerator?.metadata.realProductModel?.brand).toBe("IKEA");
    expect(refrigerator?.metadata.realProductModel?.articleNumber).toBe("305.876.26");
    expect(refrigerator?.metadata.realProductModel?.url).toBe("/models/ikea-lagan-30587626-refrigerator.glb");
    const refrigeratorModelPath = join(process.cwd(), "public/models/ikea-lagan-30587626-refrigerator.glb");
    expect(existsSync(refrigeratorModelPath)).toBe(true);
    expect(statSync(refrigeratorModelPath).size).toBeGreaterThan(1_000_000);
    expect(ids.has("living-room-fiddle-leaf-fig")).toBe(true);
    expect(fiddleLeafFig?.metadata.realProductModel?.brand).toBe("IKEA");
    expect(fiddleLeafFig?.metadata.realProductModel?.articleNumber).toBe("805.688.90");
    const plantModelPath = join(process.cwd(), "public/models/ikea-fejka-80568890-fiddle-leaf-fig.glb");
    expect(existsSync(plantModelPath)).toBe(true);
    expect(statSync(plantModelPath).size).toBeGreaterThan(100_000);
    expect(streetTree?.metadata.realProductModel?.license).toBe("CC0");
    expect(streetTree?.metadata.realProductModel?.hideComponentIds).toEqual(["street-tree-trunk", "street-tree-canopy"]);
    const localStreetTreeOverridePath = join(process.cwd(), "assets/Tree1.3ds");
    expect(existsSync(localStreetTreeOverridePath)).toBe(true);
    expect(statSync(localStreetTreeOverridePath).size).toBeGreaterThan(3_000_000);
    const streetTreeModelPath = join(process.cwd(), "public/models/cc0/tree_01_art.glb");
    expect(existsSync(streetTreeModelPath)).toBe(true);
    expect(statSync(streetTreeModelPath).size).toBeGreaterThan(900_000);
    expect(waterHeater?.metadata.notes?.some((note) => note.includes("Rheem ProTerra"))).toBe(true);
    expect(existsSync(join(process.cwd(), "public/draco/draco_decoder.wasm"))).toBe(true);
    expect(ids.has("kitchen-sink")).toBe(true);
    expect(model.components.filter((component) => component.metadata.id.startsWith("stair-tread-")).length).toBe(48);
  });

  it("keeps replacement product models visible after hiding their placeholders", () => {
    const placeholder = new Object3D();
    const hiddenFallback = new Object3D();
    const replacementRoot = new Group();
    const replacementMesh = new Object3D();
    replacementMesh.userData = { productModelFor: "street-tree-real-model-bounds" };
    replacementRoot.add(replacementMesh);

    const components = [
      {
        metadata: {
          id: "street-tree-real-model-bounds",
          name: "Street tree model bounds",
          category: "landscape" as const,
          material: "street tree visual asset placement bounds",
          source: "test",
          estimatedCostUsd: 0,
          printable: false
        },
        object: placeholder
      },
      {
        metadata: {
          id: "street-tree-canopy",
          name: "Street tree canopy",
          category: "landscape" as const,
          material: "urban tree canopy",
          source: "test",
          estimatedCostUsd: 0,
          printable: false
        },
        object: hiddenFallback
      }
    ];

    placeholder.userData.realProductTargetVisible = true;
    placeholder.userData.realProductReplaced = true;
    placeholder.visible = false;
    hiddenFallback.userData.realProductTargetVisible = false;
    hiddenFallback.userData.realProductReplaced = true;
    hiddenFallback.visible = false;

    syncRealProductModelVisibility(replacementRoot, components, "all", null);

    expect(replacementMesh.visible).toBe(true);
    expect(placeholder.visible).toBe(false);
    expect(hiddenFallback.visible).toBe(false);
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

  it("defaults to solid textured masonry walls while preserving the brick takeoff", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const brickComponents = model.components.filter((component) => component.metadata.quantity?.kind === "standard-brick" && component.metadata.id !== "brick-takeoff-summary");
    const summary = model.components.find((component) => component.metadata.id === "brick-takeoff-summary");

    expect(defaultRowhomeConfig.brickDetailMode).toBe("solid-textured");
    expect(brickComponents).toEqual([]);
    expect(summary?.metadata.quantity?.count).toBeGreaterThan(20_000);
    expect(summary?.metadata.quantity?.actualSizeIn).toEqual({ length: 7.625, width: 3.625, height: 2.25 });
    expect(summary?.metadata.quantity?.nominalModuleIn).toEqual({ length: 8, height: 2.625 });
  });

  it("scales solid wall brick textures to standard modular coursing", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const partyWall = model.components.find((component) => component.metadata.id === "party-wall-left")?.object as Mesh | undefined;
    const material = partyWall?.material as MeshStandardMaterial | undefined;

    expect(material?.map?.repeat.x).toBeCloseTo(defaultRowhomeConfig.buildingDepthFt / (8 / 12) / 4);
    expect(material?.map?.repeat.y).toBeCloseTo((defaultRowhomeConfig.stories * defaultRowhomeConfig.storyHeightFt) / (2.625 / 12) / 8);
  });

  it("can optionally place standard bricks as instanced units", () => {
    const model = generateRowhome({ ...defaultRowhomeConfig, brickDetailMode: "individual-bricks" });
    const brickComponents = model.components.filter((component) => component.metadata.quantity?.kind === "standard-brick" && component.metadata.id !== "brick-takeoff-summary");
    const summary = model.components.find((component) => component.metadata.id === "brick-takeoff-summary");
    const totalBricks = brickComponents.reduce((sum, component) => sum + (component.metadata.quantity?.count ?? 0), 0);

    expect(brickComponents.length).toBeGreaterThan(8);
    expect(brickComponents.every((component) => component.object instanceof InstancedMesh)).toBe(true);
    expect(brickComponents.every((component) => (component.object as InstancedMesh).count === component.metadata.quantity?.count)).toBe(true);
    expect(summary?.metadata.quantity?.count).toBe(totalBricks);
    expect(model.components.find((component) => component.metadata.id === "party-wall-left-standard-bricks")?.metadata.quantity?.count)
      .toBe(brickCountForRectangle(defaultRowhomeConfig.buildingDepthFt, defaultRowhomeConfig.stories * defaultRowhomeConfig.storyHeightFt) * 2);
    expect(brickComponents[0].metadata.quantity?.actualSizeIn).toEqual({ length: 7.625, width: 3.625, height: 2.25 });
    expect(brickComponents[0].metadata.quantity?.nominalModuleIn).toEqual({ length: 8, height: 2.625 });
  });

  it("assembles multiple rowhomes with shared party walls instead of duplicated side walls", () => {
    const rowhomeCount = 3;
    const model = generateRowhome({ ...defaultRowhomeConfig, rowhomeCount });
    const ids = new Set(model.components.map((component) => component.metadata.id));
    const summary = model.components.find((component) => component.metadata.id === "brick-takeoff-summary");
    const singleModel = generateRowhome(defaultRowhomeConfig);
    const singleSummary = singleModel.components.find((component) => component.metadata.id === "brick-takeoff-summary")?.metadata.quantity?.count ?? 0;
    const partyBoundaryBricks = brickCountForRectangle(
      defaultRowhomeConfig.buildingDepthFt,
      defaultRowhomeConfig.stories * defaultRowhomeConfig.storyHeightFt
    ) * 2;

    expect(model.name).toContain("3-Rowhome");
    expect(ids.has("row-left-party-wall")).toBe(true);
    expect(ids.has("shared-party-wall-1")).toBe(true);
    expect(ids.has("shared-party-wall-2")).toBe(true);
    expect(ids.has("row-right-party-wall")).toBe(true);
    expect([...ids].filter((id) => /^unit-\d-party-wall-(left|right)$/.test(id))).toEqual([]);
    expect([...ids].filter((id) => /^shared-party-wall-\d$/.test(id))).toHaveLength(rowhomeCount - 1);
    expect([...ids].filter((id) => /^unit-\d-front-facade$/.test(id))).toHaveLength(rowhomeCount);
    expect(summary?.metadata.quantity?.count).toBe((singleSummary - partyBoundaryBricks * 2) * rowhomeCount + partyBoundaryBricks * (rowhomeCount + 1));
    expect(model.structural?.gravityReport.roofAreaSqFt).toBe(defaultRowhomeConfig.buildingWidthFt * rowhomeCount * defaultRowhomeConfig.buildingDepthFt);
  });

  it("models Baltimore rowhouse door and window anatomy", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const ids = new Set(model.components.map((component) => component.metadata.id));

    expect(ids.has("front-door-top-rail")).toBe(true);
    expect(ids.has("front-door-lock-rail")).toBe(true);
    expect(ids.has("front-door-bottom-rail")).toBe(true);
    expect(ids.has("front-door-hanging-stile")).toBe(true);
    expect(ids.has("front-door-lock-stile")).toBe(true);
    expect(ids.has("front-door-upper-left-panel")).toBe(true);
    expect(ids.has("front-door-threshold")).toBe(true);
    expect(ids.has("front-door-knob")).toBe(true);
    expect(ids.has("transom-pane-1")).toBe(true);
    expect(ids.has("transom-vertical-muntin-1")).toBe(true);
    expect(ids.has("front-window-left-1-left-brick-mold")).toBe(true);
    expect(ids.has("front-window-left-1-left-jamb")).toBe(true);
    expect(ids.has("front-window-left-1-meeting-rail")).toBe(true);
    expect(ids.has("front-window-left-1-left-vertical-muntin")).toBe(true);
    expect(ids.has("front-window-left-1-horizontal-muntin-1")).toBe(true);
    expect(ids.has("front-window-left-1-left-insulation-return")).toBe(true);
    expect(model.components.find((component) => component.metadata.id === "front-door")?.metadata.source).toContain("baltimore-heritage-anatomy");
    expect(model.components.find((component) => component.metadata.id === "front-window-left-1")?.metadata.material).toContain("double-hung");
  });

  it("leaves actual wall openings behind the front door and windows", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const frontWallPieces = model.components.filter((component) =>
      /^(front-facade|front-wall-(structural-backup|sheathing|weather-barrier|interior-gypsum|cavity-insulation))/.test(component.metadata.id)
    );
    const openings = [
      { x: defaultRowhomeConfig.buildingWidthFt / 2 - 0.4, z: 3.8 },
      { x: 3.7, z: 5.25 },
      { x: 14.2, z: 5.25 },
      { x: 3.7, z: 15.25 },
      { x: 14.2, z: 15.25 }
    ];

    for (const opening of openings) {
      expect(frontWallPieces.some((component) => {
        component.geometry?.computeBoundingBox();
        const box = component.geometry?.boundingBox;
        if (!box) return false;
        const width = box.max.x - box.min.x;
        const height = box.max.y - box.min.y;
        const mesh = component.object as Mesh;
        return Math.abs(mesh.position.x - opening.x) < width / 2 && Math.abs(mesh.position.y - opening.z) < height / 2;
      })).toBe(false);
    }

    const door = model.components.find((component) => component.metadata.id === "front-door")?.object as Mesh | undefined;
    expect(door?.position.x).toBeCloseTo(defaultRowhomeConfig.buildingWidthFt / 2 - 0.4);
    expect(Math.abs(door?.rotation.y ?? 0)).toBeLessThan(0.1);
  });

  it("centers front window inserts within the wall depth instead of on the exterior trim plane", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const window = model.components.find((component) => component.metadata.id === "front-window-left-1")?.object as Mesh | undefined;
    const jamb = model.components.find((component) => component.metadata.id === "front-window-left-1-left-jamb")?.object as Mesh | undefined;
    const brickMold = model.components.find((component) => component.metadata.id === "front-window-left-1-left-brick-mold")?.object as Mesh | undefined;
    const insulationReturn = model.components.find((component) => component.metadata.id === "front-window-left-1-left-insulation-return")?.object as Mesh | undefined;

    expect(window?.position.z).toBeGreaterThan(-0.1);
    expect(window?.position.z).toBeLessThan(0.2);
    expect(jamb?.position.z).toBeCloseTo(window?.position.z ?? 0);
    expect(brickMold?.position.z).toBeLessThan(window?.position.z ?? 0);
    expect(insulationReturn?.position.z).toBeGreaterThan(-0.05);
    expect(insulationReturn?.position.z).toBeLessThan(0.3);
  });

  it("opens and closes all moving front door components as one hinged assembly", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const assembly = createFrontDoorAssembly(model.components);
    const movingDoorParts = model.components.filter((component) => isFrontDoorLeafComponent(component.metadata.id));
    const fixedJamb = model.components.find((component) => component.metadata.id === "front-door-left-jamb")?.object as Mesh | undefined;
    const originalPositions = new Map(movingDoorParts.map((component) => [component.metadata.id, component.object.position.clone()]));
    const originalQuaternions = new Map(movingDoorParts.map((component) => [component.metadata.id, component.object.quaternion.clone()]));
    const fixedJambPosition = fixedJamb?.position.clone();

    setFrontDoorOpen(assembly, true);

    expect(assembly.isOpen).toBe(true);
    expect(movingDoorParts.every((component) =>
      component.object.position.distanceTo(originalPositions.get(component.metadata.id)!) > 0.01
        || component.object.quaternion.angleTo(originalQuaternions.get(component.metadata.id)!) > 0.01
    )).toBe(true);
    expect(fixedJamb?.position.equals(fixedJambPosition!)).toBe(true);

    setFrontDoorOpen(assembly, false);

    expect(assembly.isOpen).toBe(false);
    expect(movingDoorParts.every((component) => component.object.position.distanceTo(originalPositions.get(component.metadata.id)!) < 0.001)).toBe(true);
  });

  it("opens and closes front window sash assemblies while fixed trim stays put", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const assemblies = createWindowAssemblies(model.components);
    const assembly = assemblies.find((item) => item.id === "front-window-left-1");
    const movingWindow = model.components.find((component) => component.metadata.id === "front-window-left-1")?.object as Mesh | undefined;
    const fixedJamb = model.components.find((component) => component.metadata.id === "front-window-left-1-left-jamb")?.object as Mesh | undefined;
    const originalWindowY = movingWindow?.position.y ?? 0;
    const fixedJambPosition = fixedJamb?.position.clone();

    expect(assembly).toBeTruthy();
    setWindowOpen(assembly!, true);

    expect(assembly?.isOpen).toBe(true);
    expect(movingWindow?.position.y).toBeGreaterThan(originalWindowY + 1);
    expect(fixedJamb?.position.equals(fixedJambPosition!)).toBe(true);

    setWindowOpen(assembly!, false);

    expect(assembly?.isOpen).toBe(false);
    expect(movingWindow?.position.y).toBeCloseTo(originalWindowY);
  });

  it("leaves pass-through openings in interior partition walls", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const ids = new Set(model.components.map((component) => component.metadata.id));

    expect(ids.has("first-floor-partition")).toBe(true);
    expect(ids.has("first-floor-partition-right")).toBe(true);
    expect(ids.has("first-floor-partition-header")).toBe(true);
    const leftCore = model.components.find((component) => component.metadata.id === "first-floor-partition")?.object as Mesh | undefined;
    const rightCore = model.components.find((component) => component.metadata.id === "first-floor-partition-right")?.object as Mesh | undefined;
    const leftBounds = leftCore ? new Box3().setFromObject(leftCore) : undefined;
    expect(leftCore?.position.x).toBeLessThan(defaultRowhomeConfig.buildingWidthFt / 2);
    expect(rightCore?.position.x).toBeGreaterThan(defaultRowhomeConfig.buildingWidthFt / 2);
    expect((leftBounds?.max.y ?? 0) - (leftBounds?.min.y ?? 0)).toBeCloseTo(defaultRowhomeConfig.storyHeightFt - 0.32, 3);
  });

  it("alternates straight stair flight direction by floor", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const firstFlightStart = model.components.find((component) => component.metadata.id === "stair-tread-1-1")?.object as Mesh | undefined;
    const firstFlightEnd = model.components.find((component) => component.metadata.id === "stair-tread-1-16")?.object as Mesh | undefined;
    const secondFlightStart = model.components.find((component) => component.metadata.id === "stair-tread-2-1")?.object as Mesh | undefined;
    const secondFlightEnd = model.components.find((component) => component.metadata.id === "stair-tread-2-16")?.object as Mesh | undefined;
    const firstRiser = model.components.find((component) => component.metadata.id === "stair-riser-1-1")?.object as Mesh | undefined;
    const secondRiser = model.components.find((component) => component.metadata.id === "stair-riser-2-1")?.object as Mesh | undefined;
    const firstLanding = model.components.find((component) => component.metadata.id === "stair-landing-1")?.object as Mesh | undefined;
    const secondLanding = model.components.find((component) => component.metadata.id === "stair-landing-2")?.object as Mesh | undefined;

    expect(firstFlightStart?.position.z).toBeLessThan(firstFlightEnd?.position.z ?? 0);
    expect(secondFlightStart?.position.z).toBeGreaterThan(secondFlightEnd?.position.z ?? 0);
    expect(firstRiser?.position.z).toBeLessThan(firstFlightStart?.position.z ?? 0);
    expect(secondRiser?.position.z).toBeGreaterThan(secondFlightStart?.position.z ?? 0);
    expect(firstLanding?.position.z).toBeGreaterThan(firstFlightEnd?.position.z ?? 0);
    expect(secondLanding?.position.z).toBeLessThan(secondFlightEnd?.position.z ?? 0);
  });

  it("leaves floor plate openings for the stairwell", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const stairwellPlanPoint = { x: 2.8, y: 22.0 };
    const floorPieces = model.components.filter((component) => component.metadata.id.startsWith("floor-plate-"));

    expect(floorPieces.length).toBeGreaterThan(defaultRowhomeConfig.stories + 1);
    for (const component of floorPieces) {
      component.geometry?.computeBoundingBox();
      const bounds = component.geometry?.boundingBox;
      const mesh = component.object as Mesh;
      if (!bounds) continue;
      const halfWidth = (bounds.max.x - bounds.min.x) / 2;
      const halfDepth = (bounds.max.z - bounds.min.z) / 2;
      expect(Math.abs(mesh.position.x - stairwellPlanPoint.x) < halfWidth && Math.abs(mesh.position.z - stairwellPlanPoint.y) < halfDepth).toBe(false);
    }
  });

  it("supports a spiral staircase implementation option", () => {
    const model = generateRowhome({ ...defaultRowhomeConfig, stairImplementation: "spiral", facadeStyleId: "bowed-front" });
    const ids = new Set(model.components.map((component) => component.metadata.id));
    const pole = model.components.find((component) => component.metadata.id === "spiral-stair-pole-1")?.object as Mesh | undefined;

    expect(ids.has("spiral-stair-pole-1")).toBe(true);
    expect(ids.has("spiral-stair-landing-1")).toBe(true);
    expect(ids.has("spiral-stair-tread-1-1")).toBe(true);
    expect(model.components.filter((component) => component.metadata.id.startsWith("spiral-stair-tread-")).length).toBe(54);
    expect(model.components.some((component) => component.metadata.material.includes("spiral stair"))).toBe(true);
    expect(model.components.find((component) => component.metadata.id === "spiral-stair-tread-1-1")?.metadata.source).toBe("sources/stairs/icc-irc-spiral-stairways-code-change-re-12-06-16.pdf");
    expect(pole?.position.x).toBeCloseTo(frontSpiralStairPlan.centerX);
    expect(pole?.position.z).toBeCloseTo(frontSpiralStairPlan.centerY);
  });

  it("classifies generated components into inspectable layer views", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const modes: ViewMode[] = ["electrical", "hvac", "plumbing", "wood-structure", "load-bearing", "structural-demand", "envelope", "fire", "insulation", "interior", "site", "architecture"];

    expect(viewLayerOptions.map((option) => option.id)).toEqual([
      "all",
      "electrical",
      "hvac",
      "plumbing",
      "wood-structure",
      "load-bearing",
      "structural-demand",
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
    expect(componentMatchesViewMode(model.components.find((component) => component.metadata.id === "water-service-lateral")!, "plumbing")).toBe(true);
    expect(componentMatchesViewMode(model.components.find((component) => component.metadata.id === "floor-plate-1")!, "wood-structure")).toBe(true);
    expect(componentMatchesViewMode(model.components.find((component) => component.metadata.id === "party-wall-left")!, "load-bearing")).toBe(true);
    expect(componentMatchesViewMode(model.components.find((component) => component.metadata.id === "front-wall-weather-barrier")!, "envelope")).toBe(true);
    expect(componentMatchesViewMode(model.components.find((component) => component.metadata.id === "party-wall-left-type-x-gypsum")!, "fire")).toBe(true);
    expect(componentMatchesViewMode(model.components.find((component) => component.metadata.id === "roof-insulation-and-air-barrier")!, "insulation")).toBe(true);
  });

  it("generates connected hollow plumbing components for supply, drainage, venting, storm, and condensate", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const ids = new Set(model.components.map((component) => component.metadata.id));
    const requiredIds = [
      "water-service-lateral",
      "backflow-to-cold-water-manifold",
      "cold-water-vertical-riser",
      "hot-water-vertical-riser",
      "soil-stack",
      "vent-stack-through-roof",
      "roof-drain-leader",
      "air-handler-condensate-drain",
      "bath-1-toilet",
      "main-water-shutoff",
      "domestic-backflow-preventer"
    ];

    for (const id of requiredIds) {
      expect(ids.has(id)).toBe(true);
    }

    const plumbingPipes = model.components.filter((component) => component.object.userData.plumbing?.hollow === true);
    expect(plumbingPipes.length).toBeGreaterThanOrEqual(30);
    for (const pipe of plumbingPipes) {
      const plumbing = pipe.object.userData.plumbing;
      expect(plumbing.from).toBeTruthy();
      expect(plumbing.to).toBeTruthy();
      expect(plumbing.innerAreaSqFt).toBeGreaterThan(0);
      expect(plumbing.innerDiameterFt).toBeGreaterThan(0);
      expect(pipe.metadata.source).toBe("sources/code-building-codes-part-vi-international-plumbing-code-full.html");
    }
  });

  it("builds BOM and estimated cost metadata", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const bom = buildBom(model);

    expect(bom.length).toBeGreaterThan(5);
    expect(totalEstimatedCost(model)).toBeGreaterThan(100000);
    expect(bom
      .filter((line) => line.material === "standard modular brick takeoff")
      .reduce((sum, line) => sum + (line.quantity?.count ?? 0), 0)
    ).toBeGreaterThan(20_000);
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

  it("uses renderer-portable texture maps for opaque material variation", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const facadeComponent = model.components.find((component) => component.metadata.id === "front-facade");
    expect(facadeComponent?.object).toBeInstanceOf(Mesh);
    const material = (facadeComponent!.object as Mesh).material;
    expect(material).toBeInstanceOf(MeshStandardMaterial);
    expect((material as MeshStandardMaterial).map).toBeTruthy();
    expect((material as MeshStandardMaterial).bumpMap).toBeTruthy();
    expect((material as MeshStandardMaterial).onBeforeCompile.toString()).not.toContain("surfaceVariationIntensity");
  });

  it("gives generated textured geometries UV coordinates for WebGPU", () => {
    const model = generateRowhome({ ...defaultRowhomeConfig, facadeStyleId: "bowed-front" });
    const texturedComponents = model.components.filter((component) => {
      const material = (component.object as Mesh).material;
      return material instanceof MeshStandardMaterial && Boolean(material.map);
    });

    expect(texturedComponents.length).toBeGreaterThan(20);
    for (const component of texturedComponents) {
      expect(component.geometry?.getAttribute("uv"), component.metadata.id).toBeTruthy();
    }
  });
});
