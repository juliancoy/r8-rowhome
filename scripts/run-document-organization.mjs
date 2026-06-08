import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { withTsModule } from "./lib/load-ts-module.mjs";

const docsDirectory = resolve("docs");
const outputDirectory = resolve("artifacts/document-organization");
mkdirSync(docsDirectory, { recursive: true });
mkdirSync(outputDirectory, { recursive: true });

await withTsModule("/src/reports/documentOrganization.ts", async ({ buildDocumentOrganizationReport }) => {
  const report = buildDocumentOrganizationReport();
  writeFileSync(resolve(outputDirectory, "document-organization-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const lines = [
    "# R8 Rowhome Document Register",
    "",
    "This register organizes source documents and generated artifacts for professional handoff. Generated artifacts must be regenerated after model changes.",
    "",
    "## Recommended Reading Order",
    "",
    ...report.recommendedReadingOrder.map((path) => `- \`${path}\``),
    "",
    "## Register",
    "",
    "| Section | Status | Path | Purpose |",
    "| --- | --- | --- | --- |",
    ...report.documents.map((document) => `| ${document.section} | ${document.status} | \`${document.path}\` | ${document.purpose} |`),
    ""
  ];
  writeFileSync(resolve(docsDirectory, "DOCUMENT_REGISTER.md"), lines.join("\n"), "utf8");
});

writeFileSync(
  resolve(outputDirectory, "README.md"),
  [
    "# Document Organization Artifact",
    "",
    "This artifact records the document register generated into `docs/DOCUMENT_REGISTER.md`.",
    "",
    "It includes source markdown files and generated report artifacts."
  ].join("\n"),
  "utf8"
);

console.log(`Document organization wrote ${outputDirectory}/document-organization-report.json and docs/DOCUMENT_REGISTER.md`);
