import { describe, expect, it } from "vitest";
import { buildElectricalCircuitReport } from "../src/reports/electricalCircuits";
import { conductorAmpacityByAwg, panelSchedule } from "../src/generators/electrical";

describe("electrical circuit connectivity", () => {
  const report = buildElectricalCircuitReport("test-generated-at");

  it("verifies the service chain from mast to panel is continuous", () => {
    expect(report.serviceChain).toEqual([
      "service-mast",
      "meter-socket",
      "service-entrance-conductors",
      "service-disconnect",
      "main-feeder-run",
      "electrical-panel"
    ]);
    expect(report.checks.serviceChainConnected).toBe(true);
  });

  it("reaches every fixed-wiring electrical component from the panel", () => {
    expect(report.unreachableComponentIds, `unreachable: ${report.unreachableComponentIds.join(", ")}`).toEqual([]);
    expect(report.checks.allElectricalComponentsReachable).toBe(true);
    expect(report.connectionEdgeCount).toBeGreaterThan(40);
  });

  it("pairs every breaker with a conductor of adequate ampacity", () => {
    expect(report.breakerWireCompatibility.length).toBe(panelSchedule.length);
    for (const entry of report.breakerWireCompatibility) {
      expect(entry.compatible, `${entry.circuitId}: ${entry.breakerAmps} A breaker on ${entry.conductorAwg} AWG (${entry.conductorAmpacityAmps} A)`).toBe(true);
    }
    expect(report.checks.allBreakersWireCompatible).toBe(true);
  });

  it("includes the accessible 50 A / 240 V / 6 AWG range circuit", () => {
    expect(report.checks.rangeCircuitIs240v50a6awg).toBe(true);
    expect(report.terminalCoverage.has240vRangeCircuit).toBe(true);
  });

  it("covers lighting, receptacle, HVAC, and water heater terminals", () => {
    expect(report.terminalCoverage.lightingTerminals).toBe(8);
    expect(report.terminalCoverage.receptacleTerminals).toBe(8);
    expect(report.terminalCoverage.hasHvacCircuits).toBe(true);
    expect(report.terminalCoverage.hasWaterHeaterCircuit).toBe(true);
  });

  it("references only real component ids from the panel schedule", () => {
    expect(report.checks.everyScheduledComponentExists).toBe(true);
  });

  it("contains no gas appliances anywhere in the model", () => {
    expect(report.checks.noGasAppliances).toBe(true);
  });

  it("uses NEC-consistent conductor ampacity assumptions", () => {
    expect(conductorAmpacityByAwg[14]).toBe(15);
    expect(conductorAmpacityByAwg[12]).toBe(20);
    expect(conductorAmpacityByAwg[10]).toBe(30);
    expect(conductorAmpacityByAwg[6]).toBe(55);
  });
});
