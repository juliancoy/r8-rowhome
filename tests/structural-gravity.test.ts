import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultRowhomeConfig } from "../src/core/config";
import { exportModelMetadataJson } from "../src/export/json";
import { generateRowhome } from "../src/generators/rowhome";
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
    expect(structural.supports).toHaveLength(4);
    expect(structural.supports.every((support) => support.restraint.z)).toBe(true);
    expect(structural.loadCases.map((loadCase) => loadCase.id)).toEqual(["dead", "floor-live", "roof-live"]);
    expect(structural.areaLoads.length).toBe(defaultRowhomeConfig.stories * 2 + 2);
    expect(structural.areaLoads.every((load) => load.totalKips > 0 && load.source.length > 0)).toBe(true);
    expect(structural.demandSurfaces.length).toBe(defaultRowhomeConfig.stories + 1 + defaultRowhomeConfig.stories * 4);
    expect(structural.demandSurfaces.every((surface) => surface.intensity >= 0 && surface.intensity <= 1)).toBe(true);
    expect(structural.demandSurfaces.some((surface) => surface.kind === "roof-area" && surface.intensity === 0)).toBe(true);
    const floorDemandSurfaces = structural.demandSurfaces.filter((surface) => surface.kind === "floor-area");
    expect(floorDemandSurfaces.length).toBe(defaultRowhomeConfig.stories);
    expect(Math.max(...floorDemandSurfaces.map((surface) => surface.intensity))).toBeGreaterThan(0);
    const leftPartyWallByStory = structural.demandSurfaces
      .filter((surface) => surface.id.startsWith("left-party-wall-demand-story-"))
      .sort((a, b) => a.bounds.zMinFt - b.bounds.zMinFt);
    expect(leftPartyWallByStory).toHaveLength(defaultRowhomeConfig.stories);
    expect(leftPartyWallByStory[0].demandKips).toBeGreaterThan(leftPartyWallByStory[leftPartyWallByStory.length - 1].demandKips);
    expect(leftPartyWallByStory[0].intensity).toBeGreaterThan(leftPartyWallByStory[leftPartyWallByStory.length - 1].intensity);
    expect(leftPartyWallByStory[0].intensity).toBeGreaterThan(Math.max(...floorDemandSurfaces.map((surface) => surface.intensity)));
    expect(structural.loadCombinations.some((combination) => combination.id === "strength-floor-live" && combination.totalKips > structural.gravityReport.totalDeadLoadKips)).toBe(true);
    expect(structural.loadCombinations.some((combination) => combination.status === "blocked-requires-lateral-model")).toBe(true);
    expect(structural.designChecks.some((check) => check.id === "foundation-bearing" && check.status === "blocked-requires-design-input")).toBe(true);
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
      validation?: Array<{ code: string }>;
    };

    expect(model.structural?.gravityReport.totalGravityLoadKips).toBeGreaterThan(100);
    expect(model.validation.some((message) => message.code === "conceptual_structural_model_only")).toBe(true);
    expect(exported.structural?.status).toBe("conceptual-load-model");
    expect(exported.structural?.gravityReport?.totalGravityLoadKips).toBe(model.structural?.gravityReport.totalGravityLoadKips);
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
    expect(structural?.supports.length).toBe(8);
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

  it("writes a headless structural gravity report artifact", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const structural = model.structural;
    if (!structural) {
      throw new Error("Missing structural model");
    }
    const report = {
      generatedAt: new Date().toISOString(),
      purpose: "Headless CI structural gravity preflight report. The website renderer does not run stiffness solves or engineering design.",
      status: structural.status,
      counts: {
        nodes: structural.nodes.length,
        members: structural.members.length,
        supports: structural.supports.length,
        areaLoads: structural.areaLoads.length
      },
      gravityReport: structural.gravityReport,
      checks: {
        hasSupports: structural.supports.length > 0,
        hasDeadAndLiveLoads: structural.loadCases.some((loadCase) => loadCase.category === "dead") && structural.loadCases.some((loadCase) => loadCase.category === "live"),
        allLoadsPositive: structural.areaLoads.every((load) => load.areaSqFt > 0 && load.loadPsf > 0 && load.totalKips > 0),
        exposesConceptualWarnings: structural.warnings.length > 0,
        hasDemandHeatMapSurfaces: structural.demandSurfaces.length > 0,
        hasLoadCombinations: structural.loadCombinations.length > 0,
        hasRequiredDesignChecks: structural.designChecks.length > 0
      },
      assumptions: structural.assumptions,
      warnings: structural.warnings,
      loadCombinations: structural.loadCombinations,
      designChecks: structural.designChecks,
      solverStatus: structural.solverStatus,
      demandSurfaces: structural.demandSurfaces,
      areaLoads: structural.areaLoads
    };

    mkdirSync(resolve("artifacts/structural-gravity"), { recursive: true });
    writeFileSync(resolve("artifacts/structural-gravity/structural-gravity-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

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
});
