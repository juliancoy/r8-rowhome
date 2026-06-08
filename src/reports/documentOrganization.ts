export interface DocumentRegisterEntry {
  path: string;
  section: "orientation" | "professional-practice" | "engineering" | "viewer" | "generated-artifact" | "external-source-index";
  status: "source" | "generated";
  purpose: string;
}

export interface DocumentOrganizationReport {
  generatedAt: string;
  status: "organized";
  purpose: string;
  documents: DocumentRegisterEntry[];
  generatedArtifactCount: number;
  recommendedReadingOrder: string[];
}

const documents: DocumentRegisterEntry[] = [
  { path: "README.md", section: "orientation", status: "source", purpose: "Project overview, commands, and viewer entry points." },
  { path: "mission.md", section: "orientation", status: "source", purpose: "Original project mission and product intent." },
  { path: "plan.md", section: "orientation", status: "source", purpose: "Implementation plan and acceptance approach." },
  { path: "Materials.md", section: "professional-practice", status: "source", purpose: "Material assumptions and source-traced assembly notes." },
  { path: "DEFICIENCIES.md", section: "professional-practice", status: "source", purpose: "Remaining technical build blockers and closed controls." },
  { path: "legal_procedure.md", section: "professional-practice", status: "source", purpose: "Nonconstruction boundary and permit/legal procedure." },
  { path: "../architect_logic.md", section: "professional-practice", status: "source", purpose: "Architect workflow for code, envelope, egress, roof access, and closeout." },
  { path: "../structural_logic.md", section: "engineering", status: "source", purpose: "Structural engineer workflow for load path, stair/roof openings, guards, and review." },
  { path: "pragmaticpath.md", section: "engineering", status: "source", purpose: "Structural simulation path and solver tradeoffs." },
  { path: "scale.md", section: "viewer", status: "source", purpose: "Visual inspection checklist and screenshot expectations." },
  { path: "docs/model-assumptions.md", section: "viewer", status: "source", purpose: "Declared model assumptions." },
  { path: "docs/source-traceability.md", section: "external-source-index", status: "source", purpose: "Source traceability process." },
  { path: "docs/validation.md", section: "viewer", status: "source", purpose: "Validation expectations and known boundaries." },
  { path: "docs/web-viewer.md", section: "viewer", status: "source", purpose: "Web viewer usage notes." },
  { path: "artifacts/construction-documents/construction-document-preflight-report.json", section: "generated-artifact", status: "generated", purpose: "Generated sheet index, schedules, and construction-document preflight checks." },
  { path: "artifacts/collision-audit/collision-audit-report.json", section: "generated-artifact", status: "generated", purpose: "Generated all-printable-component collision audit." },
  { path: "artifacts/print-preflight/print-preflight-report.json", section: "generated-artifact", status: "generated", purpose: "Generated 3D-print scale, kit, and minimum-feature preflight checks." },
  { path: "artifacts/deficiency-resolution/deficiency-resolution-report.json", section: "generated-artifact", status: "generated", purpose: "Generated deficiency control and remaining blocker register." },
  { path: "artifacts/permit-readiness/permit-readiness-report.json", section: "generated-artifact", status: "generated", purpose: "Generated buildability and preliminary discipline readiness report." },
  { path: "artifacts/structural-gravity/structural-gravity-report.json", section: "generated-artifact", status: "generated", purpose: "Generated structural gravity preflight report." },
  { path: "artifacts/hvac-flow/hvac-flow-report.json", section: "generated-artifact", status: "generated", purpose: "Generated HVAC airflow topology report." },
  { path: "artifacts/plumbing-flow/plumbing-flow-report.json", section: "generated-artifact", status: "generated", purpose: "Generated plumbing flow topology report." },
  { path: "artifacts/livability-walkthrough/livability-walkthrough-report.json", section: "generated-artifact", status: "generated", purpose: "Generated named-route livability walkthrough report." },
  { path: "artifacts/performance/renderer-benchmark.json", section: "generated-artifact", status: "generated", purpose: "Generated renderer timing and GPU adapter report when benchmark is run." }
];

export function buildDocumentOrganizationReport(generatedAt = new Date().toISOString()): DocumentOrganizationReport {
  return {
    generatedAt,
    status: "organized",
    purpose: "Organizes source documents and generated artifacts for the rowhome model into a reading order and section register.",
    documents,
    generatedArtifactCount: documents.filter((document) => document.status === "generated").length,
    recommendedReadingOrder: [
      "README.md",
      "DEFICIENCIES.md",
      "legal_procedure.md",
      "../architect_logic.md",
      "../structural_logic.md",
      "Materials.md",
      "artifacts/construction-documents/construction-document-preflight-report.json",
      "artifacts/print-preflight/print-preflight-report.json",
      "artifacts/permit-readiness/permit-readiness-report.json"
    ]
  };
}
