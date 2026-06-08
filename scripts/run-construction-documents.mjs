import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { withTsModule } from "./lib/load-ts-module.mjs";

const outputDirectory = resolve("artifacts/construction-documents");
mkdirSync(outputDirectory, { recursive: true });

await withTsModule("/src/reports/constructionDocuments.ts", async ({ buildConstructionDocumentPreflightReport }) => {
  const report = buildConstructionDocumentPreflightReport();
  writeFileSync(resolve(outputDirectory, "construction-document-preflight-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
});

writeFileSync(
  resolve(outputDirectory, "README.md"),
  [
    "# Construction Document Preflight Artifact",
    "",
    "This artifact is an automated sheet-index, schedule, and coordination preflight generated from the rowhome model.",
    "",
    "It is not a dimensioned drawing set, permit package, sealed design, contractor instruction, or construction authorization.",
    "",
    "Use it as a checklist for the next professional documentation phase."
  ].join("\n"),
  "utf8"
);

console.log(`Construction document preflight wrote ${outputDirectory}/construction-document-preflight-report.json and ${outputDirectory}/README.md`);
