import { describe, expect, it } from "vitest";
import { defaultRowhomeConfig } from "../src/core/config";
import { exportModelMetadataJson } from "../src/export/json";
import { generateRowhome } from "../src/generators/rowhome";
import { buildStructuralGravityReport } from "../src/reports/structuralGravity";
import { buildStructuralModel } from "../src/structure/gravity";
import { structuralDemandColor } from "../src/viewer/structuralOverlay";

describe("conceptual structural gravity model", () => {
  it("builds a source-traced structural schema with supports and gravity loads", () => {
    const structural = buildStructuralModel(defaultRowhomeConfig);

    expect(structural.status).toBe("conceptual-load-model");
    expect(structural.units).toBe("feet-kips");
    expect(structural.nodes.length).toBeGreaterThan(20);
    expect(structural.members.some((member) => member.kind === "floor-diaphragm")).toBe(true);
    expect(structural.members.some((member) => member.kind === "roof-diaphragm")).toBe(true);
    expect(structural.members.some((member) => member.kind === "stair-opening-header")).toBe(true);
    expect(structural.members.some((member) => member.kind === "stair-shaft-post")).toBe(true);
    expect(structural.members.some((member) => member.kind === "diaphragm-collector")).toBe(true);
    expect(structural.members.some((member) => member.kind === "bearing-pad")).toBe(true);
    expect(structural.supports).toHaveLength(8);
    expect(structural.supports.every((support) => support.restraint.z)).toBe(true);
    expect(structural.loadCases.map((loadCase) => loadCase.id)).toEqual(["dead", "floor-live", "roof-live"]);
    expect(structural.areaLoads.length).toBe(defaultRowhomeConfig.stories * 2 + 3);
    expect(structural.areaLoads.every((load) => load.totalKips > 0 && load.source.length > 0)).toBe(true);
    expect(structural.areaLoads.some((load) => load.id === "roof-garden-saturated-dead" && load.loadPsf === 35)).toBe(true);
    expect(structural.demandSurfaces.length).toBeGreaterThan(defaultRowhomeConfig.stories + 1 + defaultRowhomeConfig.stories * 4);
    expect(structural.demandSurfaces.every((surface) => surface.intensity >= 0 && surface.intensity <= 1)).toBe(true);
    expect(structural.demandSurfaces.some((surface) => surface.kind === "roof-area" && surface.demandKips > 0)).toBe(true);
    const floorDemandSurfaces = structural.demandSurfaces.filter((surface) => surface.kind === "floor-area");
    expect(floorDemandSurfaces.length).toBe(defaultRowhomeConfig.stories);
    expect(Math.max(...floorDemandSurfaces.map((surface) => surface.intensity))).toBeGreaterThan(0);
    const leftPartyWallByElevation = structural.demandSurfaces
      .filter((surface) => surface.id.startsWith("left-party-wall-demand-continuous-"))
      .sort((a, b) => a.bounds.zMinFt - b.bounds.zMinFt);
    expect(leftPartyWallByElevation.length).toBeGreaterThan(defaultRowhomeConfig.stories * 4);
    expect(leftPartyWallByElevation.every((surface, index, surfaces) =>
      index === 0 || surface.bounds.zMinFt <= surfaces[index - 1].bounds.zMinFt + defaultRowhomeConfig.storyHeightFt / 5 + 0.001
    )).toBe(true);
    const bottomLeftPartyWall = leftPartyWallByElevation.filter((surface) => surface.bounds.zMaxFt <= defaultRowhomeConfig.storyHeightFt);
    const topLeftPartyWall = leftPartyWallByElevation.filter((surface) => surface.bounds.zMinFt >= (defaultRowhomeConfig.stories - 1) * defaultRowhomeConfig.storyHeightFt);
    expect(bottomLeftPartyWall.length).toBeGreaterThan(1);
    expect(topLeftPartyWall.length).toBeGreaterThan(1);
    expect(Math.max(...bottomLeftPartyWall.map((surface) => surface.demandPsf))).toBeGreaterThan(Math.max(...topLeftPartyWall.map((surface) => surface.demandPsf)));
    expect(Math.max(...bottomLeftPartyWall.map((surface) => surface.intensity))).toBeGreaterThan(Math.max(...topLeftPartyWall.map((surface) => surface.intensity)));
    expect(structural.loadCombinations.some((combination) => combination.id === "strength-floor-live" && combination.totalKips > structural.gravityReport.totalDeadLoadKips)).toBe(true);
    expect(structural.loadCombinations.some((combination) => combination.status === "blocked-requires-lateral-model")).toBe(true);
    expect(structural.designChecks.some((check) => check.id === "foundation-bearing" && check.status === "blocked-requires-design-input")).toBe(true);
    expect(structural.designChecks.some((check) => check.id === "stair-opening-load-path" && check.targetIds.length > 0)).toBe(true);
    expect(structural.designChecks.some((check) => check.id === "diaphragm-collector-continuity" && check.targetIds.length > 0)).toBe(true);
    expect(structural.designChecks.some((check) => check.id === "guard-attachment-loads")).toBe(true);
    expect(structural.designChecks.some((check) => check.id === "roof-curb-uplift-waterproofing")).toBe(true);
    expect(structural.solverStatus.readyForSolver).toBe(false);
  });

  it("reports gravity load totals without claiming solved member design", () => {
    const structural = buildStructuralModel(defaultRowhomeConfig);

    expect(structural.gravityReport.floorAreaSqFt).toBeCloseTo(2217.9, 1);
    expect(structural.gravityReport.roofAreaSqFt).toBe(864);
    expect(structural.gravityReport.wallDeadLoadKips).toBeGreaterThan(60);
    expect(structural.gravityReport.steelSupportDeadLoadKips).toBe(0);
    expect(structural.gravityReport.floorDeadLoadKips).toBeGreaterThan(30);
    expect(structural.gravityReport.floorLiveLoadKips).toBeGreaterThan(80);
    expect(structural.gravityReport.roofDeadLoadKips).toBeGreaterThan(15);
    expect(structural.gravityReport.roofLiveLoadKips).toBeGreaterThan(17);
    expect(structural.gravityReport.totalDeadLoadKips).toBeGreaterThan(structural.gravityReport.totalLiveLoadKips * 0.5);
    expect(structural.gravityReport.totalGravityLoadKips).toBeCloseTo(
      structural.gravityReport.totalDeadLoadKips + structural.gravityReport.totalLiveLoadKips,
      3
    );
    expect(structural.warnings.some((warning) => warning.includes("No stiffness matrix"))).toBe(true);
  });

  it("attaches structural data to the generated rowhome and metadata export", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const exported = JSON.parse(exportModelMetadataJson(model)) as {
      structural?: { status?: string; gravityReport?: { totalGravityLoadKips?: number } };
      permitReadiness?: { status?: string; buildability?: { blockerCount?: number } };
      validation?: Array<{ code: string }>;
    };

    expect(model.structural?.gravityReport.totalGravityLoadKips).toBeGreaterThan(100);
    expect(model.validation.some((message) => message.code === "conceptual_structural_model_only")).toBe(true);
    expect(exported.structural?.status).toBe("conceptual-load-model");
    expect(exported.structural?.gravityReport?.totalGravityLoadKips).toBe(model.structural?.gravityReport.totalGravityLoadKips);
    expect(exported.permitReadiness?.status).toBe("not-buildable");
    expect(exported.permitReadiness?.buildability?.blockerCount).toBeGreaterThan(0);
  });

  it("adds schematic steel support members when the steel support option is selected", () => {
    const model = generateRowhome({ ...defaultRowhomeConfig, structuralSupportScheme: "steel-post-beam" });
    const ids = new Set(model.components.map((component) => component.metadata.id));
    const structural = model.structural;

    expect(ids.has("steel-column-front-left")).toBe(true);
    expect(ids.has("steel-beam-front-level-1")).toBe(true);
    expect(ids.has("steel-girder-right-level-3")).toBe(true);
    expect(structural?.materials.some((material) => material.id === "structural-steel")).toBe(true);
    expect(structural?.members.some((member) => member.kind === "steel-column")).toBe(true);
    expect(structural?.members.some((member) => member.kind === "steel-beam")).toBe(true);
    expect(structural?.supports.length).toBe(12);
    expect(structural?.gravityReport.steelSupportDeadLoadKips).toBeGreaterThan(0);
    expect(structural?.assumptions.some((assumption) => assumption.includes("Steel support option"))).toBe(true);
    expect(structural?.designChecks.some((check) => check.id === "steel-column-buckling")).toBe(true);
    expect(structural?.designChecks.some((check) => check.id === "steel-connections")).toBe(true);
  });

  it("leaves steel support members out of the default masonry-bearing layout", () => {
    const model = generateRowhome(defaultRowhomeConfig);

    expect(model.components.some((component) => component.metadata.id.startsWith("steel-column-"))).toBe(false);
    expect(model.structural?.members.some((member) => member.kind === "steel-column")).toBe(false);
  });

  it("builds a headless structural gravity report without writing artifacts", () => {
    const report = buildStructuralGravityReport("test-generated-at");

    expect(report.generatedAt).toBe("test-generated-at");
    expect(report.checks.hasSupports).toBe(true);
    expect(report.checks.hasDeadAndLiveLoads).toBe(true);
    expect(report.checks.allLoadsPositive).toBe(true);
    expect(report.checks.exposesConceptualWarnings).toBe(true);
    expect(report.checks.hasDemandHeatMapSurfaces).toBe(true);
    expect(report.checks.hasLoadCombinations).toBe(true);
    expect(report.checks.hasRequiredDesignChecks).toBe(true);
    expect(report.gravityReport.totalGravityLoadKips).toBeGreaterThan(100);
  });

  it("maps demand intensity to a blue-to-red professional heat scale", () => {
    expect(structuralDemandColor(0).getHexString()).toBe("1f78d1");
    expect(structuralDemandColor(0.5).getHexString()).toBe("f2d45a");
    expect(structuralDemandColor(1).getHexString()).toBe("d7191c");
  });

  describe("steel + concrete construction system", () => {
    const steelConcreteConfig = { ...defaultRowhomeConfig, constructionSystem: "steel-concrete" as const };

    it("switches structural members to concrete walls and composite deck floors", () => {
      const structural = buildStructuralModel(steelConcreteConfig);

      expect(structural.members.filter((member) => member.kind === "wall-line").every((member) => member.materialId === "reinforced-concrete")).toBe(true);
      expect(
        structural.members
          .filter((member) => member.kind === "floor-diaphragm" || member.kind === "roof-diaphragm")
          .every((member) => member.materialId === "concrete-metal-deck")
      ).toBe(true);
      expect(structural.members.filter((member) => member.kind === "stair-opening-header").every((member) => member.materialId === "structural-steel")).toBe(true);
      expect(structural.materials.some((material) => material.id === "concrete-metal-deck" && material.densityPcf === 145)).toBe(true);
    });

    it("always includes the steel frame, its supports, and steel design checks", () => {
      const structural = buildStructuralModel(steelConcreteConfig);

      expect(structural.members.some((member) => member.kind === "steel-column")).toBe(true);
      expect(structural.members.some((member) => member.kind === "steel-beam")).toBe(true);
      expect(structural.supports.length).toBe(12);
      expect(structural.gravityReport.steelSupportDeadLoadKips).toBeGreaterThan(0);
      expect(structural.designChecks.some((check) => check.id === "steel-column-buckling")).toBe(true);
      expect(structural.designChecks.some((check) => check.id === "steel-fire-protection")).toBe(true);
    });

    it("carries heavier concrete dead loads than the masonry-wood baseline", () => {
      const masonryWood = buildStructuralModel(defaultRowhomeConfig);
      const steelConcrete = buildStructuralModel(steelConcreteConfig);

      expect(steelConcrete.gravityReport.floorDeadLoadKips).toBeGreaterThan(masonryWood.gravityReport.floorDeadLoadKips * 2);
      expect(steelConcrete.gravityReport.roofDeadLoadKips).toBeGreaterThan(masonryWood.gravityReport.roofDeadLoadKips);
      expect(steelConcrete.gravityReport.wallDeadLoadKips).toBeGreaterThan(masonryWood.gravityReport.wallDeadLoadKips);
      expect(steelConcrete.gravityReport.totalGravityLoadKips).toBeGreaterThan(masonryWood.gravityReport.totalGravityLoadKips);
      expect(steelConcrete.assumptions.some((assumption) => assumption.includes("Steel frame + concrete"))).toBe(true);
    });

    it("generates concrete walls, composite slabs, steel frame, and no brick takeoff", () => {
      const model = generateRowhome(steelConcreteConfig);

      const partyWall = model.components.find((component) => component.metadata.id === "party-wall-left");
      expect(partyWall?.metadata.material).toContain("reinforced concrete party wall");
      const rearWall = model.components.find((component) => component.metadata.id === "rear-wall");
      expect(rearWall?.metadata.material).toContain("reinforced concrete rear wall");
      const floorPlate = model.components.find((component) => component.metadata.id === "floor-plate-1");
      expect(floorPlate?.metadata.material).toContain("concrete slab on steel metal deck");
      const roofPlate = model.components.find((component) => component.metadata.id === `floor-plate-${steelConcreteConfig.stories}`);
      expect(roofPlate?.metadata.material).toContain("concrete roof slab on steel metal deck");
      expect(model.components.some((component) => component.metadata.id.startsWith("steel-column-"))).toBe(true);
      expect(model.components.some((component) => component.metadata.id === "party-wall-left-standard-bricks")).toBe(false);
      expect(model.components.some((component) => component.metadata.id === "rear-wall-standard-bricks")).toBe(false);
      const partition = model.components.find((component) => component.metadata.material.includes("steel stud partition"));
      expect(partition).toBeDefined();
      expect(model.validation.filter((message) => message.severity === "error")).toHaveLength(0);
    });

    it("keeps the brick takeoff and wood framing in the masonry-wood baseline", () => {
      const masonryModel = generateRowhome(defaultRowhomeConfig);
      const steelConcreteModel = generateRowhome(steelConcreteConfig);

      const masonryBricks = masonryModel.components.find((component) => component.metadata.id === "brick-takeoff-summary")?.metadata.quantity?.count ?? 0;
      const steelConcreteBricks = steelConcreteModel.components.find((component) => component.metadata.id === "brick-takeoff-summary")?.metadata.quantity?.count ?? 0;
      expect(masonryBricks).toBeGreaterThan(0);
      expect(steelConcreteBricks).toBeLessThan(masonryBricks);
      const floorPlate = masonryModel.components.find((component) => component.metadata.id === "floor-plate-1");
      expect(floorPlate?.metadata.material).toContain("engineered wood framing");
    });

    it("supports steel-concrete row assemblies with shared concrete party walls", () => {
      const model = generateRowhome({ ...steelConcreteConfig, rowhomeCount: 3 });

      const sharedWall = model.components.find((component) => component.metadata.id === "shared-party-wall-1");
      expect(sharedWall?.metadata.material).toContain("reinforced concrete party wall");
      expect(model.components.some((component) => component.metadata.id.endsWith("-standard-bricks") && component.metadata.id.includes("party-wall"))).toBe(false);
      expect(model.validation.filter((message) => message.severity === "error")).toHaveLength(0);
    });
  });
});
