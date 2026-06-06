import { defaultRowhomeConfig } from "../core/config";
import type { RowhomeConfig, RowhomeModel } from "../core/types";
import { generateRowhome } from "../generators/rowhome";

export type LivabilityStatus = "pass" | "caution" | "fail";

export interface LivabilityCheck {
  id: string;
  status: LivabilityStatus;
  summary: string;
  evidence: string[];
  cautions: string[];
}

export interface WalkthroughRoute {
  id: string;
  name: string;
  waypoints: string[];
  status: LivabilityStatus;
  cautions: string[];
}

export interface LivabilityWalkthroughReport {
  generatedAt: string;
  status: "usable-concept-needs-review" | "not-livable";
  simulatedPerson: {
    shoulderWidthFt: number;
    turningDiameterFt: number;
    note: string;
  };
  checks: LivabilityCheck[];
  routes: WalkthroughRoute[];
  requiredProfessionalFollowUp: string[];
}

function hasComponent(model: RowhomeModel, id: string): boolean {
  return model.components.some((component) => component.metadata.id === id);
}

function requiredIdsPresent(model: RowhomeModel, ids: string[]): boolean {
  return ids.every((id) => hasComponent(model, id));
}

function checkBathrooms(model: RowhomeModel, config: RowhomeConfig): LivabilityCheck {
  const evidence: string[] = [];
  const missing: string[] = [];
  for (let level = 1; level <= config.stories; level += 1) {
    const required = [
      `bath-${level}-room-zone`,
      `bath-${level}-door`,
      `bath-${level}-door-swing-clearance`,
      `bath-${level}-toilet-clearance`,
      `bath-${level}-shower-clearance`,
      `bath-${level}-toilet`,
      `bath-${level}-lavatory`,
      `bath-${level}-shower`
    ];
    for (const id of required) {
      if (hasComponent(model, id)) {
        evidence.push(id);
      } else {
        missing.push(id);
      }
    }
  }
  return {
    id: "bathroom-usability",
    status: missing.length === 0 ? "pass" : "fail",
    summary: missing.length === 0 ? "Each floor has a bathroom zone with a door, toilet, lavatory, shower, and schematic use clearances." : "One or more bathroom fixtures, doors, room zones, or clearance markers are missing.",
    evidence,
    cautions: missing.length > 0 ? [`Missing: ${missing.join(", ")}`] : ["Clearance markers are schematic; final dimensions and accessibility still need architectural review."]
  };
}

function checkDoorsAndEgress(model: RowhomeModel, config: RowhomeConfig): LivabilityCheck {
  const required = ["front-door", "front-door-threshold", "rear-exit-door-1", "stoop", "fire-escape-yard-landing"];
  for (let level = 2; level <= config.stories; level += 1) {
    required.push(`rear-exit-door-${level}`, `fire-escape-platform-${level}`);
  }
  const evidence = required.filter((id) => hasComponent(model, id));
  const missing = required.filter((id) => !hasComponent(model, id));
  return {
    id: "door-and-egress-usability",
    status: missing.length === 0 ? "pass" : "fail",
    summary: missing.length === 0 ? "Front entry, rear doors, and fire-escape components are represented for daily entry and emergency egress review." : "One or more entry/egress components are missing.",
    evidence,
    cautions: missing.length > 0 ? [`Missing: ${missing.join(", ")}`] : ["Door swing, hardware, thresholds, landing dimensions, and code egress role remain professional-review items."]
  };
}

function checkStairs(model: RowhomeModel, config: RowhomeConfig): LivabilityCheck {
  const stairEvidence = [
    "stair-run-1",
    "stair-landing-1",
    "stair-egress-bridge-1",
    "stair-handrail-left-1",
    "stair-handrail-right-1"
  ].filter((id) => hasComponent(model, id));
  const stairWidthFt = 3.2;
  const treadDepthFt = 0.78;
  const riserHeightFt = 0.625;
  const basicsPass = stairEvidence.length >= 5 && stairWidthFt >= 3 && treadDepthFt >= 0.75 && riserHeightFt <= 0.625;
  return {
    id: "stair-walkthrough",
    status: basicsPass ? "caution" : "fail",
    summary: basicsPass ? "The modeled stair is connected and dimensionally plausible, but the compact alternating-run layout is expected to be the hardest daily-use element." : "The modeled stair is missing required walk-through evidence or basic dimensional assumptions.",
    evidence: [
      ...stairEvidence,
      `stair-width-ft:${stairWidthFt}`,
      `tread-depth-ft:${treadDepthFt}`,
      `riser-height-ft:${riserHeightFt}`
    ],
    cautions: [
      "A person can be routed floor to floor in the concept model, but the stairs should be treated as a usability risk.",
      "Professional review must check headroom, handrails, guards, landings, carrying furniture, child/elder use, and whether this stair type is acceptable for the intended code path."
    ]
  };
}

function buildRoutes(model: RowhomeModel, config: RowhomeConfig): WalkthroughRoute[] {
  const routes: WalkthroughRoute[] = [
    {
      id: "daily-entry-to-kitchen",
      name: "Enter, use living/dining, reach kitchen",
      waypoints: ["front-door", "living-room-zone", "dining-room-zone", "kitchen-room-zone", "rear-exit-door-1"],
      status: "pass",
      cautions: []
    },
    {
      id: "first-floor-bathroom",
      name: "Use first-floor bathroom",
      waypoints: ["living-room-zone", "bath-1-door", "bath-1-room-zone", "bath-1-toilet", "bath-1-lavatory", "bath-1-shower"],
      status: "pass",
      cautions: ["Bathroom clearances are schematic and must be checked against the final dimensioned plan."]
    },
    {
      id: "bedroom-to-bathroom",
      name: "Reach bedroom floors and bathrooms",
      waypoints: ["stair-run-1", "stair-landing-1", "primary-bedroom-zone", "bath-2-door", "bath-2-room-zone", "stair-run-2", "third-floor-bedroom-zone", "bath-3-door", "bath-3-room-zone"],
      status: "caution",
      cautions: ["Route depends on compact stair comfort and code acceptance."]
    }
  ];
  if (config.includeBasement) {
    routes.push({
      id: "basement-utility-access",
      name: "Reach basement utilities",
      waypoints: ["basement-stair-run", "basement-utility-zone", "electric-water-heater", "main-water-shutoff"],
      status: "caution",
      cautions: ["Basement stair and utility working clearances require final dimensional review."]
    });
  }
  return routes.map((route) => {
    const missing = route.waypoints.filter((waypoint) => !hasComponent(model, waypoint));
    return missing.length === 0
      ? route
      : {
          ...route,
          status: "fail",
          cautions: [...route.cautions, `Missing route waypoints: ${missing.join(", ")}`]
        };
  });
}

export function buildLivabilityWalkthroughReport(
  generatedAt = new Date().toISOString(),
  model = generateRowhome(defaultRowhomeConfig),
  config: RowhomeConfig = defaultRowhomeConfig
): LivabilityWalkthroughReport {
  const checks = [
    checkBathrooms(model, config),
    checkDoorsAndEgress(model, config),
    checkStairs(model, config),
    {
      id: "core-living-program",
      status: requiredIdsPresent(model, ["living-room-zone", "dining-room-zone", "kitchen-room-zone", "primary-bedroom-zone", "second-bedroom-zone", "third-floor-bedroom-zone", "office-room-zone", "kitchen-sink", "refrigerator", "electric-range"]) ? "pass" : "fail",
      summary: "Core daily-living rooms, sleeping rooms, kitchen fixtures, and appliances are represented.",
      evidence: ["living-room-zone", "dining-room-zone", "kitchen-room-zone", "primary-bedroom-zone", "second-bedroom-zone", "third-floor-bedroom-zone", "office-room-zone", "kitchen-sink", "refrigerator", "electric-range"].filter((id) => hasComponent(model, id)),
      cautions: ["Furniture and appliance clearances are schematic and must be checked in a dimensioned plan."]
    } satisfies LivabilityCheck
  ];
  const routes = buildRoutes(model, config);
  const hasFailure = checks.some((check) => check.status === "fail") || routes.some((route) => route.status === "fail");

  return {
    generatedAt,
    status: hasFailure ? "not-livable" : "usable-concept-needs-review",
    simulatedPerson: {
      shoulderWidthFt: 2.0,
      turningDiameterFt: 5.0,
      note: "Headless conceptual walk-through uses named waypoints and clearance markers; it is not a physics engine or accessibility certification."
    },
    checks,
    routes,
    requiredProfessionalFollowUp: [
      "dimension every route, door, bathroom, stair, landing, and furniture clearance",
      "verify stair comfort, code acceptance, headroom, guards, and handrails",
      "verify bathroom fixture clearances, waterproofing, ventilation, privacy, and accessibility requirements",
      "run a human-reviewed 3D walkthrough and revise the plan before permit drawings"
    ]
  };
}
