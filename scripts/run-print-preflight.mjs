import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { withTsModule } from "./lib/load-ts-module.mjs";

const outputDirectory = resolve("artifacts/print-preflight");
mkdirSync(outputDirectory, { recursive: true });

await withTsModule("/src/reports/printPreflight.ts", async ({ buildPrintPreflightReport }) => {
  const report = buildPrintPreflightReport();
  writeFileSync(resolve(outputDirectory, "print-preflight-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
});

writeFileSync(
  resolve(outputDirectory, "README.md"),
  [
    "# 3D Print Preflight Artifact",
    "",
    "This artifact checks the generated rowhome model against a scaled display-model print profile.",
    "",
    "It is not a repaired mesh, slicer project, support plan, or guarantee that the STL can print successfully.",
    "",
    "Use this output to decide which components to thicken, omit, split into plates, or convert to watertight printable assets."
  ].join("\n"),
  "utf8"
);

console.log(`Print preflight wrote ${outputDirectory}/print-preflight-report.json and ${outputDirectory}/README.md`);
