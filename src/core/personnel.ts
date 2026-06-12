import type { ConstructionSystem, ModelComponent, RowhomeConfig } from "./types";
import { selectedConstructionSystem } from "./constructionSystems";

export interface PersonnelRole {
  id: string;
  title: string;
  /** Which construction systems require this role. */
  constructionSystems: ConstructionSystem[];
  /** Concrete skills the employee(s) in this role must hold. */
  skills: string[];
  /** Additional skills required only for a specific construction system. */
  systemSkills?: Partial<Record<ConstructionSystem, string[]>>;
  marylandCredential: string;
  crewSize: { minimum: number; typical: number };
  /** SOW phase sequences this role staffs. */
  phases: number[];
  /**
   * Rough-order labor cost as a multiple of the material cost this role claims.
   * Used by the investor pro forma; illustrative, not an estimate of record.
   */
  laborFactor: number;
  scopeSummary: string;
  /** Claims model components for quantity/cost rollup; first matching role wins. */
  matches: (component: ModelComponent) => boolean;
}

function materialMatches(component: ModelComponent, pattern: RegExp): boolean {
  return pattern.test(component.metadata.material) || pattern.test(component.metadata.name);
}

/**
 * Personnel database for the R-8 rowhome statement of work.
 * Order matters: when rolling up model components into role quantities,
 * earlier roles claim components first.
 */
export const personnelRoles: PersonnelRole[] = [
  {
    id: "general-contractor",
    laborFactor: 0.0,
    title: "General contractor / site superintendent",
    constructionSystems: ["masonry-wood", "steel-concrete"],
    skills: [
      "construction scheduling and trade coordination",
      "permit and inspection management",
      "party-wall preconstruction survey coordination",
      "safety program administration (OSHA 30)",
      "submittal, RFI, and closeout administration"
    ],
    marylandCredential:
      "Maryland Home Builder Registration (new dwelling) or MHIC license; Baltimore City contractor registration; insurance per permit requirements.",
    crewSize: { minimum: 1, typical: 1 },
    phases: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    scopeSummary: "Overall construction management, schedule, safety, inspections, and closeout.",
    matches: () => false
  },
  {
    id: "sitework-operator",
    laborFactor: 0.7,
    title: "Sitework and excavation crew",
    constructionSystems: ["masonry-wood", "steel-concrete"],
    skills: [
      "urban infill excavation and excavation support",
      "erosion and sediment control installation",
      "grading and positive-drainage shaping",
      "sidewalk, curb, and right-of-way restoration",
      "utility trench coordination"
    ],
    marylandCredential: "Licensed contractor; MDE responsible-personnel certification for erosion and sediment control.",
    crewSize: { minimum: 2, typical: 3 },
    phases: [2, 9],
    scopeSummary: "Site preparation, excavation, drainage, and exterior flatwork.",
    matches: (component) => component.metadata.category === "site"
  },
  {
    id: "steel-erector",
    laborFactor: 0.7,
    title: "Ironworker / structural steel erector",
    constructionSystems: ["steel-concrete"],
    skills: [
      "structural steel rigging and erection",
      "high-strength bolting and torque verification",
      "AWS D1.1 field welding",
      "metal deck placement and fastening",
      "plumb, line, and grade alignment survey",
      "leading-edge fall protection"
    ],
    marylandCredential:
      "Maryland-licensed contractor with AISC-aligned erection competency; AWS-certified welders; special inspections per the approved statement of special inspections.",
    crewSize: { minimum: 4, typical: 5 },
    phases: [4],
    scopeSummary: "Steel columns, beams, girders, connections, erection bracing, and metal deck.",
    matches: (component) => materialMatches(component, /steel column|steel beam|steel girder|metal deck/i)
  },
  {
    id: "reinforcing-ironworker",
    laborFactor: 0.8,
    title: "Reinforcing ironworker (rodbuster)",
    constructionSystems: ["steel-concrete"],
    skills: [
      "rebar interpretation from placing drawings",
      "tying, chairing, and supporting reinforcement",
      "embed plate and dowel placement",
      "ACI placement tolerance compliance"
    ],
    marylandCredential: "Contractor with certified ironworkers; special-inspection coordination for reinforcement placement.",
    crewSize: { minimum: 2, typical: 3 },
    phases: [3, 4],
    scopeSummary: "Reinforcement for concrete party walls, rear walls, and slabs on metal deck.",
    matches: (component) => materialMatches(component, /reinforced concrete (?:party|rear) wall/i)
  },
  {
    id: "concrete-finisher",
    laborFactor: 0.75,
    title: "Concrete formwork and finishing crew",
    constructionSystems: ["masonry-wood", "steel-concrete"],
    skills: [
      "footing and wall formwork",
      "cast-in-place concrete placement and consolidation",
      "flatwork screeding and finishing",
      "curing and cold/hot weather protection",
      "anchor bolt and embed setting"
    ],
    systemSkills: {
      "steel-concrete": ["elevated composite slab placement on metal deck", "concrete pump coordination"]
    },
    marylandCredential: "MHIC-licensed contractor with concrete trade competency; ACI finisher certification recommended.",
    crewSize: { minimum: 3, typical: 5 },
    phases: [3, 4],
    scopeSummary: "Footings, foundation walls, basement slab, and structural concrete placement.",
    matches: (component) => materialMatches(component, /concrete|footing|foundation|slab|bearing pad/i)
  },
  {
    id: "mason",
    laborFactor: 0.9,
    title: "Brick and CMU mason",
    constructionSystems: ["masonry-wood"],
    skills: [
      "running-bond brick laying to Baltimore rowhouse coursing",
      "CMU party-wall construction",
      "mortar mixing and joint tooling",
      "through-wall flashing and weep installation",
      "stone lintel, sill, and belt-course setting",
      "historic facade repointing"
    ],
    marylandCredential: "MHIC-licensed masonry contractor.",
    crewSize: { minimum: 3, typical: 4 },
    phases: [4, 5],
    scopeSummary: "Masonry party and rear walls, facade brick, lintels, sills, and coping.",
    matches: (component) => materialMatches(component, /brick|masonry|cmu|mortar|formstone|stone/i)
  },
  {
    id: "rough-framer",
    laborFactor: 0.85,
    title: "Rough framing carpenter",
    constructionSystems: ["masonry-wood"],
    skills: [
      "engineered wood joist and rim layout",
      "stair opening header and trimmer framing",
      "ledger and joist-hanger installation into masonry",
      "subfloor and roof deck sheathing",
      "temporary shoring and bracing"
    ],
    marylandCredential: "MHIC-licensed contractor.",
    crewSize: { minimum: 3, typical: 4 },
    phases: [4],
    scopeSummary: "Engineered wood floor and roof framing and stair rough openings.",
    matches: (component) => materialMatches(component, /wood framing|engineered wood|joist/i) && component.metadata.category !== "interior"
  },
  {
    id: "roofer",
    laborFactor: 0.8,
    title: "Roofing and waterproofing crew",
    constructionSystems: ["masonry-wood", "steel-concrete"],
    skills: [
      "low-slope membrane installation",
      "parapet flashing and coping detailing",
      "roof drainage and penetration sealing",
      "below-grade waterproofing application"
    ],
    marylandCredential: "MHIC-licensed roofing contractor.",
    crewSize: { minimum: 2, typical: 3 },
    phases: [5],
    scopeSummary: "Flat roof membrane, parapets, flashing, and waterproofing.",
    matches: (component) => component.metadata.category === "roof" && !materialMatches(component, /solar|pv/i)
  },
  {
    id: "solar-installer",
    laborFactor: 0.6,
    title: "Solar PV and energy storage installer",
    constructionSystems: ["masonry-wood", "steel-concrete"],
    skills: [
      "roof-mount PV racking and module installation",
      "DC string wiring and rapid-shutdown equipment",
      "hybrid inverter and battery commissioning",
      "utility interconnection procedures"
    ],
    marylandCredential:
      "Works under the Maryland Master Electrician for interconnection; NABCEP certification recommended; utility and AHJ interconnection approval.",
    crewSize: { minimum: 2, typical: 3 },
    phases: [6],
    scopeSummary: "Roof PV array, raceways, hybrid inverter, and battery storage.",
    matches: (component) => materialMatches(component, /solar|photovoltaic|pv |pv-|battery/i)
  },
  {
    id: "electrician",
    laborFactor: 1.1,
    title: "Licensed electrician crew",
    constructionSystems: ["masonry-wood", "steel-concrete"],
    skills: [
      "200 A all-electric service and panel installation",
      "NM-B branch-circuit rough-in and device trim",
      "240 V appliance circuit installation",
      "AFCI/GFCI selection and grounding/bonding",
      "low-voltage HVAC control wiring"
    ],
    systemSkills: {
      "steel-concrete": ["raceway and box installation in concrete and steel-stud construction", "core-drill coordination with structural engineer"]
    },
    marylandCredential: "Maryland State Master Electrician plus Baltimore City electrical registration; journeymen under master supervision.",
    crewSize: { minimum: 1, typical: 2 },
    phases: [6, 8, 10],
    scopeSummary: "Service, panel, branch circuits, devices, luminaires, and controls.",
    matches: (component) => component.metadata.category === "electrical"
  },
  {
    id: "plumber",
    laborFactor: 1.1,
    title: "Licensed plumber crew",
    constructionSystems: ["masonry-wood", "steel-concrete"],
    skills: [
      "water service and PEX/copper distribution",
      "DWV layout, slope, and venting",
      "fixture setting and trim",
      "heat pump water heater installation",
      "backflow prevention"
    ],
    marylandCredential: "Maryland State Board of Plumbing Master Plumber plus Baltimore City registration.",
    crewSize: { minimum: 1, typical: 2 },
    phases: [3, 6, 8, 10],
    scopeSummary: "Water service, distribution, DWV, fixtures, and water heater.",
    matches: (component) =>
      component.metadata.category === "systems" &&
      materialMatches(component, /plumb|pipe|pex|dwv|water service|water heater|sink|toilet|lavatory|shower|faucet|sump/i)
  },
  {
    id: "hvacr-mechanic",
    laborFactor: 0.9,
    title: "Licensed HVACR mechanic crew",
    constructionSystems: ["masonry-wood", "steel-concrete"],
    skills: [
      "heat pump and air handler installation",
      "sheet-metal duct fabrication and sealing",
      "refrigerant line brazing and charging (EPA 608)",
      "ventilation and exhaust termination",
      "system balancing to design CFM"
    ],
    marylandCredential: "Maryland HVACR Board Master license plus Baltimore City mechanical registration.",
    crewSize: { minimum: 1, typical: 2 },
    phases: [6, 10],
    scopeSummary: "Heat pump equipment, ductwork, ventilation, and controls.",
    matches: (component) =>
      component.metadata.category === "systems" &&
      materialMatches(component, /duct|heat pump|air handler|condenser|refrigerant|hvac|exhaust|plenum|register|grille/i)
  },
  {
    id: "sprinkler-fitter",
    laborFactor: 1.0,
    title: "Fire sprinkler fitter",
    constructionSystems: ["masonry-wood", "steel-concrete"],
    skills: [
      "residential sprinkler layout (IRC P2904 / NFPA 13D)",
      "CPVC and PEX sprinkler piping",
      "head placement and obstruction coordination",
      "hydrostatic testing"
    ],
    marylandCredential: "Maryland State Fire Marshal licensed fire protection contractor.",
    crewSize: { minimum: 1, typical: 2 },
    phases: [6, 10],
    scopeSummary: "Residential fire sprinkler system required for new Maryland dwellings; not yet modeled in geometry.",
    matches: () => false
  },
  {
    id: "interiors-carpenter",
    laborFactor: 1.0,
    title: "Interiors and finish carpentry crew",
    constructionSystems: ["masonry-wood", "steel-concrete"],
    skills: [
      "partition layout and framing",
      "gypsum board hanging and finishing",
      "stair, guard, and handrail finish installation",
      "door, trim, and casework installation",
      "insulation and air-sealing installation"
    ],
    systemSkills: {
      "masonry-wood": ["2x4 wood stud partition framing"],
      "steel-concrete": ["cold-formed steel stud partition framing", "powder-actuated fastening to concrete"]
    },
    marylandCredential: "MHIC-licensed contractor.",
    crewSize: { minimum: 3, typical: 4 },
    phases: [7, 8],
    scopeSummary: "Interior partitions, gypsum, stairs, doors, trim, and finishes.",
    matches: (component) => component.metadata.category === "interior" || component.metadata.category === "circulation"
  },
  {
    id: "landscaper",
    laborFactor: 0.9,
    title: "Landscaping crew",
    constructionSystems: ["masonry-wood", "steel-concrete"],
    skills: [
      "street tree planting per city forestry standards",
      "pervious surface installation",
      "planting zone preparation and drainage"
    ],
    marylandCredential: "Maryland licensed tree expert for right-of-way tree work; Baltimore City forestry coordination.",
    crewSize: { minimum: 2, typical: 2 },
    phases: [9],
    scopeSummary: "Street tree, planting zones, and rear yard finishes.",
    matches: (component) => component.metadata.category === "landscape"
  }
];

export function rolesForSystem(system: ConstructionSystem): PersonnelRole[] {
  return personnelRoles.filter((role) => role.constructionSystems.includes(system));
}

export interface RoleAssignment {
  role: PersonnelRole;
  components: ModelComponent[];
  materialCostUsd: number;
}

/**
 * Rolls model components up into personnel roles, first matching role wins,
 * so each component's cost is counted exactly once across the roster.
 */
export function assignComponentsToRoles(components: ModelComponent[], roles: PersonnelRole[]): RoleAssignment[] {
  const assigned = new Set<string>();
  return roles.map((role) => {
    const matched = components.filter((component) => !assigned.has(component.metadata.id) && role.matches(component));
    for (const component of matched) {
      assigned.add(component.metadata.id);
    }
    return {
      role,
      components: matched,
      materialCostUsd: matched.reduce((sum, component) => sum + component.metadata.estimatedCostUsd, 0)
    };
  });
}

export function skillsForRole(role: PersonnelRole, system: ConstructionSystem): string[] {
  return [...role.skills, ...(role.systemSkills?.[system] ?? [])];
}

export function rolesForConfig(config: RowhomeConfig): PersonnelRole[] {
  return rolesForSystem(selectedConstructionSystem(config).id);
}
