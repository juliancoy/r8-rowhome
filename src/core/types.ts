import type { BufferGeometry, Object3D } from "three";

export type ComponentCategory =
  | "site"
  | "structure"
  | "facade"
  | "roof"
  | "circulation"
  | "interior"
  | "electrical"
  | "systems"
  | "landscape";

export type ValidationSeverity = "warning" | "error";
export type StairImplementation = "alternating-run" | "spiral";

export interface ValidationMessage {
  severity: ValidationSeverity;
  code: string;
  message: string;
  source: string;
}

export interface ComponentMetadata {
  id: string;
  name: string;
  category: ComponentCategory;
  material: string;
  source: string;
  estimatedCostUsd: number;
  printable: boolean;
  notes?: string[];
}

export interface ModelComponent {
  metadata: ComponentMetadata;
  object: Object3D;
  geometry?: BufferGeometry;
}

export interface RowhomeModel {
  name: string;
  units: "feet";
  components: ModelComponent[];
  validation: ValidationMessage[];
}

export interface RowhomeConfig {
  lotWidthFt: number;
  lotDepthFt: number;
  buildingWidthFt: number;
  buildingDepthFt: number;
  stories: number;
  storyHeightFt: number;
  includeBasement: boolean;
  basementDepthFt: number;
  includeTree: boolean;
  facadeMaterialId: string;
  facadeStyleId: string;
  stairImplementation: StairImplementation;
}

export interface BomLine {
  material: string;
  category: ComponentCategory;
  components: number;
  estimatedCostUsd: number;
}

export interface ViewOptions {
  invertDragHorizontal: boolean;
  invertDragVertical: boolean;
  dragSensitivity: number;
}
