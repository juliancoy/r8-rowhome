import type { RowhomeModel } from "../core/types";

export interface PlumbingFixtureUnitLine {
  fixtureId: string;
  waterSupplyFixtureUnits: number;
  drainageFixtureUnits: number;
  hotWater: boolean;
}

export interface PlumbingFixtureUnitCalculation {
  status: "preliminary-not-for-permit";
  fixtureCount: number;
  waterSupplyFixtureUnits: number;
  drainageFixtureUnits: number;
  hotWaterFixtureCount: number;
  lines: PlumbingFixtureUnitLine[];
  missingInputs: string[];
  source: string;
}

const fixtureRules: Array<{ pattern: RegExp; wsfu: number; dfu: number; hotWater: boolean }> = [
  { pattern: /toilet/, wsfu: 2.5, dfu: 3, hotWater: false },
  { pattern: /lavatory/, wsfu: 1, dfu: 1, hotWater: true },
  { pattern: /shower/, wsfu: 2, dfu: 2, hotWater: true },
  { pattern: /kitchen-sink/, wsfu: 1.5, dfu: 2, hotWater: true }
];

export function buildPlumbingFixtureUnitCalculation(model: RowhomeModel): PlumbingFixtureUnitCalculation {
  const fixtureIds = model.components
    .map((component) => component.metadata.id)
    .filter((id) => /^(bath-\d-(toilet|lavatory|shower)|kitchen-sink)$/.test(id));
  const lines = fixtureIds.map((fixtureId) => {
    const rule = fixtureRules.find((item) => item.pattern.test(fixtureId));
    return {
      fixtureId,
      waterSupplyFixtureUnits: rule?.wsfu ?? 0,
      drainageFixtureUnits: rule?.dfu ?? 0,
      hotWater: rule?.hotWater ?? false
    };
  });

  return {
    status: "preliminary-not-for-permit",
    fixtureCount: lines.length,
    waterSupplyFixtureUnits: lines.reduce((sum, line) => sum + line.waterSupplyFixtureUnits, 0),
    drainageFixtureUnits: lines.reduce((sum, line) => sum + line.drainageFixtureUnits, 0),
    hotWaterFixtureCount: lines.filter((line) => line.hotWater).length,
    lines,
    missingInputs: [
      "code table selection for exact occupancy and fixture types",
      "developed pipe lengths",
      "available water pressure",
      "trap arm distances",
      "vent sizing and wet-vent rules",
      "cleanout locations"
    ],
    source: "sources/code-building-codes-part-vi-international-plumbing-code-full.html"
  };
}
