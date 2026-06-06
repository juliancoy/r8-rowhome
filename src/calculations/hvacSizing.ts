import type { RowhomeConfig, RowhomeModel } from "../core/types";
import { defaultRowhomeConfig } from "../core/config";

export interface HvacSizingCalculation {
  status: "preliminary-not-manual-j";
  conditionedAreaSqFt: number;
  envelopeVolumeCf: number;
  heatingBtuh: number;
  coolingBtuh: number;
  coolingTons: number;
  heatingZones: Array<{
    level: number;
    heaterId: string;
    thermostatId: string;
    preliminaryHeatingBtuh: number;
  }>;
  modeledSupplyCfm: number;
  modeledReturnCfm: number;
  cfmPerTon: number;
  missingInputs: string[];
  source: string;
}

function round(value: number, places = 1): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

export function buildHvacSizingCalculation(
  model: RowhomeModel,
  config: RowhomeConfig = defaultRowhomeConfig
): HvacSizingCalculation {
  const rowhomeCount = Math.max(1, Math.round(config.rowhomeCount || 1));
  const conditionedAreaSqFt = config.buildingWidthFt * config.buildingDepthFt * config.stories * rowhomeCount;
  const envelopeVolumeCf = conditionedAreaSqFt * config.storyHeightFt;
  const heatingBtuh = Math.round(conditionedAreaSqFt * 30);
  const coolingBtuh = Math.round(conditionedAreaSqFt * 18);
  const coolingTons = round(coolingBtuh / 12000, 2);
  const hvacEdges = model.components
    .filter((component) => component.object.userData.hvac?.hollow === true)
    .map((component) => component.object.userData.hvac);
  const modeledSupplyCfm = hvacEdges
    .filter((edge) => typeof edge.to === "string" && edge.to.startsWith("supply-register"))
    .reduce((sum, edge) => sum + (edge.flowCfm as number), 0);
  const modeledReturnCfm = hvacEdges
    .filter((edge) => typeof edge.from === "string" && edge.from.startsWith("return-grille"))
    .reduce((sum, edge) => sum + (edge.flowCfm as number), 0);
  const heatingZones = Array.from({ length: config.stories }, (_, floor) => {
    const level = floor + 1;
    return {
      level,
      heaterId: `floor-${level}-heat-pump-indoor-unit`,
      thermostatId: `floor-${level}-thermostat`,
      preliminaryHeatingBtuh: Math.round(heatingBtuh / config.stories)
    };
  });

  return {
    status: "preliminary-not-manual-j",
    conditionedAreaSqFt,
    envelopeVolumeCf,
    heatingBtuh,
    coolingBtuh,
    coolingTons,
    heatingZones,
    modeledSupplyCfm,
    modeledReturnCfm,
    cfmPerTon: round(modeledSupplyCfm / Math.max(0.1, coolingTons), 1),
    missingInputs: [
      "Manual J room-by-room heating and cooling load",
      "floor-by-floor heat-loss and heat-gain allocation",
      "orientation and fenestration performance",
      "infiltration and ventilation rates",
      "equipment selection",
      "duct static pressure",
      "balancing targets"
    ],
    source: "sources/code-building-codes-part-v-international-mechanical-code-full.html"
  };
}
