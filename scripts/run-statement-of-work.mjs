import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { withTsModule } from "./lib/load-ts-module.mjs";

const outputDirectory = resolve("artifacts/statement-of-work");
mkdirSync(outputDirectory, { recursive: true });

await withTsModule("/src/reports/statementOfWork.ts", async ({ buildStatementOfWork, renderStatementOfWorkMarkdown }) => {
  for (const system of ["masonry-wood", "steel-concrete"]) {
    const report = buildStatementOfWork(system);
    writeFileSync(
      resolve(outputDirectory, `statement-of-work-${system}.json`),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8"
    );
    writeFileSync(resolve(outputDirectory, `STATEMENT_OF_WORK-${system}.md`), renderStatementOfWorkMarkdown(report), "utf8");
  }
});

writeFileSync(
  resolve(outputDirectory, "README.md"),
  [
    "# Statement of Work Artifacts",
    "",
    "Generated statements of work for both selectable construction systems:",
    "",
    "- `STATEMENT_OF_WORK-masonry-wood.md` — brick masonry + wood framing",
    "- `STATEMENT_OF_WORK-steel-concrete.md` — steel frame + concrete",
    "",
    "Each SOW enumerates the required design team, trades with Maryland licensing,",
    "construction phases with inspection hold points, model-derived quantities and",
    "rough-order material costs, and explicit exclusions.",
    "",
    "These documents are planning aids generated from the schematic model.",
    "They are not bid documents and license names must be verified against current",
    "Maryland and Baltimore City requirements at the time of contracting."
  ].join("\n"),
  "utf8"
);

console.log(`Statement of work wrote artifacts to ${outputDirectory}`);
