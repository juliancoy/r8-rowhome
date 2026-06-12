import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { withTsModule } from "./lib/load-ts-module.mjs";

const outputDirectory = resolve("artifacts/investor-dashboard");
mkdirSync(outputDirectory, { recursive: true });

await withTsModule("/src/reports/investorDashboard.ts", async ({ buildInvestorDashboardForSystem }) => {
  for (const system of ["masonry-wood", "steel-concrete"]) {
    const report = buildInvestorDashboardForSystem(system);
    writeFileSync(
      resolve(outputDirectory, `investor-dashboard-${system}.json`),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8"
    );
  }
});

writeFileSync(
  resolve(outputDirectory, "README.md"),
  [
    "# Investor Dashboard Artifacts",
    "",
    "Per-construction-system investor dashboard data: per-home cost analysis,",
    "labor allocation by crew, projected sale price and profit, 32-home block and",
    "128-home district parcel assessments, and the three market-size circles",
    "(global real estate, US residential, one city block).",
    "",
    "View the live dashboard in the app under the Invest tab (or open `#investor`).",
    "",
    "All figures are rough-order, illustrative projections from model metadata and",
    "public market estimates. Not an appraisal, an offering, or investment advice."
  ].join("\n"),
  "utf8"
);

console.log(`Investor dashboard wrote artifacts to ${outputDirectory}`);
