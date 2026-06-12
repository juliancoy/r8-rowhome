import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { withTsModule } from "./lib/load-ts-module.mjs";

const outputDirectory = resolve("artifacts/print-kit");
mkdirSync(outputDirectory, { recursive: true });

const manifests = [];

await withTsModule("/src/export/printKit.ts", async ({ buildPrintKitExport }) => {
  for (const system of ["masonry-wood", "steel-concrete"]) {
    const kitExport = buildPrintKitExport(system);
    for (const kit of kitExport.kits) {
      writeFileSync(resolve(outputDirectory, kit.filename), kit.stlText, "utf8");
    }
    manifests.push({
      constructionSystem: kitExport.constructionSystem,
      scale: kitExport.scale,
      millimetersPerFoot: kitExport.millimetersPerFoot,
      printedComponentCount: kitExport.printedComponentCount,
      excludedComponentCount: kitExport.excludedComponentCount,
      kits: kitExport.manifest
    });
    console.log(`Exported ${kitExport.kits.length} STL kits for ${system} (${kitExport.printedComponentCount} components)`);
  }
});

writeFileSync(resolve(outputDirectory, "print-kit-manifest.json"), `${JSON.stringify({ manifests }, null, 2)}\n`, "utf8");

writeFileSync(
  resolve(outputDirectory, "README.md"),
  [
    "# 3D Print Kit",
    "",
    "One-command STL export of the entire rowhome model at architectural scale (1:48),",
    "for both construction systems. Units are millimeters; 1 model foot = 6.35 mm.",
    "",
    "Generate with:",
    "",
    "```sh",
    "npm run print:kit",
    "```",
    "",
    "Each construction system exports one STL per print kit (site base, shell/envelope,",
    "structure/egress, MEP overlays, interior fixtures, miscellaneous). See",
    "`print-kit-manifest.json` for component counts and per-kit handling notes.",
    "",
    "Run `npm run print:preflight` first for the feature-size and asset-review report;",
    "components flagged there may need enlargement or simplification in the slicer."
  ].join("\n"),
  "utf8"
);

console.log(`Print kit wrote STL files and manifest to ${outputDirectory}`);
