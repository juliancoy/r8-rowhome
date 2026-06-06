import { defaultRowhomeConfig } from "../core/config";
import { generateRowhome } from "../generators/rowhome";

export function buildStructuralGravityReport(generatedAt = new Date().toISOString()) {
  const model = generateRowhome(defaultRowhomeConfig);
  const structural = model.structural;
  if (!structural) {
    throw new Error("Missing structural model");
  }

  return {
    generatedAt,
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
}
