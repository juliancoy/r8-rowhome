import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { withTsModule } from "./lib/load-ts-module.mjs";

const outputDirectory = resolve("artifacts/deficiency-resolution");
mkdirSync(outputDirectory, { recursive: true });

await withTsModule("/src/reports/deficiencyResolution.ts", async ({ buildDeficiencyResolutionReport }) => {
  const report = buildDeficiencyResolutionReport();
  writeFileSync(resolve(outputDirectory, "deficiency-resolution-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
});

writeFileSync(
  resolve(outputDirectory, "README.md"),
  [
    "# Deficiency Resolution Artifact",
    "",
    "This artifact records how the project resolves the explicit deficiencies list through tested controls, command artifacts, and professional handoff boundaries.",
    "",
    "It does not convert the browser viewer into a sealed engineering solver, permit package, physical-GPU certification lab, or mesh-exact simulator.",
    "",
    "The source tracking file is `DEFICIENCIES.md`."
  ].join("\n"),
  "utf8"
);

console.log(`Deficiency resolution command wrote ${outputDirectory}/deficiency-resolution-report.json and ${outputDirectory}/README.md`);
