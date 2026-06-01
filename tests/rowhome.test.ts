import { describe, expect, it } from "vitest";
import { Mesh, type Material } from "three";
import { defaultRowhomeConfig } from "../src/core/config";
import { generateRowhome } from "../src/generators/rowhome";
import { buildBom, totalEstimatedCost } from "../src/export/bom";
import { exportComponentStl } from "../src/export/stl";
import { geometryTriangleCount } from "../src/geometry/component";
import { estimateFacadeMaterialCost, facadeMaterialOptions } from "../src/core/facadeMaterials";
import { facadeStyleOptions, selectedFacadeStyle } from "../src/core/facadeStyles";
import { frontSpiralStairPlan } from "../src/generators/stairs";
import { createFrontDoorAssembly, isFrontDoorLeafComponent, setFrontDoorOpen } from "../src/viewer/door";
import { buildHouseLighting } from "../src/viewer/lighting";
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

  it("leaves pass-through openings in interior partition walls", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const ids = new Set(model.components.map((component) => component.metadata.id));

    expect(ids.has("first-floor-partition")).toBe(true);
    expect(ids.has("first-floor-partition-right")).toBe(true);
    expect(ids.has("first-floor-partition-header")).toBe(true);
    const leftCore = model.components.find((component) => component.metadata.id === "first-floor-partition")?.object as Mesh | undefined;
    const rightCore = model.components.find((component) => component.metadata.id === "first-floor-partition-right")?.object as Mesh | undefined;
    expect(leftCore?.position.x).toBeLessThan(defaultRowhomeConfig.buildingWidthFt / 2);
    expect(rightCore?.position.x).toBeGreaterThan(defaultRowhomeConfig.buildingWidthFt / 2);
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
