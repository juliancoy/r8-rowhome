import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { withTsModule } from "./lib/load-ts-module.mjs";

const outputDirectory = resolve("artifacts/livability-walkthrough");
mkdirSync(outputDirectory, { recursive: true });

await withTsModule("/src/simulation/livabilityWalkthrough.ts", async ({ buildLivabilityWalkthroughReport }) => {
  const report = buildLivabilityWalkthroughReport();
  writeFileSync(resolve(outputDirectory, "livability-walkthrough-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
});

writeFileSync(
  resolve(outputDirectory, "README.md"),
  [
    "# Livability Walkthrough Artifact",
    "",
    "This artifact simulates a named-waypoint occupant walkthrough for daily-use checks: rooms, bathrooms, doors, stairs, basement utility access, and egress.",
    "",
    "It is not an accessibility certification, code approval, physics simulation, or substitute for a human-reviewed walkthrough of dimensioned drawings."
  ].join("\n"),
  "utf8"
);

console.log(`Livability walkthrough command wrote ${outputDirectory}/livability-walkthrough-report.json and ${outputDirectory}/README.md`);
