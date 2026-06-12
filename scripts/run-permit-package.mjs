import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { withTsModule } from "./lib/load-ts-module.mjs";

const outputDirectory = resolve("artifacts/permit-package");
mkdirSync(outputDirectory, { recursive: true });

await withTsModule("/src/reports/permitPackage.ts", async ({ buildPermitPackageReport, renderPermitPackageMarkdown }) => {
  const report = buildPermitPackageReport();
  writeFileSync(resolve(outputDirectory, "permit-package.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(resolve(outputDirectory, "PERMIT_PACKAGE.md"), renderPermitPackageMarkdown(report), "utf8");
});

console.log(`Permit package wrote ${outputDirectory}/permit-package.json and PERMIT_PACKAGE.md`);
