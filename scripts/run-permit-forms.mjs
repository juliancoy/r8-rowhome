import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { withTsModule } from "./lib/load-ts-module.mjs";

const outputDirectory = resolve("forms");
mkdirSync(outputDirectory, { recursive: true });

await withTsModule("/src/reports/permitForms.ts", async ({ buildPermitFormsPackage, renderPermitFormMarkdown }) => {
  const pkg = buildPermitFormsPackage();
  writeFileSync(resolve(outputDirectory, "permit-forms.json"), `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  for (const [index, form] of pkg.forms.entries()) {
    const filename = `FORM-${String(index + 1).padStart(2, "0")}-${form.id.replace(/^form-\d+-/, "")}.md`;
    writeFileSync(resolve(outputDirectory, filename), renderPermitFormMarkdown(form, pkg), "utf8");
  }
  writeFileSync(
    resolve(outputDirectory, "README.md"),
    [
      "# Permit Forms",
      "",
      "Filled application worksheets for the Baltimore City DHCD ePermits new-construction",
      "path. Baltimore City accepts these applications only through the online ePermits",
      "portal — no standalone fillable PDFs exist — so each worksheet mirrors the portal",
      "screens field-for-field for direct transcription.",
      "",
      "Regenerate with:",
      "",
      "```sh",
      "npm run forms:generate",
      "```",
      "",
      "## Forms",
      "",
      ...pkg.forms.map((form, index) => `${index + 1}. **${form.title}** — \`FORM-${String(index + 1).padStart(2, "0")}-${form.id.replace(/^form-\d+-/, "")}.md\``),
      "",
      "## Fill Status",
      "",
      `- Filled from the model: ${pkg.totals.modelFilledCount} fields`,
      `- Owner action required: ${pkg.totals.ownerActionCount} fields`,
      `- Licensed professional required: ${pkg.totals.licensedProfessionalCount} fields`,
      `- Auto-filled by the portal from the parcel record: ${pkg.totals.portalAutoCount} fields`,
      "",
      pkg.scopeBoundary
    ].join("\n"),
    "utf8"
  );
  console.log(
    `Wrote ${pkg.forms.length} forms (${pkg.totals.fieldCount} fields: ${pkg.totals.modelFilledCount} model-filled, ${pkg.totals.ownerActionCount} owner, ${pkg.totals.licensedProfessionalCount} licensee, ${pkg.totals.portalAutoCount} portal) to ${outputDirectory}`
  );
});
