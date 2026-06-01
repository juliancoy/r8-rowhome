import type { ModelComponent } from "../core/types";

export type ViewMode =
  | "all"
  | "electrical"
  | "hvac"
  | "wood-structure"
  | "load-bearing"
  | "envelope"
  | "fire"
  | "insulation"
  | "interior"
  | "site"
  | "architecture";

export interface ViewLayerOption {
  id: ViewMode;
  label: string;
  notes: string;
}

export const viewLayerOptions: ViewLayerOption[] = [
  {
    id: "all",
    label: "Full model",
    notes: "Shows every generated component."
  },
  {
    id: "electrical",
    label: "Electrical",
    notes: "Panel, service, copper conductors, branch circuits, outlets, and electric equipment feeds."
  },
  {
    id: "hvac",
    label: "HVAC and ventilation",
    notes: "Heat pump, air handler, refrigerant lines, ducts, registers, and exhaust paths."
  },
  {
    id: "wood-structure",
    label: "Wood structure",
    notes: "Engineered wood framing, wood studs, sheathing, stair framing, guards, rails, and other structural wood."
  },
  {
    id: "load-bearing",
    label: "Load bearing",
    notes: "Foundation, party walls, rear wall, structural backup, floor plates, roof deck, lintels, and columns."
  },
  {
    id: "envelope",
    label: "Envelope",
    notes: "Facade, roof, exterior walls, windows, doors, weather barrier, waterproofing, and exterior insulation."
  },
  {
    id: "fire",
    label: "Fire protection",
    notes: "Type X gypsum, fireblocking, fire/acoustic mineral wool, party-wall protection, guards, and rated membranes."
  },
  {
    id: "insulation",
    label: "Insulation",
    notes: "Thermal, acoustic, roof, wall, rim joist, and below-grade insulation and air-sealing layers."
  },
  {
    id: "interior",
    label: "Interior and fixtures",
    notes: "Rooms, partitions, furniture, cabinets, appliances, and interior finishes."
  },
  {
    id: "site",
    label: "Site and landscape",
    notes: "Lot, rear yard, stoop, equipment pads, tree, and landscape surfaces."
  },
  {
    id: "architecture",
    label: "Architecture only",
    notes: "Architectural model without electrical or HVAC systems."
  }
];

function componentText(component: ModelComponent): string {
  const notes = component.metadata.notes?.join(" ") ?? "";
  return `${component.metadata.id} ${component.metadata.name} ${component.metadata.category} ${component.metadata.material} ${notes}`.toLowerCase();
}

export function componentMatchesViewMode(component: ModelComponent, viewMode: ViewMode): boolean {
  const text = componentText(component);

  if (viewMode === "all") {
    return true;
  }
  if (viewMode === "electrical") {
    return component.metadata.category === "electrical" || /\b(electric|electrical|panelboard|breaker|load center|junction box|device box|switch box|receptacle|copper|awg|nm-b|service mast|weatherhead|meter|disconnect|conduit|raceway|bus bar|outlet)\b/.test(text);
  }
  if (viewMode === "hvac") {
    return /\b(heat pump|air handler|duct|register|exhaust|refrigerant|lineset|ventilation|cooling|heating|condenser)\b/.test(text);
  }
  if (viewMode === "wood-structure") {
    return /\b(engineered wood|wood stud|wood framing|wood stair|wood guard|wood handrail|wood landing|wood backup|sheathing|plywood|osb)\b/.test(text);
  }
  if (viewMode === "load-bearing") {
    return /\b(foundation|party wall|rear wall|structural backup|floor plate|roof deck|slab|lintel|masonry|cmu|reinforced concrete|load-bearing)\b/.test(text);
  }
  if (viewMode === "envelope") {
    return component.metadata.category === "facade"
      || component.metadata.category === "roof"
      || /\b(exterior|front wall|rear wall|facade|roof|window|door|glazing|weather|waterproofing|wrb|barrier|insulation|parapet|coping|sill|lintel)\b/.test(text);
  }
  if (viewMode === "fire") {
    return /\b(type x|gypsum.*fire|fire|fireblocking|mineral wool|party wall|guard|handrail|rated membrane)\b/.test(text);
  }
  if (viewMode === "insulation") {
    return /\b(insulation|air barrier|air seal|mineral wool|dense-pack|rigid insulation|spray foam|thermal|acoustic)\b/.test(text);
  }
  if (viewMode === "interior") {
    return component.metadata.category === "interior" || /\b(partition|gypsum wallboard|cabinet|countertop|appliance|sofa|table|tv|bed|sink|range|refrigerator)\b/.test(text);
  }
  if (viewMode === "site") {
    return component.metadata.category === "site" || component.metadata.category === "landscape" || /\b(stoop|yard|tree|site|pad|landscape)\b/.test(text);
  }

  return component.metadata.category !== "electrical" && !componentMatchesViewMode(component, "hvac");
}
