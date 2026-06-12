import { defaultRowhomeConfig } from "../core/config";
import { generateRowhome } from "../generators/rowhome";
import { constructionSystemOptions } from "../core/constructionSystems";
import { assignComponentsToRoles, rolesForSystem } from "../core/personnel";
import type { ConstructionSystem, RowhomeConfig, RowhomeModel } from "../core/types";

export interface LaborSlice {
  roleId: string;
  title: string;
  laborCostUsd: number;
  share: number;
}

export interface CostSlice {
  category: string;
  costUsd: number;
  share: number;
}

export interface MarketCircle {
  id: string;
  label: string;
  valueUsd: number;
  basis: string;
}

export interface ParcelAssessment {
  homes: number;
  description: string;
  parcelValueUsd: number;
  developmentCostUsd: number;
  projectedProfitUsd: number;
}

export interface InvestorDashboardReport {
  generatedAt: string;
  purpose: string;
  disclaimer: string;
  constructionSystem: {
    id: ConstructionSystem;
    label: string;
  };
  perHome: {
    finishedFloorAreaSf: number;
    materialCostUsd: number;
    laborCostUsd: number;
    softCostUsd: number;
    landCostUsd: number;
    contingencyUsd: number;
    totalDevelopmentCostUsd: number;
    salePricePerSf: number;
    salePriceAssumptionUsd: number;
    projectedProfitUsd: number;
    projectedMarginPct: number;
  };
  laborByRole: LaborSlice[];
  costByCategory: CostSlice[];
  block: ParcelAssessment;
  district: ParcelAssessment;
  marketCircles: MarketCircle[];
  greenProgram: {
    solarPowered: boolean;
    roofGardens: string;
    composters: string;
    blockchainParcelRegistry: string;
  };
  checks: {
    laborSharesSumToOne: boolean;
    costSharesSumToOne: boolean;
    profitIsSaleMinusCost: boolean;
    circlesDescend: boolean;
  };
}

/** Public market-size estimates; verify before investor-facing use. */
export const marketSizeAssumptions = {
  globalRealEstateUsd: 380e12,
  usResidentialUsd: 50e12
};

export const proFormaAssumptions = {
  salePricePerSf: 185,
  landCostPerHomeUsd: 40000,
  softCostShareOfHardCost: 0.18,
  contingencyShareOfHardCost: 0.1,
  homesPerBlock: 32,
  homesPerDistrict: 128
};

function round(value: number): number {
  return Math.round(value);
}

export function buildInvestorDashboardForSystem(
  constructionSystem: ConstructionSystem,
  generatedAt = new Date().toISOString()
): InvestorDashboardReport {
  return buildInvestorDashboard({ ...defaultRowhomeConfig, constructionSystem }, generatedAt);
}

export function buildInvestorDashboard(
  config: RowhomeConfig = defaultRowhomeConfig,
  generatedAt = new Date().toISOString(),
  model: RowhomeModel = generateRowhome({ ...config, rowhomeCount: 1, urbanScale: "single" })
): InvestorDashboardReport {
  const system = constructionSystemOptions.find((option) => option.id === config.constructionSystem) ?? constructionSystemOptions[0];
  const roles = rolesForSystem(system.id);

  const materialCostUsd = round(model.components.reduce((sum, component) => sum + component.metadata.estimatedCostUsd, 0));

  const laborRaw = assignComponentsToRoles(model.components, roles)
    .map((assignment) => ({
      roleId: assignment.role.id,
      title: assignment.role.title,
      laborCostUsd: round(assignment.materialCostUsd * assignment.role.laborFactor)
    }))
    .filter((slice) => slice.laborCostUsd > 0);
  const laborCostUsd = laborRaw.reduce((sum, slice) => sum + slice.laborCostUsd, 0);
  const laborByRole: LaborSlice[] = laborRaw
    .map((slice) => ({ ...slice, share: laborCostUsd > 0 ? slice.laborCostUsd / laborCostUsd : 0 }))
    .sort((a, b) => b.laborCostUsd - a.laborCostUsd);

  const byCategory = new Map<string, number>();
  for (const component of model.components) {
    byCategory.set(
      component.metadata.category,
      (byCategory.get(component.metadata.category) ?? 0) + component.metadata.estimatedCostUsd
    );
  }
  const costByCategory: CostSlice[] = [...byCategory.entries()]
    .map(([category, costUsd]) => ({
      category,
      costUsd: round(costUsd),
      share: materialCostUsd > 0 ? costUsd / materialCostUsd : 0
    }))
    .filter((slice) => slice.costUsd > 0)
    .sort((a, b) => b.costUsd - a.costUsd);

  const hardCostUsd = materialCostUsd + laborCostUsd;
  const softCostUsd = round(hardCostUsd * proFormaAssumptions.softCostShareOfHardCost);
  const contingencyUsd = round(hardCostUsd * proFormaAssumptions.contingencyShareOfHardCost);
  const landCostUsd = proFormaAssumptions.landCostPerHomeUsd;
  const totalDevelopmentCostUsd = hardCostUsd + softCostUsd + contingencyUsd + landCostUsd;

  const finishedFloorAreaSf = round(config.stories * config.buildingWidthFt * config.buildingDepthFt);
  const salePriceAssumptionUsd = round(finishedFloorAreaSf * proFormaAssumptions.salePricePerSf);
  const projectedProfitUsd = salePriceAssumptionUsd - totalDevelopmentCostUsd;
  const projectedMarginPct = salePriceAssumptionUsd > 0 ? Math.round((projectedProfitUsd / salePriceAssumptionUsd) * 1000) / 10 : 0;

  const parcel = (homes: number, description: string): ParcelAssessment => ({
    homes,
    description,
    parcelValueUsd: salePriceAssumptionUsd * homes,
    developmentCostUsd: totalDevelopmentCostUsd * homes,
    projectedProfitUsd: projectedProfitUsd * homes
  });
  const block = parcel(proFormaAssumptions.homesPerBlock, "One city block: two rows of sixteen rowhomes back to back across a rear alley.");
  const district = parcel(proFormaAssumptions.homesPerDistrict, "Four city blocks (128 homes) on a street grid.");

  const marketCircles: MarketCircle[] = [
    {
      id: "global-real-estate",
      label: "Entire real estate market of the world",
      valueUsd: marketSizeAssumptions.globalRealEstateUsd,
      basis: "Public global market estimate (~$380T); verify before investor-facing use."
    },
    {
      id: "us-residential",
      label: "All US residential real estate",
      valueUsd: marketSizeAssumptions.usResidentialUsd,
      basis: "Public US residential estimate (~$50T); verify before investor-facing use."
    },
    {
      id: "city-block",
      label: `One block of 32 R-8 rowhomes (${system.label})`,
      valueUsd: block.parcelValueUsd,
      basis: "Model-derived parcel assessment from the per-home pro forma."
    }
  ];

  return {
    generatedAt,
    purpose:
      "Investor dashboard data: per-home cost analysis, labor allocation by crew, projected sale and profit, block and district parcel assessments, and market-size circles.",
    disclaimer:
      "All figures are rough-order, illustrative projections from model metadata and public market estimates. This is not an appraisal, an offering, or investment advice.",
    constructionSystem: {
      id: system.id,
      label: system.label
    },
    perHome: {
      finishedFloorAreaSf,
      materialCostUsd,
      laborCostUsd,
      softCostUsd,
      landCostUsd,
      contingencyUsd,
      totalDevelopmentCostUsd,
      salePricePerSf: proFormaAssumptions.salePricePerSf,
      salePriceAssumptionUsd,
      projectedProfitUsd,
      projectedMarginPct
    },
    laborByRole,
    costByCategory,
    block,
    district,
    marketCircles,
    greenProgram: {
      solarPowered: true,
      roofGardens: "Roof gardens carried in the structural load model; modest yield, symbolic intent.",
      composters: "Community composters per the Green Mount West precedent; East 25th Street / northeast Baltimore expansion candidates.",
      blockchainParcelRegistry: "Concept: tokenized parcel registry backed by the generated, source-traced model of each home."
    },
    checks: {
      laborSharesSumToOne: Math.abs(laborByRole.reduce((sum, slice) => sum + slice.share, 0) - 1) < 0.01,
      costSharesSumToOne: Math.abs(costByCategory.reduce((sum, slice) => sum + slice.share, 0) - 1) < 0.01,
      profitIsSaleMinusCost: projectedProfitUsd === salePriceAssumptionUsd - totalDevelopmentCostUsd,
      circlesDescend:
        marketCircles[0].valueUsd > marketCircles[1].valueUsd && marketCircles[1].valueUsd > marketCircles[2].valueUsd
    }
  };
}
