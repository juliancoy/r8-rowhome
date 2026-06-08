import { Box3, Vector3 } from "three";
import { defaultRowhomeConfig } from "../core/config";
import type { ModelComponent, RowhomeModel } from "../core/types";
import { generateRowhome } from "../generators/rowhome";

export interface PrintProfile {
  id: string;
  scale: string;
  scaleDenominator: number;
  minFeatureMm: number;
  minClearanceMm: number;
  maxBuildPlateMm: {
    x: number;
    y: number;
    z: number;
  };
}

export interface PrintComponentCheck {
  id: string;
  name: string;
  kit: string;
  printableFlag: boolean;
  scaledSizeMm: {
    x: number;
    y: number;
    z: number;
  };
  minScaledDimensionMm: number;
  status: "ok" | "too-thin" | "excluded-marker" | "requires-asset-review";
  notes: string[];
}

export interface PrintKit {
  id: string;
  label: string;
  componentCount: number;
  blockerCount: number;
  recommendedHandling: string;
}

export interface PrintPreflightReport {
  generatedAt: string;
  status: "preflight-not-slicer-ready" | "preflight-printable-with-exclusions";
  purpose: string;
  profile: PrintProfile;
  buildTomorrowReady: false;
  printableComponentCount: number;
  excludedComponentCount: number;
  blockerCount: number;
  kits: PrintKit[];
  checks: PrintComponentCheck[];
  requiredNextActions: string[];
}

export const defaultPrintProfile: PrintProfile = {
  id: "display-model-1-48-fdm",
  scale: "1:48",
  scaleDenominator: 48,
  minFeatureMm: 0.8,
  minClearanceMm: 0.4,
  maxBuildPlateMm: {
    x: 220,
    y: 220,
    z: 240
  }
};

function scaledSizeMm(component: ModelComponent, scaleDenominator: number): Vector3 {
  component.object.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(component.object);
  const size = new Vector3();
  bounds.getSize(size);
  return size.multiplyScalar(304.8 / scaleDenominator);
}

function printKitFor(component: ModelComponent): string {
  const id = component.metadata.id;
  const category = component.metadata.category;
  if (/sidewalk|road|yard|tree|landscape|stoop|grade|site/i.test(`${id} ${category}`)) {
    return "site-base";
  }
  if (/facade|wall|window|door|roof|parapet|cornice|envelope|insulation|gypsum|sheathing|weather/i.test(`${id} ${category} ${component.metadata.material}`)) {
    return "shell-envelope";
  }
  if (/floor|joist|stair|guard|rail|fire-escape|landing|stringer|tread|structure|foundation|column|beam|post/i.test(`${id} ${category} ${component.metadata.material}`)) {
    return "structure-egress";
  }
  if (/duct|pipe|electrical|circuit|panel|conduit|plumbing|hvac|supply|return|drain|vent|water|solar|battery/i.test(`${id} ${category} ${component.metadata.material}`)) {
    return "mep-overlays";
  }
  if (/bed|table|cabinet|appliance|fixture|bath|kitchen|interior|plant/i.test(`${id} ${category} ${component.metadata.material}`)) {
    return "interiors-fixtures";
  }
  return "miscellaneous";
}

function checkComponent(component: ModelComponent, profile: PrintProfile): PrintComponentCheck {
  const size = scaledSizeMm(component, profile.scaleDenominator);
  const dimensions = [size.x, size.y, size.z].filter((value) => value > 0.001);
  const minScaledDimensionMm = dimensions.length > 0 ? Math.min(...dimensions) : 0;
  const notes: string[] = [];
  let status: PrintComponentCheck["status"] = "ok";

  if (!component.metadata.printable) {
    status = "excluded-marker";
    notes.push("Component is intentionally non-printable metadata/review/clearance geometry.");
  } else if (component.metadata.realProductModel) {
    status = "requires-asset-review";
    notes.push("Runtime product asset or placeholder requires slicer review before physical printing.");
  } else if (minScaledDimensionMm < profile.minFeatureMm) {
    status = "too-thin";
    notes.push(`Minimum scaled feature ${minScaledDimensionMm.toFixed(2)} mm is below ${profile.minFeatureMm.toFixed(2)} mm profile threshold.`);
  }
  if (Math.max(size.x, size.y, size.z) > Math.max(profile.maxBuildPlateMm.x, profile.maxBuildPlateMm.y, profile.maxBuildPlateMm.z)) {
    notes.push("Component may need splitting or rotation for the selected build plate.");
  }

  return {
    id: component.metadata.id,
    name: component.metadata.name,
    kit: printKitFor(component),
    printableFlag: component.metadata.printable,
    scaledSizeMm: {
      x: Number(size.x.toFixed(2)),
      y: Number(size.y.toFixed(2)),
      z: Number(size.z.toFixed(2))
    },
    minScaledDimensionMm: Number(minScaledDimensionMm.toFixed(2)),
    status,
    notes
  };
}

function buildKits(checks: PrintComponentCheck[]): PrintKit[] {
  const labels: Record<string, string> = {
    "site-base": "Site and display base",
    "shell-envelope": "Shell, facade, roof, and envelope",
    "structure-egress": "Structure, stairs, guards, and egress",
    "mep-overlays": "MEP overlay parts",
    "interiors-fixtures": "Interior fixtures and furnishings",
    miscellaneous: "Miscellaneous small parts"
  };
  const byKit = new Map<string, PrintComponentCheck[]>();
  for (const check of checks.filter((item) => item.printableFlag)) {
    byKit.set(check.kit, [...(byKit.get(check.kit) ?? []), check]);
  }
  return [...byKit.entries()].map(([id, kitChecks]) => ({
    id,
    label: labels[id] ?? id,
    componentCount: kitChecks.length,
    blockerCount: kitChecks.filter((check) => check.status !== "ok").length,
    recommendedHandling: id === "mep-overlays"
      ? "Print as enlarged or simplified overlays; many ducts, pipes, and wires are below normal FDM feature size at architectural scale."
      : id === "shell-envelope"
        ? "Split into removable shell/facade/roof plates with alignment pins before slicing."
        : "Review orientation, supports, and grouping before export to slicer."
  })).sort((a, b) => a.id.localeCompare(b.id));
}

export function buildPrintPreflightReport(
  generatedAt = new Date().toISOString(),
  model: RowhomeModel = generateRowhome(defaultRowhomeConfig),
  profile: PrintProfile = defaultPrintProfile
): PrintPreflightReport {
  const checks = model.components.map((component) => checkComponent(component, profile));
  const blockers = checks.filter((check) => check.printableFlag && check.status !== "ok");
  return {
    generatedAt,
    status: blockers.length > 0 ? "preflight-not-slicer-ready" : "preflight-printable-with-exclusions",
    purpose: "3D-print preflight for a scaled physical display model. This checks print flags, scaled feature size, product-asset review needs, and recommended print kits; it does not repair meshes or generate slicer supports.",
    profile,
    buildTomorrowReady: false,
    printableComponentCount: checks.filter((check) => check.printableFlag).length,
    excludedComponentCount: checks.filter((check) => !check.printableFlag).length,
    blockerCount: blockers.length,
    kits: buildKits(checks),
    checks,
    requiredNextActions: [
      "choose final physical model scale and printer/process",
      "thicken or omit components below minimum feature size",
      "split model into print plates with alignment pins, sockets, and tolerances",
      "boolean-union or intentionally separate overlapping shells before slicing",
      "replace rendering GLB/product assets with watertight printable geometry",
      "run slicer preview and repair/manifold checks before printing"
    ]
  };
}
