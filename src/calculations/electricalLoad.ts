import type { RowhomeConfig, RowhomeModel } from "../core/types";
import { defaultRowhomeConfig } from "../core/config";

export interface ElectricalLoadLine {
  id: string;
  description: string;
  voltAmps: number;
  source: string;
}

export interface ElectricalLoadCalculation {
  status: "preliminary-not-for-permit";
  dwellingAreaSqFt: number;
  totalConnectedVoltAmps: number;
  serviceVoltage: 240;
  preliminaryServiceAmps: number;
  recommendedServiceAmps: number;
  lines: ElectricalLoadLine[];
  missingInputs: string[];
}

function round(value: number, places = 1): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function hasComponent(model: RowhomeModel, id: string): boolean {
  return model.components.some((component) => component.metadata.id === id);
}

export function buildElectricalLoadCalculation(
  model: RowhomeModel,
  config: RowhomeConfig = defaultRowhomeConfig
): ElectricalLoadCalculation {
  const dwellingAreaSqFt = Math.round(config.buildingWidthFt * config.buildingDepthFt * config.stories * Math.max(1, Math.round(config.rowhomeCount || 1)));
  const lines: ElectricalLoadLine[] = [
    {
      id: "general-lighting",
      description: "General lighting and receptacle allowance at 3 VA/sf for preliminary residential load tracking.",
      voltAmps: dwellingAreaSqFt * 3,
      source: "sources/code-building-codes-part-iii-national-electrical-code-full.html"
    },
    {
      id: "small-appliance-circuits",
      description: "Two kitchen small-appliance branch circuits at 1500 VA each.",
      voltAmps: 3000,
      source: "sources/code-building-codes-part-iii-national-electrical-code-full.html"
    },
    {
      id: "laundry-circuit-placeholder",
      description: "Laundry circuit placeholder retained as a missing-input allowance.",
      voltAmps: 1500,
      source: "sources/code-building-codes-part-iii-national-electrical-code-full.html"
    },
    {
      id: "electric-range",
      description: "Modeled electric range preliminary nameplate allowance.",
      voltAmps: hasComponent(model, "electric-range") ? 12000 : 0,
      source: "sources/code-building-codes-part-iii-national-electrical-code-full.html"
    },
    {
      id: "central-ac-hvac",
      description: "Modeled all-electric central AC condenser and air-handler preliminary allowance.",
      voltAmps: hasComponent(model, "central-ac-condenser") && hasComponent(model, "air-handler") ? 6500 : 0,
      source: "sources/code-building-codes-part-iii-national-electrical-code-full.html"
    },
    {
      id: "heat-pump-water-heater",
      description: "Modeled electric heat-pump water heater preliminary allowance.",
      voltAmps: hasComponent(model, "electric-water-heater") ? 4500 : 0,
      source: "sources/code-building-codes-part-iii-national-electrical-code-full.html"
    },
    {
      id: "refrigerator",
      description: "Modeled refrigerator preliminary allowance.",
      voltAmps: hasComponent(model, "refrigerator") ? 700 : 0,
      source: "sources/code-building-codes-part-iii-national-electrical-code-full.html"
    },
    {
      id: "pv-battery-storage-interconnection",
      description: "Modeled PV hybrid inverter and lithium-ion battery storage are tracked as an interconnection item, not as a simple additional dwelling load.",
      voltAmps: hasComponent(model, "lithium-ion-battery") && hasComponent(model, "pv-hybrid-inverter") ? 0 : 0,
      source: "sources/code-building-codes-part-iii-national-electrical-code-full.html"
    }
  ];
  const totalConnectedVoltAmps = lines.reduce((sum, line) => sum + line.voltAmps, 0);
  const preliminaryServiceAmps = round(totalConnectedVoltAmps / 240);
  const recommendedServiceAmps = preliminaryServiceAmps <= 100 ? 100 : preliminaryServiceAmps <= 150 ? 150 : 200;

  return {
    status: "preliminary-not-for-permit",
    dwellingAreaSqFt,
    totalConnectedVoltAmps,
    serviceVoltage: 240,
    preliminaryServiceAmps,
    recommendedServiceAmps,
    lines,
    missingInputs: [
      "actual appliance nameplates",
      "demand-factor calculation",
      "panel schedule",
      "PV and battery energy-storage interconnection calculation",
      "battery listing, capacity, shutdown, and fire-code requirements",
      "feeder and service conductor sizing",
      "AFCI/GFCI requirements",
      "grounding and bonding design"
    ]
  };
}
