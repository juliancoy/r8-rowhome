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
export type StructuralSupportScheme = "masonry-bearing" | "steel-post-beam";
export type BrickDetailMode = "solid-textured" | "individual-bricks";
export type ConstructionSystem = "masonry-wood" | "steel-concrete";
export type UrbanScale = "single" | "block-32" | "district-128";
export type RenderMaterialStyle =
  | "standard"
  | "brushed-metal"
  | "polished-metal"
  | "iridescent"
  | "pearl"
  | "glass"
  | "emissive"
  | "hologram"
  | "xray"
  | "phong"
  | "toon"
  | "normal"
  | "wireframe";

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
  realProductModel?: RealProductModel;
  quantity?: ComponentQuantity;
  ownership?: ComponentOwnership;
}

export interface ComponentOwnership {
  scope: "detailed-building" | "urban-building-instances" | "urban-context";
  role: string;
  buildingInstanceIds?: string[];
  replicatedFromComponentIds?: string[];
}

export interface ComponentQuantity {
  kind: "standard-brick";
  count: number;
  unit: "each";
  actualSizeIn: {
    length: number;
    width: number;
    height: number;
  };
  nominalModuleIn: {
    length: number;
    height: number;
  };
}

export interface ModelComponent {
  metadata: ComponentMetadata;
  object: Object3D;
  geometry?: BufferGeometry;
}

export interface RealProductModel {
  url: string;
  productUrl: string;
  brand: string;
  productName: string;
  articleNumber?: string;
  source: string;
  license?: string;
  usageNote: string;
  replacePlaceholder: boolean;
  hideComponentIds?: string[];
}

export interface StructuralNode {
  id: string;
  xFt: number;
  yFt: number;
  zFt: number;
}

export type StructuralMemberKind =
  | "wall-line"
  | "floor-diaphragm"
  | "roof-diaphragm"
  | "foundation-line"
  | "stair-opening-header"
  | "stair-shaft-post"
  | "diaphragm-collector"
  | "bearing-pad"
  | "steel-column"
  | "steel-beam";

export interface StructuralMember {
  id: string;
  name: string;
  kind: StructuralMemberKind;
  startNodeId: string;
  endNodeId: string;
  materialId: string;
  sectionId: string;
  componentIds: string[];
  source: string;
}

export interface StructuralMaterial {
  id: string;
  name: string;
  densityPcf: number;
  elasticModulusKsi: number;
  source: string;
}

export interface StructuralSection {
  id: string;
  name: string;
  areaSqFt: number;
  momentOfInertiaFt4: number;
  source: string;
}

export interface StructuralSupport {
  nodeId: string;
  restraint: {
    x: boolean;
    y: boolean;
    z: boolean;
    rx: boolean;
    ry: boolean;
    rz: boolean;
  };
  source: string;
}

export interface StructuralLoadCase {
  id: string;
  name: string;
  category: "dead" | "live" | "roof-live";
  source: string;
}

export interface StructuralAreaLoad {
  id: string;
  loadCaseId: string;
  targetMemberId: string;
  description: string;
  areaSqFt: number;
  loadPsf: number;
  totalKips: number;
  source: string;
}

export interface StructuralGravityReport {
  totalDeadLoadKips: number;
  totalLiveLoadKips: number;
  totalGravityLoadKips: number;
  floorDeadLoadKips: number;
  floorLiveLoadKips: number;
  roofDeadLoadKips: number;
  roofLiveLoadKips: number;
  floorAreaSqFt: number;
  roofAreaSqFt: number;
  wallDeadLoadKips: number;
  steelSupportDeadLoadKips: number;
}

export type StructuralDemandSurfaceKind = "floor-area" | "roof-area" | "wall-line";

export interface StructuralDemandSurface {
  id: string;
  label: string;
  kind: StructuralDemandSurfaceKind;
  demandKips: number;
  areaSqFt: number;
  demandPsf: number;
  intensity: number;
  bounds: {
    xMinFt: number;
    xMaxFt: number;
    yMinFt: number;
    yMaxFt: number;
    zMinFt: number;
    zMaxFt: number;
  };
  source: string;
  note: string;
}

export interface StructuralLoadCombination {
  id: string;
  name: string;
  method: "service" | "strength";
  expression: string;
  totalKips: number;
  status: "computed-gravity-only" | "blocked-requires-lateral-model";
  source: string;
  notes: string[];
}

export interface StructuralDesignCheck {
  id: string;
  label: string;
  category: "stability" | "strength" | "serviceability" | "foundation" | "lateral" | "fire-protection" | "connection";
  targetIds: string[];
  status: "not-evaluated" | "blocked-requires-solver" | "blocked-requires-design-input";
  source: string;
  requirement: string;
  missingInputs: string[];
}

export interface StructuralSolverStatus {
  selectedSolver: "none";
  readyForSolver: boolean;
  requiredNextStep: string;
  missingInputs: string[];
}

export interface StructuralModel {
  units: "feet-kips";
  status: "conceptual-load-model";
  nodes: StructuralNode[];
  members: StructuralMember[];
  materials: StructuralMaterial[];
  sections: StructuralSection[];
  supports: StructuralSupport[];
  loadCases: StructuralLoadCase[];
  areaLoads: StructuralAreaLoad[];
  assumptions: string[];
  warnings: string[];
  gravityReport: StructuralGravityReport;
  demandSurfaces: StructuralDemandSurface[];
  loadCombinations: StructuralLoadCombination[];
  designChecks: StructuralDesignCheck[];
  solverStatus: StructuralSolverStatus;
}

export interface RowhomeModel {
  name: string;
  units: "feet";
  components: ModelComponent[];
  structural?: StructuralModel;
  hierarchy?: ModelHierarchy;
  validation: ValidationMessage[];
}

export interface BuildingInstance {
  id: string;
  block: number;
  row: number;
  position: number;
  xFt: number;
  yFt: number;
  widthFt: number;
  depthFt: number;
  flipped: boolean;
  componentIds: string[];
}

export interface ModelHierarchy {
  mode: "single-building" | "row-assembly" | "urban-block";
  buildingInstances: BuildingInstance[];
  hiddenDetailedComponentIds: string[];
  notes: string[];
}

export interface RowhomeConfig {
  rowhomeCount: number;
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
  structuralSupportScheme: StructuralSupportScheme;
  brickDetailMode: BrickDetailMode;
  constructionSystem: ConstructionSystem;
  urbanScale: UrbanScale;
}

export interface BomLine {
  material: string;
  category: ComponentCategory;
  components: number;
  estimatedCostUsd: number;
  quantity?: {
    kind: ComponentQuantity["kind"];
    count: number;
    unit: ComponentQuantity["unit"];
  };
}

export interface ViewOptions {
  invertDragHorizontal: boolean;
  invertDragVertical: boolean;
  cameraWallCollisions: boolean;
  showHvacSystem: boolean;
  showElectricalSystem: boolean;
  showFireEscape: boolean;
  dragSensitivity: number;
  ambientLightIntensity: number;
  roomLightIntensity: number;
  renderDetail: "fast" | "balanced" | "detailed";
  renderMaterial: RenderMaterialStyle;
}
