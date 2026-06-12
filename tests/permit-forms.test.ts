import { describe, expect, it } from "vitest";
import { buildPermitFormsPackage, renderPermitFormMarkdown, LICENSEE, OWNER } from "../src/reports/permitForms";

describe("permit forms package", () => {
  const pkg = buildPermitFormsPackage("masonry-wood", "test-generated-at");

  it("produces the full set of eight ePermits-path forms", () => {
    expect(pkg.forms.map((form) => form.id)).toEqual([
      "form-01-combo-permit-application",
      "form-02-electrical-detail",
      "form-03-plumbing-detail",
      "form-04-mechanical-detail",
      "form-05-fire-sprinkler",
      "form-06-use-and-occupancy",
      "form-07-eplans-submission-checklist",
      "form-08-licensed-professional-registration"
    ]);
    expect(pkg.forms.every((form) => form.basis.length > 0 && form.submittedVia.length > 0)).toBe(true);
  });

  it("fills every field the model can supply and leaves none blank", () => {
    const fields = pkg.forms.flatMap((form) => form.sections.flatMap((section) => section.fields));
    expect(fields.every((entry) => entry.value.trim().length > 0)).toBe(true);
    expect(pkg.totals.modelFilledCount).toBeGreaterThan(40);
    expect(pkg.totals.fieldCount).toBe(fields.length);
  });

  it("marks owner and licensed-professional fields explicitly", () => {
    const fields = pkg.forms.flatMap((form) => form.sections.flatMap((section) => section.fields));
    const ownerFields = fields.filter((entry) => entry.source === "owner");
    const licenseeFields = fields.filter((entry) => entry.source === "licensed-professional");
    expect(ownerFields.length).toBeGreaterThan(5);
    expect(licenseeFields.length).toBeGreaterThan(15);
    expect(ownerFields.every((entry) => entry.value.includes(OWNER) || entry.value.includes("verify") || entry.value.includes("acknowledge"))).toBe(true);
    expect(licenseeFields.every((entry) => entry.value.includes(LICENSEE))).toBe(true);
  });

  it("fills the combo application with model dimensions, cost, and all-electric scope", () => {
    const combo = pkg.forms[0];
    const flat = JSON.stringify(combo);
    expect(flat).toContain("2592 sq ft");
    expect(flat).toContain("18 ft x 48 ft");
    expect(flat).toContain("New Construction");
    expect(flat).toContain("no gas");
    expect(flat).toContain("IRC P2904");
    expect(flat).toContain("Estimated cost");
  });

  it("fills the trade worksheets from the model calculations", () => {
    const electrical = JSON.stringify(pkg.forms[1]);
    expect(electrical).toContain("200 A main-breaker");
    expect(electrical).toContain("50 A, 2-pole, 240 V");
    const plumbingForm = JSON.stringify(pkg.forms[2]);
    expect(plumbingForm).toContain("heat pump water heater");
    const mechanical = JSON.stringify(pkg.forms[3]);
    expect(mechanical).toContain("1200 CFM");
  });

  it("switches construction type for the steel-concrete system", () => {
    const steel = buildPermitFormsPackage("steel-concrete", "test-generated-at");
    expect(JSON.stringify(steel.forms[0])).toContain("II-B");
    expect(JSON.stringify(pkg.forms[0])).toContain("V-B");
  });

  it("renders transcription-ready markdown with status badges", () => {
    const markdown = renderPermitFormMarkdown(pkg.forms[0], pkg);
    expect(markdown).toContain("# One and Two Family Combo Permit Application");
    expect(markdown).toContain("| Field | Value | Status |");
    expect(markdown).toContain("FILLED FROM MODEL");
    expect(markdown).toContain("OWNER ACTION");
    expect(markdown).toContain("LICENSED PROFESSIONAL");
    expect(markdown).toContain("PORTAL AUTO-FILL");
  });

  it("never claims to be a submitted application", () => {
    expect(pkg.scopeBoundary).toContain("none of this is a submitted application or approval");
  });
});
