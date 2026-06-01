import { Group } from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import type { ModelComponent, RowhomeModel } from "../core/types";

export function exportComponentStl(component: ModelComponent): string {
  const exporter = new STLExporter();
  const clone = component.object.clone(true);
  clone.updateMatrixWorld(true);
  return exporter.parse(clone, { binary: false }) as string;
}

export function exportModelStl(model: RowhomeModel): string {
  const group = new Group();
  for (const component of model.components) {
    if (component.metadata.printable) {
      group.add(component.object.clone(true));
    }
  }
  group.updateMatrixWorld(true);
  const exporter = new STLExporter();
  return exporter.parse(group, { binary: false }) as string;
}

export function downloadTextFile(filename: string, contents: string, mimeType: string): void {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

