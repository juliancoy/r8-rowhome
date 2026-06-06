import { describe, expect, it } from "vitest";
import { defaultRowhomeConfig } from "../src/core/config";
import { generateRowhome } from "../src/generators/rowhome";
import { buildLivabilityWalkthroughReport } from "../src/simulation/livabilityWalkthrough";

describe("livability walkthrough simulation", () => {
  it("requires bathrooms with doors and use clearances on every floor", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const ids = new Set(model.components.map((component) => component.metadata.id));

    for (let level = 1; level <= defaultRowhomeConfig.stories; level += 1) {
      expect(ids.has(`bath-${level}-room-zone`), `bath ${level} zone`).toBe(true);
      expect(ids.has(`bath-${level}-door`), `bath ${level} door`).toBe(true);
      expect(ids.has(`bath-${level}-door-swing-clearance`), `bath ${level} door clearance`).toBe(true);
      expect(ids.has(`bath-${level}-toilet-clearance`), `bath ${level} toilet clearance`).toBe(true);
      expect(ids.has(`bath-${level}-shower-clearance`), `bath ${level} shower clearance`).toBe(true);
      expect(ids.has(`bath-${level}-toilet`), `bath ${level} toilet`).toBe(true);
      expect(ids.has(`bath-${level}-lavatory`), `bath ${level} lavatory`).toBe(true);
      expect(ids.has(`bath-${level}-shower`), `bath ${level} shower`).toBe(true);
    }
  });

  it("simulates daily routes while flagging the compact stair as a usability caution", () => {
    const report = buildLivabilityWalkthroughReport("test-generated-at");
    const bathroomCheck = report.checks.find((check) => check.id === "bathroom-usability");
    const stairCheck = report.checks.find((check) => check.id === "stair-walkthrough");
    const bedroomRoute = report.routes.find((route) => route.id === "bedroom-to-bathroom");

    expect(report.generatedAt).toBe("test-generated-at");
    expect(report.status).toBe("usable-concept-needs-review");
    expect(bathroomCheck?.status).toBe("pass");
    expect(stairCheck?.status).toBe("caution");
    expect(stairCheck?.cautions.join(" ")).toContain("usability risk");
    expect(bedroomRoute?.status).toBe("caution");
    expect(report.routes.every((route) => route.status !== "fail")).toBe(true);
    expect(report.requiredProfessionalFollowUp).toContain("verify bathroom fixture clearances, waterproofing, ventilation, privacy, and accessibility requirements");
  });
});
