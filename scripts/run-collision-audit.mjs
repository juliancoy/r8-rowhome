import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { withTsModule } from "./lib/load-ts-module.mjs";

const outputDirectory = resolve("artifacts/collision-audit");
mkdirSync(outputDirectory, { recursive: true });

await withTsModule("/src/reports/collisionAudit.ts", async ({ buildCollisionAuditReport }) => {
  const report = buildCollisionAuditReport();
  writeFileSync(resolve(outputDirectory, "collision-audit-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  if (report.status !== "pass") {
    throw new Error(`Collision audit failed with ${report.suspectCriticalCount} suspect critical intersections`);
  }
});

writeFileSync(
  resolve(outputDirectory, "README.md"),
  [
    "# Collision Audit Artifact",
    "",
    "This artifact scans every printable component pair and classifies detected AABB intersections.",
    "",
    "It is a broad preflight audit, not an exact mesh boolean or finite-element contact solver.",
    "",
    "Suspect critical intersections fail the command."
  ].join("\n"),
  "utf8"
);

console.log(`Collision audit wrote ${outputDirectory}/collision-audit-report.json and ${outputDirectory}/README.md`);
