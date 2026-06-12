import { describe, expect, it } from "vitest";
import { buildStatementOfWork, renderStatementOfWorkMarkdown } from "../src/reports/statementOfWork";
import { personnelRoles, rolesForSystem, skillsForRole } from "../src/core/personnel";

describe("personnel database", () => {
  it("defines skills, credentials, crew sizes, and phases for every role", () => {
    for (const role of personnelRoles) {
      expect(role.skills.length, role.id).toBeGreaterThanOrEqual(3);
      expect(role.marylandCredential.length, role.id).toBeGreaterThan(10);
      expect(role.crewSize.typical).toBeGreaterThanOrEqual(role.crewSize.minimum);
      expect(role.phases.length, role.id).toBeGreaterThan(0);
      expect(role.constructionSystems.length, role.id).toBeGreaterThan(0);
    }
  });

  it("alternates structure roles by construction system", () => {
    const masonryRoles = rolesForSystem("masonry-wood").map((role) => role.id);
    const steelRoles = rolesForSystem("steel-concrete").map((role) => role.id);

    expect(masonryRoles).toContain("mason");
    expect(masonryRoles).toContain("rough-framer");
    expect(masonryRoles).not.toContain("steel-erector");
    expect(masonryRoles).not.toContain("reinforcing-ironworker");

    expect(steelRoles).toContain("steel-erector");
    expect(steelRoles).toContain("reinforcing-ironworker");
    expect(steelRoles).not.toContain("mason");
    expect(steelRoles).not.toContain("rough-framer");

    for (const shared of ["general-contractor", "electrician", "plumber", "hvacr-mechanic", "sprinkler-fitter", "interiors-carpenter"]) {
      expect(masonryRoles).toContain(shared);
      expect(steelRoles).toContain(shared);
    }
  });

  it("adds system-specific skills on top of base skills", () => {
    const carpenter = personnelRoles.find((role) => role.id === "interiors-carpenter");
    expect(carpenter).toBeDefined();
    if (!carpenter) return;
    const woodSkills = skillsForRole(carpenter, "masonry-wood");
    const steelSkills = skillsForRole(carpenter, "steel-concrete");
    expect(woodSkills.some((skill) => skill.includes("wood stud"))).toBe(true);
    expect(steelSkills.some((skill) => skill.includes("steel stud"))).toBe(true);
    expect(steelSkills.every((skill) => !skill.includes("2x4 wood stud"))).toBe(true);
  });
});

describe("statement of work", () => {
  const masonryWood = buildStatementOfWork("masonry-wood", "test-generated-at");
  const steelConcrete = buildStatementOfWork("steel-concrete", "test-generated-at");

  it("requires a sealed Maryland design team for both systems", () => {
    for (const report of [masonryWood, steelConcrete]) {
      expect(report.designTeam.some((member) => member.role === "Architect of record" && member.sealRequired)).toBe(true);
      expect(report.designTeam.some((member) => member.role === "Structural engineer of record" && member.sealRequired)).toBe(true);
      expect(report.designTeam.some((member) => member.role === "Geotechnical engineer")).toBe(true);
    }
  });

  it("staffs licensed electrician, plumber, and HVACR roles with real scope", () => {
    for (const report of [masonryWood, steelConcrete]) {
      const electrician = report.personnel.find((role) => role.roleId === "electrician");
      expect(electrician?.componentCount).toBeGreaterThan(20);
      expect(electrician?.marylandCredential).toContain("Master Electrician");
      const plumber = report.personnel.find((role) => role.roleId === "plumber");
      expect(plumber?.componentCount).toBeGreaterThan(5);
      const hvac = report.personnel.find((role) => role.roleId === "hvacr-mechanic");
      expect(hvac?.componentCount).toBeGreaterThan(10);
    }
  });

  it("staffs masons and framers for brick, ironworkers and rodbusters for steel-concrete", () => {
    expect(masonryWood.personnel.some((role) => role.roleId === "mason" && role.componentCount > 0)).toBe(true);
    expect(masonryWood.personnel.some((role) => role.roleId === "steel-erector")).toBe(false);
    expect(steelConcrete.personnel.some((role) => role.roleId === "steel-erector" && role.componentCount > 0)).toBe(true);
    expect(steelConcrete.personnel.some((role) => role.roleId === "reinforcing-ironworker" && role.componentCount > 0)).toBe(true);
    expect(steelConcrete.personnel.some((role) => role.roleId === "mason")).toBe(false);
  });

  it("lists concrete skills for every staffed role", () => {
    for (const report of [masonryWood, steelConcrete]) {
      for (const role of report.personnel) {
        expect(role.skills.length, role.roleId).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("carries the Maryland residential sprinkler requirement as explicit personnel scope", () => {
    for (const report of [masonryWood, steelConcrete]) {
      expect(report.personnel.some((role) => role.roleId === "sprinkler-fitter")).toBe(true);
      expect(report.exclusions.some((exclusion) => exclusion.includes("sprinkler"))).toBe(true);
    }
  });

  it("staffs phases from role assignments, permit first and U&O last", () => {
    for (const report of [masonryWood, steelConcrete]) {
      expect(report.phases).toHaveLength(10);
      expect(report.phases.map((phase) => phase.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(report.phases[0].inspectionHoldPoints[0]).toContain("Permit issuance");
      expect(report.phases[9].inspectionHoldPoints.some((point) => point.includes("Use and Occupancy"))).toBe(true);
      const mepPhase = report.phases.find((phase) => phase.sequence === 6);
      expect(mepPhase?.personnel).toContain("Licensed electrician crew");
      expect(mepPhase?.personnel).toContain("Fire sprinkler fitter");
    }
    const masonryStructure = masonryWood.phases.find((phase) => phase.sequence === 4);
    expect(masonryStructure?.personnel).toContain("Brick and CMU mason");
    const steelStructure = steelConcrete.phases.find((phase) => phase.sequence === 4);
    expect(steelStructure?.personnel).toContain("Ironworker / structural steel erector");
    expect(steelStructure?.description).toContain("metal deck");
  });

  it("derives totals from the generated model", () => {
    for (const report of [masonryWood, steelConcrete]) {
      expect(report.totals.componentCount).toBeGreaterThan(1000);
      expect(report.totals.estimatedMaterialCostUsd).toBeGreaterThan(100000);
      expect(report.totals.typicalCrewHeadcount).toBeGreaterThan(15);
      const roleSum = report.personnel.reduce((sum, role) => sum + role.estimatedMaterialCostUsd, 0);
      expect(roleSum).toBeLessThanOrEqual(report.totals.estimatedMaterialCostUsd);
      expect(roleSum).toBeGreaterThan(report.totals.estimatedMaterialCostUsd * 0.35);
    }
  });

  it("renders a complete personnel-driven markdown document", () => {
    const markdown = renderStatementOfWorkMarkdown(steelConcrete);
    expect(markdown).toContain("# Statement of Work");
    expect(markdown).toContain("Steel frame + concrete");
    expect(markdown).toContain("## Required Personnel, Skills, and Credentials");
    expect(markdown).toContain("### Ironworker / structural steel erector");
    expect(markdown).toContain("AWS D1.1 field welding");
    expect(markdown).toContain("### Phase 10: Final inspections and closeout");

    const woodMarkdown = renderStatementOfWorkMarkdown(masonryWood);
    expect(woodMarkdown).toContain("### Brick and CMU mason");
    expect(woodMarkdown).toContain("running-bond brick laying");
    expect(woodMarkdown).not.toContain("Ironworker");
  });
});
