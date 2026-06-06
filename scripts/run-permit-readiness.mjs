import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { withTsModule } from "./lib/load-ts-module.mjs";

const outputDirectory = resolve("artifacts/permit-readiness");
mkdirSync(outputDirectory, { recursive: true });

await withTsModule("/src/reports/permitReadiness.ts", async ({ buildPermitReadinessReport }) => {
  const report = buildPermitReadinessReport();
  writeFileSync(resolve(outputDirectory, "permit-readiness-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
});

writeFileSync(
  resolve(outputDirectory, "README.md"),
  [
    "# Permit Readiness Artifact",
    "",
    "This artifact summarizes model-supported scope, construction blockers, and preliminary discipline calculations.",
    "",
    "It is not a permit application, sealed drawing set, legal opinion, or construction authorization.",
    "",
    "The source of truth for the buildability boundary is `legal_procedure.md`."
  ].join("\n"),
  "utf8"
);

console.log(`Permit readiness command wrote ${outputDirectory}/permit-readiness-report.json and ${outputDirectory}/README.md`);
