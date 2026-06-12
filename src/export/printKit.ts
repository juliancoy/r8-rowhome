import { Group } from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { defaultRowhomeConfig } from "../core/config";
import { generateRowhome } from "../generators/rowhome";
import { defaultPrintProfile, printKitFor, printKitLabels } from "../reports/printPreflight";
import type { ConstructionSystem, ModelComponent } from "../core/types";

export interface PrintKitFile {
  kitId: string;
  label: string;
  filename: string;
  componentCount: number;
  stlText: string;
}

export interface PrintKitManifestEntry {
  kitId: string;
  label: string;
  filename: string;
  componentCount: number;
  recommendedHandling: string;
}

export interface PrintKitExport {
  constructionSystem: ConstructionSystem;
  scale: string;
  millimetersPerFoot: number;
  printedComponentCount: number;
  excludedComponentCount: number;
  kits: PrintKitFile[];
  manifest: PrintKitManifestEntry[];
}

const recommendedHandling: Record<string, string> = {
  "site-base": "Print flat as the display base; other kits register on top of it.",
  "shell-envelope": "Largest kit; consider splitting into removable facade/roof plates in the slicer.",
  "structure-egress": "Verify stair and guard features survive slicing at this scale.",
  "mep-overlays": "Many ducts, pipes, and wires are below normal FDM feature size; print enlarged or as simplified overlays.",
  "interiors-fixtures": "Optional interior detail kit; print with fine nozzle.",
  miscellaneous: "Review part-by-part before slicing."
};

function kitStl(components: ModelComponent[], millimetersPerFoot: number): string {
  const group = new Group();
  for (const component of components) {
    group.add(component.object.clone(true));
  }
  group.scale.setScalar(millimetersPerFoot);
  group.updateMatrixWorld(true);
  const exporter = new STLExporter();
  return exporter.parse(group, { binary: false }) as string;
}

export function buildPrintKitExport(constructionSystem: ConstructionSystem): PrintKitExport {
  const model = generateRowhome({ ...defaultRowhomeConfig, constructionSystem });
  const millimetersPerFoot = 304.8 / defaultPrintProfile.scaleDenominator;

  const printable = model.components.filter((component) => component.metadata.printable);
  const excludedComponentCount = model.components.length - printable.length;

  const byKit = new Map<string, ModelComponent[]>();
  for (const component of printable) {
    const kitId = printKitFor(component);
    byKit.set(kitId, [...(byKit.get(kitId) ?? []), component]);
  }

  const kits: PrintKitFile[] = [...byKit.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kitId, components]) => ({
      kitId,
      label: printKitLabels[kitId] ?? kitId,
      filename: `r8-rowhome-${constructionSystem}-${kitId}.stl`,
      componentCount: components.length,
      stlText: kitStl(components, millimetersPerFoot)
    }));

  return {
    constructionSystem,
    scale: defaultPrintProfile.scale,
    millimetersPerFoot,
    printedComponentCount: printable.length,
    excludedComponentCount,
    kits,
    manifest: kits.map((kit) => ({
      kitId: kit.kitId,
      label: kit.label,
      filename: kit.filename,
      componentCount: kit.componentCount,
      recommendedHandling: recommendedHandling[kit.kitId] ?? "Review before slicing."
    }))
  };
}
