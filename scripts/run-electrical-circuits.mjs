import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { withTsModule } from "./lib/load-ts-module.mjs";

const outputDirectory = resolve("artifacts/electrical-circuits");
mkdirSync(outputDirectory, { recursive: true });

await withTsModule("/src/reports/electricalCircuits.ts", async ({ buildElectricalCircuitReport }) => {
  const report = buildElectricalCircuitReport();
  writeFileSync(resolve(outputDirectory, "electrical-circuit-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
});

writeFileSync(
  resolve(outputDirectory, "README.md"),
  [
    "# Electrical Circuit Connectivity Artifact",
    "",
    "This report verifies the modeled all-electric system is topologically complete:",
    "- The service chain (mast, meter, service entrance, disconnect, feeder, panel) is continuous.",
    "- Every fixed-wiring electrical component is reachable from the panel through modeled connections.",
    "- The machine-readable panel schedule pairs each breaker with a compatible conductor ampacity.",
    "- The accessible 50 A / 240 V / 6 AWG range circuit is present.",
    "- No gas appliance or gas piping component exists anywhere in the model.",
    "",
    "Scope boundary: this is schematic topology verification, not an NEC load calculation,",
    "AFCI/GFCI device selection, or licensed electrical design."
  ].join("\n"),
  "utf8"
);

console.log(`Electrical circuits wrote ${outputDirectory}/electrical-circuit-report.json`);
