import "./styles.css";

import {
  BackSide,
  Color,
  GridHelper,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { defaultRowhomeConfig } from "./core/config";
import { generateRowhome } from "./generators/rowhome";
import { modelGroup } from "./geometry/component";
import { exportComponentStl, exportModelStl, downloadTextFile } from "./export/stl";
import { exportModelMetadataJson } from "./export/json";
import { renderPanels, type PanelTab } from "./ui/panels";
import { createPreferredRenderer, toggleRenderer, type RendererMode } from "./viewer/renderers";
import { componentMatchesViewMode, type ViewMode } from "./viewer/layers";
import {
  animateDoor,
  animateWindow,
  createDoorAssemblies,
  createWindowAssemblies,
  doorAssemblyForComponent,
  isDoorLeafComponent,
  isFrontWindowComponent,
  toggleDoor,
  toggleWindow,
  windowAssemblyForComponent,
  type DoorAssembly,
  type WindowAssembly
} from "./viewer/door";
import { buildHouseLighting } from "./viewer/lighting";
import { buildStructuralDemandOverlay } from "./viewer/structuralOverlay";
import { attachRealProductModels, syncRealProductModelVisibility } from "./viewer/productModels";
import { navigationBoundsForComponents, resolveNavigationMove, type NavigationBounds } from "./viewer/navigation";
import {
  attachOccupantAsset,
  clampFollowCameraToSameSideOfWalls,
  createOccupantAvatar,
  occupantRoutes,
  routeById,
  updateOccupantAvatar,
  type OccupantRouteId,
  type OccupantWalkthroughState
} from "./viewer/occupantWalkthrough";
import type { BrickDetailMode, ModelComponent, RowhomeConfig, RowhomeModel, StairImplementation, StructuralSupportScheme, ViewOptions } from "./core/types";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("Missing #app root");
}

app.innerHTML = `
  <main class="layout">
    <section class="viewport">
      <div class="toolbar" role="toolbar" aria-label="Model viewer controls">
        <div class="toolbar-group" role="group" aria-label="Export">
          <button id="export-model-stl" type="button" title="Download the whole printable model as an STL file">Export STL</button>
          <button id="export-json" type="button" title="Download model metadata, BOM, and validation as JSON">Export JSON</button>
        </div>
        <label class="toolbar-field" for="view-preset-select" title="Jump to a fixed inspection view">
          <span>View</span>
          <select id="view-preset-select">
            <option value="model">3D model</option>
            <option value="gravity-demand">Gravity demand</option>
            <option value="top">Roof plan</option>
            <option value="front">Front elevation</option>
            <option value="left">Left elevation</option>
            <option value="right">Right elevation</option>
            <option value="back">Back elevation</option>
            <option value="interior">Interior perspective</option>
            <option value="review-sheet">Four-view sheet</option>
          </select>
        </label>
        <span id="render-mode" role="button" tabindex="0" title="Click to toggle between WebGL2 and WebGPU rendering">Renderer</span>
        <div class="toolbar-group" role="group" aria-label="Occupant walkthrough">
          <label class="toolbar-field toolbar-field-compact" for="walkthrough-route-select" title="Choose the occupant walkthrough route">
            <span>Walk</span>
            <select id="walkthrough-route-select"></select>
          </label>
          <button id="walkthrough-toggle" type="button" title="Watch a person walk the selected route through the house">Watch Person</button>
          <button id="walkthrough-follow" type="button" title="Keep the camera following the walking person">Follow</button>
        </div>
        <span id="selection" role="status" aria-live="polite" title="Click any part of the model to isolate it; press Escape to clear">No selection</span>
      </div>
      <canvas id="scene" tabindex="0" aria-label="3D rowhome model. Drag to look, W A S D to fly, Q and E for up and down, click parts to isolate."></canvas>
      <div class="status-toast" id="rebuild-status" role="status" aria-live="polite" hidden>
        <span class="status-spinner" aria-hidden="true"></span>
        Updating model…
      </div>
      <div class="review-sheet-overlay" id="review-sheet-overlay" hidden aria-hidden="true">
        <section class="review-sheet-cell review-sheet-cell-top">
          <strong>Roof Plan</strong>
          <span>Site context and roof equipment</span>
        </section>
        <section class="review-sheet-cell review-sheet-cell-front">
          <strong>Front Elevation</strong>
          <span>Street facade and stoop composition</span>
        </section>
        <section class="review-sheet-cell review-sheet-cell-side">
          <strong>Side Elevation</strong>
          <span>Party-wall side and depth</span>
        </section>
        <section class="review-sheet-cell review-sheet-cell-back">
          <strong>Back Elevation</strong>
          <span>Rear wall and egress condition</span>
        </section>
      </div>
      <aside class="structural-legend" id="structural-legend" aria-label="Structural demand legend" hidden>
        <strong>Relative gravity demand</strong>
        <div class="legend-gradient" aria-hidden="true"></div>
        <div class="legend-scale">
          <span>Lower</span>
          <span>Higher</span>
        </div>
        <small>Normalized conceptual load intensity only; not solved stress, capacity, or deflection.</small>
      </aside>
      <div class="flight-hud" aria-label="Fly camera keys" title="Fly the camera: W/A/S/D to move, Q/E for up and down, drag the scene to look around">
        <div class="key-grid">
          <span></span>
          <kbd data-key-hud="keyw">W</kbd>
          <span></span>
          <kbd data-key-hud="keyq">Q</kbd>
          <kbd data-key-hud="keya">A</kbd>
          <kbd data-key-hud="keys">S</kbd>
          <kbd data-key-hud="keyd">D</kbd>
          <kbd data-key-hud="keye">E</kbd>
        </div>
      </div>
      <div class="walkthrough-hud" id="walkthrough-hud" hidden aria-label="Walkthrough status"></div>
    </section>
    <aside class="panel" id="panel"></aside>
  </main>
`;

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing app element: ${selector}`);
  }
  return element;
}

const canvas = requireElement<HTMLCanvasElement>("#scene");
const panel = requireElement<HTMLElement>("#panel");
const selection = requireElement<HTMLElement>("#selection");
const renderMode = requireElement<HTMLElement>("#render-mode");
const structuralLegend = requireElement<HTMLElement>("#structural-legend");
const reviewSheetOverlay = requireElement<HTMLElement>("#review-sheet-overlay");
const exportModelButton = requireElement<HTMLButtonElement>("#export-model-stl");
const exportJsonButton = requireElement<HTMLButtonElement>("#export-json");
const viewPresetSelect = requireElement<HTMLSelectElement>("#view-preset-select");
const walkthroughRouteSelect = requireElement<HTMLSelectElement>("#walkthrough-route-select");
const walkthroughToggleButton = requireElement<HTMLButtonElement>("#walkthrough-toggle");
const walkthroughFollowButton = requireElement<HTMLButtonElement>("#walkthrough-follow");
const walkthroughHud = requireElement<HTMLElement>("#walkthrough-hud");
let orbitControls: OrbitControls | null = null;

declare global {
  interface Window {
    __r8RowhomeBenchmark?: {
      getRendererMode: () => RendererMode;
      setRendererMode: (mode: RendererMode) => Promise<RendererMode>;
      sampleFrames: (options?: { warmupFrames?: number; sampleFrames?: number }) => Promise<{
        mode: RendererMode;
        frames: number;
        averageFrameMs: number;
        medianFrameMs: number;
        p95FrameMs: number;
        minFrameMs: number;
        maxFrameMs: number;
        averageRenderMs: number;
        medianRenderMs: number;
        p95RenderMs: number;
        maxRenderMs: number;
      }>;
      sampleRenderCalls: (options?: { warmupCalls?: number; sampleCalls?: number }) => {
        mode: RendererMode;
        calls: number;
        averageRenderMs: number;
        medianRenderMs: number;
        p95RenderMs: number;
        minRenderMs: number;
        maxRenderMs: number;
      };
      getSceneStats: () => {
        components: number;
        objects: number;
        meshes: number;
        triangles: number;
        visibleObjects: number;
      };
      getRendererInfo: () => unknown;
    };
  }
}

const defaultViewOptions: ViewOptions = {
  invertDragHorizontal: false,
  invertDragVertical: false,
  dragSensitivity: 0.003,
  ambientLightIntensity: 1.8,
  roomLightIntensity: 2,
  renderDetail: "balanced"
};
const appOptionsStorageKey = "r8-rowhome.options.v2";

interface StoredAppOptions {
  config: RowhomeConfig;
  viewOptions: ViewOptions;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function loadStoredAppOptions(): StoredAppOptions {
  try {
    const raw = localStorage.getItem(appOptionsStorageKey);
    if (!raw) {
      return { config: { ...defaultRowhomeConfig }, viewOptions: { ...defaultViewOptions } };
    }
    const parsed = JSON.parse(raw) as Partial<{ config: Partial<RowhomeConfig>; viewOptions: Partial<ViewOptions> }>;
    const storedConfig = parsed.config ?? {};
    const storedViewOptions = parsed.viewOptions ?? {};
    return {
      config: {
        ...defaultRowhomeConfig,
        ...storedConfig,
        rowhomeCount: Math.max(1, Math.min(6, Math.round(finiteNumber(storedConfig.rowhomeCount, defaultRowhomeConfig.rowhomeCount)))),
        stories: finiteNumber(storedConfig.stories, defaultRowhomeConfig.stories),
        storyHeightFt: finiteNumber(storedConfig.storyHeightFt, defaultRowhomeConfig.storyHeightFt),
        basementDepthFt: finiteNumber(storedConfig.basementDepthFt, defaultRowhomeConfig.basementDepthFt),
        brickDetailMode: storedConfig.brickDetailMode === "individual-bricks" ? "individual-bricks" : "solid-textured",
        constructionSystem: storedConfig.constructionSystem === "steel-concrete" ? "steel-concrete" : "masonry-wood",
        urbanScale: storedConfig.urbanScale === "block-32" || storedConfig.urbanScale === "district-128" ? storedConfig.urbanScale : "single"
      },
      viewOptions: {
        ...defaultViewOptions,
        ...storedViewOptions,
        dragSensitivity: finiteNumber(storedViewOptions.dragSensitivity, defaultViewOptions.dragSensitivity),
        ambientLightIntensity: finiteNumber(storedViewOptions.ambientLightIntensity, defaultViewOptions.ambientLightIntensity),
        roomLightIntensity: finiteNumber(storedViewOptions.roomLightIntensity, defaultViewOptions.roomLightIntensity),
        renderDetail: storedViewOptions.renderDetail === "balanced" || storedViewOptions.renderDetail === "detailed"
          ? storedViewOptions.renderDetail
          : defaultViewOptions.renderDetail
      }
    };
  } catch {
    return { config: { ...defaultRowhomeConfig }, viewOptions: { ...defaultViewOptions } };
  }
}

function saveStoredAppOptions(config: RowhomeConfig, options: ViewOptions): void {
  try {
    localStorage.setItem(appOptionsStorageKey, JSON.stringify({ config, viewOptions: options }));
  } catch {
    // App options still work for the session if local storage is blocked.
  }
}

let { config: currentConfig, viewOptions } = loadStoredAppOptions();

// Show loading overlay before the synchronous Three.js scene construction so the
// browser can paint the UI shell and remain responsive during geometry building.
const loadingOverlay = document.createElement("div");
loadingOverlay.id = "r8-loading-overlay";
loadingOverlay.textContent = "Building model…";
app.appendChild(loadingOverlay);

// Yield two animation frames so the browser renders the overlay before the heavy work.
await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

let model: RowhomeModel = generateRowhome(currentConfig);
let activePanelTab: PanelTab = "options";
renderPanels(model, panel, currentConfig, activePanelTab, viewOptions);

const cameraPoseStorageKey = "r8-rowhome.cameraPose.v1";

interface StoredCameraPose {
  position: [number, number, number];
  quaternion: [number, number, number, number];
}

type CameraPresetId = "top" | "front" | "left" | "right" | "back" | "interior";
type InspectionViewId = "model" | "gravity-demand" | CameraPresetId | "review-sheet";

interface CameraPreset {
  id: CameraPresetId;
  label: string;
  position: Vector3;
  target: Vector3;
  fov: number;
  up?: Vector3;
}

const reviewSheetPresets: CameraPresetId[] = ["top", "front", "left", "back"];

function isFiniteTuple(values: unknown, length: number): values is number[] {
  return Array.isArray(values) && values.length === length && values.every((value) => typeof value === "number" && Number.isFinite(value));
}

function loadStoredCameraPose(): StoredCameraPose | null {
  try {
    const raw = localStorage.getItem(cameraPoseStorageKey);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredCameraPose>;
    if (!isFiniteTuple(parsed.position, 3) || !isFiniteTuple(parsed.quaternion, 4)) {
      return null;
    }
    return {
      position: [parsed.position[0], parsed.position[1], parsed.position[2]],
      quaternion: [parsed.quaternion[0], parsed.quaternion[1], parsed.quaternion[2], parsed.quaternion[3]]
    };
  } catch {
    return null;
  }
}

function storedCameraPose(cameraToStore: PerspectiveCamera): StoredCameraPose {
  return {
    position: [cameraToStore.position.x, cameraToStore.position.y, cameraToStore.position.z],
    quaternion: [cameraToStore.quaternion.x, cameraToStore.quaternion.y, cameraToStore.quaternion.z, cameraToStore.quaternion.w]
  };
}

function saveStoredCameraPose(cameraToStore: PerspectiveCamera): void {
  try {
    localStorage.setItem(cameraPoseStorageKey, JSON.stringify(storedCameraPose(cameraToStore)));
  } catch {
    // Storage can be unavailable in private windows or locked-down embeds; camera controls still work.
  }
}

function rowAssemblyWidth(config: RowhomeConfig): number {
  return config.buildingWidthFt * Math.max(1, Math.round(config.rowhomeCount || 1));
}

function cameraPreset(id: CameraPresetId, config: RowhomeConfig): CameraPreset {
  const rowWidth = rowAssemblyWidth(config);
  const centerX = rowWidth / 2;
  const centerY = config.buildingDepthFt / 2;
  const roofZ = config.stories * config.storyHeightFt;

  if (id === "top") {
    const siteMinX = -25;
    const siteMaxX = rowWidth + 21;
    const siteMinY = -46;
    const siteMaxY = config.lotDepthFt;
    const siteCenterX = (siteMinX + siteMaxX) / 2;
    const siteCenterY = (siteMinY + siteMaxY) / 2;
    const siteSpan = Math.max(siteMaxX - siteMinX, siteMaxY - siteMinY);
    return {
      id,
      label: "Top roof and site inspection",
      position: new Vector3(siteCenterX + 6, roofZ + siteSpan * 2.15, siteCenterY + 8),
      target: new Vector3(siteCenterX + 6, roofZ + 0.3, siteCenterY + 8),
      fov: 42,
      up: new Vector3(0, 0, -1)
    };
  }
  if (id === "front") {
    return {
      id,
      label: "Front facade inspection",
      position: new Vector3(centerX, 15, -118),
      target: new Vector3(centerX, 14.2, 7.5),
      fov: 16
    };
  }
  if (id === "left") {
    return {
      id,
      label: "Left elevation inspection",
      position: new Vector3(-96, 15.5, centerY + 1.5),
      target: new Vector3(1.2, 14.4, centerY + 1.5),
      fov: 30
    };
  }
  if (id === "right") {
    return {
      id,
      label: "Right elevation inspection",
      position: new Vector3(rowWidth + 96, 15.5, centerY + 1.5),
      target: new Vector3(rowWidth - 1.2, 14.4, centerY + 1.5),
      fov: 30
    };
  }
  if (id === "back") {
    return {
      id,
      label: "Back elevation inspection",
      position: new Vector3(centerX, 15.5, config.buildingDepthFt + 96),
      target: new Vector3(centerX, 14.4, config.buildingDepthFt - 0.5),
      fov: 18
    };
  }
  return {
    id,
    label: "Interior room inspection",
    position: new Vector3(Math.min(rowWidth - 8, 10.4), 6.2, 12.5),
    target: new Vector3(Math.min(rowWidth - 8, 10.4), 5.6, 30),
    fov: 48
  };
}

function viewLabel(viewId: InspectionViewId): string {
  switch (viewId) {
    case "model":
      return "3D model";
    case "gravity-demand":
      return "Conceptual gravity demand view";
    case "top":
      return "Roof plan";
    case "front":
      return "Front elevation";
    case "left":
      return "Left elevation";
    case "right":
      return "Right elevation";
    case "back":
      return "Back elevation";
    case "interior":
      return "Interior perspective";
    case "review-sheet":
      return "Four-view architectural sheet";
  }
}

function viewModeForInspectionView(viewId: InspectionViewId): ViewMode {
  switch (viewId) {
    case "gravity-demand":
      return "structural-demand";
    case "interior":
      return "interior";
    case "model":
    case "top":
      return "all";
    default:
      return "architecture";
  }
}

function hashForInspectionView(viewId: InspectionViewId): string {
  switch (viewId) {
    case "gravity-demand":
      return "#structural-demand";
    case "top":
    case "front":
    case "left":
    case "right":
    case "back":
    case "interior":
      return `#camera-${viewId}`;
    case "review-sheet":
      return "#camera-sheet";
    default:
      return window.location.pathname;
  }
}

const scene = new Scene();
scene.background = new Color("#8fb9dd");
const camera = new PerspectiveCamera(55, 1, 0.1, 1000);
camera.position.set(35, 34, 78);
camera.lookAt(new Vector3(9, 12, 20));

const skyDome = new Mesh(
  new SphereGeometry(420, 32, 16),
  new MeshBasicMaterial({
    color: "#8fb9dd",
    side: BackSide
  })
);
scene.add(skyDome);

const sun = new HemisphereLight("#dcefff", "#161611", viewOptions.ambientLightIntensity);
scene.add(sun);
scene.add(new GridHelper(220, 44, "#53606a", "#2c353c"));

let isolatedComponentId: string | null = null;
let activeViewMode: ViewMode = "all";
let group: Group = modelGroup(model.components);
let doorAssemblies: DoorAssembly[] = createDoorAssemblies(model.components);
let windowAssemblies: WindowAssembly[] = createWindowAssemblies(model.components);
let navigationBlockers: NavigationBounds[] = navigationBoundsForComponents(model.components);
scene.add(group);
attachRealProductModels(group, model.components, viewOptions.renderDetail !== "fast", activeViewMode, isolatedComponentId);
let houseLights: Group = buildHouseLighting(model, viewOptions.roomLightIntensity);
scene.add(houseLights);
let structuralDemandOverlay: Group = buildStructuralDemandOverlay(model.structural);
scene.add(structuralDemandOverlay);
const occupantAvatar = createOccupantAvatar();
scene.add(occupantAvatar);
const occupantAsset = attachOccupantAsset(occupantAvatar);
const walkthroughState: OccupantWalkthroughState = {
  enabled: false,
  paused: false,
  routeId: "daily-use",
  elapsedSeconds: 0,
  speedFtPerSecond: 4.2,
  followCamera: true
};
for (const route of occupantRoutes(currentConfig)) {
  const option = document.createElement("option");
  option.value = route.id;
  option.textContent = route.label;
  walkthroughRouteSelect.append(option);
}
walkthroughRouteSelect.value = walkthroughState.routeId;

const raycaster = new Raycaster();
const pointer = new Vector2();
const pressedKeys = new Set<string>();
const flightHudKeys = [...document.querySelectorAll<HTMLElement>("[data-key-hud]")];
let yawRadians = 0;
let pitchRadians = 0;
let activeCameraPreset: CameraPresetId | null = null;
let activeInspectionView: InspectionViewId = "model";

interface LookDrag {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
}

let lookDrag: LookDrag | null = null;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(target.closest("input, textarea, select, button, [contenteditable='true']"));
}

function componentFromObject(object: { userData: unknown }): ModelComponent | undefined {
  const metadata = object.userData as { id?: string };
  if (!metadata.id) {
    return undefined;
  }
  return model.components.find((component) => component.metadata.id === metadata.id);
}

function applyCameraPresetPosition(presetId: CameraPresetId): void {
  const preset = cameraPreset(presetId, currentConfig);
  camera.fov = preset.fov;
  camera.updateProjectionMatrix();
  if (preset.up) {
    camera.up.copy(preset.up);
  } else {
    camera.up.set(0, 1, 0);
  }
  camera.position.copy(preset.position);
  camera.lookAt(preset.target);
  orbitControls?.target.copy(preset.target);
  orbitControls?.update();
  syncLookAnglesFromCamera();
  setActiveCameraPreset(presetId);
}

function updateSelectionLabel(): void {
  if (isolatedComponentId) {
    const isolated = model.components.find((component) => component.metadata.id === isolatedComponentId);
    selection.textContent = isolated ? `Isolated: ${isolated.metadata.name}` : viewLabel(activeInspectionView);
    return;
  }
  selection.textContent = viewLabel(activeInspectionView);
}

function shouldHideComponentInInspectionView(component: ModelComponent, viewId: InspectionViewId): boolean {
  if (viewId === "front" || viewId === "left" || viewId === "right" || viewId === "review-sheet") {
    const text = `${component.metadata.id} ${component.metadata.name} ${component.metadata.material}`.toLowerCase();
    return component.metadata.category === "landscape" || /\bstreet tree|urban tree|canopy|tree\b/.test(text);
  }
  return false;
}

function setIsolation(componentId: string | null): void {
  isolatedComponentId = componentId;
  for (const component of model.components) {
    const isBrickTakeoffVisual = component.metadata.quantity?.kind === "standard-brick" && component.metadata.id !== "brick-takeoff-summary";
    const showForDetail = !isBrickTakeoffVisual || viewOptions.renderDetail === "detailed";
    const targetVisible = showForDetail
      && componentMatchesViewMode(component, activeViewMode)
      && !shouldHideComponentInInspectionView(component, activeInspectionView)
      && (!componentId || component.metadata.id === componentId);
    component.object.userData.realProductTargetVisible = targetVisible;
    component.object.visible = targetVisible;
  }
  syncRealProductModelVisibility(group, model.components, activeViewMode, componentId);
  structuralDemandOverlay.visible = activeViewMode === "structural-demand" && !componentId;
  structuralLegend.hidden = activeViewMode !== "structural-demand" || Boolean(componentId);
  reviewSheetOverlay.hidden = activeInspectionView !== "review-sheet";
  updateSelectionLabel();

  panel.querySelectorAll<HTMLElement>("[data-component-id]").forEach((row) => {
    row.classList.toggle("is-isolated", row.dataset.componentId === componentId);
  });
}

function setViewMode(viewMode: ViewMode): void {
  activeViewMode = viewMode;
  setIsolation(isolatedComponentId);
  panel.querySelectorAll<HTMLElement>("[data-view-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.viewMode === viewMode);
  });
}

function setPanelTab(tab: PanelTab): void {
  activePanelTab = tab;
  panel.querySelectorAll<HTMLElement>("[data-panel-tab]").forEach((button) => {
    const isActive = button.dataset.panelTab === tab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
  panel.querySelectorAll<HTMLElement>("[data-tab-panel]").forEach((tabPanel) => {
    tabPanel.classList.toggle("is-active", tabPanel.dataset.tabPanel === tab);
  });
}

function setActiveCameraPreset(presetId: CameraPresetId | null): void {
  activeCameraPreset = presetId;
}

function updateWalkthroughControls(progress = 0): void {
  walkthroughToggleButton.textContent = walkthroughState.enabled && !walkthroughState.paused ? "Pause Person" : "Watch Person";
  walkthroughToggleButton.classList.toggle("is-active", walkthroughState.enabled);
  walkthroughFollowButton.classList.toggle("is-active", walkthroughState.followCamera);
  walkthroughFollowButton.textContent = walkthroughState.followCamera ? "Following" : "Follow";
  walkthroughHud.hidden = !walkthroughState.enabled;
  const route = routeById(currentConfig, walkthroughState.routeId);
  walkthroughHud.textContent = `${route.label}: ${Math.round(progress * 100)}%`;
}

const rebuildStatus = requireElement<HTMLElement>("#rebuild-status");
let pendingRebuildConfig: RowhomeConfig | null = null;

/**
 * Rebuilds are queued behind two animation frames so the browser can paint the
 * "Updating model…" status before the synchronous regeneration runs. Rapid
 * successive changes coalesce into one rebuild of the latest config.
 */
function rebuildModel(nextConfig: RowhomeConfig): void {
  const alreadyQueued = pendingRebuildConfig !== null;
  pendingRebuildConfig = { ...nextConfig };
  if (alreadyQueued) {
    return;
  }
  rebuildStatus.hidden = false;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const config = pendingRebuildConfig ?? nextConfig;
      pendingRebuildConfig = null;
      try {
        performRebuild(config);
      } finally {
        rebuildStatus.hidden = true;
      }
    });
  });
}

function performRebuild(nextConfig: RowhomeConfig): void {
  currentConfig = { ...nextConfig };
  saveStoredAppOptions(currentConfig, viewOptions);
  scene.remove(group);
  scene.remove(houseLights);
  scene.remove(structuralDemandOverlay);
  model = generateRowhome(currentConfig);
  group = modelGroup(model.components);
  doorAssemblies = createDoorAssemblies(model.components);
  windowAssemblies = createWindowAssemblies(model.components);
  navigationBlockers = navigationBoundsForComponents(model.components);
  scene.add(group);
  attachRealProductModels(group, model.components, viewOptions.renderDetail !== "fast", activeViewMode, isolatedComponentId);
  houseLights = buildHouseLighting(model, viewOptions.roomLightIntensity);
  scene.add(houseLights);
  structuralDemandOverlay = buildStructuralDemandOverlay(model.structural);
  scene.add(structuralDemandOverlay);
  renderPanels(model, panel, currentConfig, activePanelTab, viewOptions);
  updateWalkthroughControls();
  if (activeCameraPreset) {
    applyCameraPresetPosition(activeCameraPreset);
  }
  setIsolation(isolatedComponentId && model.components.some((component) => component.metadata.id === isolatedComponentId) ? isolatedComponentId : null);
}

function applyViewOptions(): void {
  sun.intensity = viewOptions.ambientLightIntensity;
  scene.remove(houseLights);
  houseLights = buildHouseLighting(model, viewOptions.roomLightIntensity);
  scene.add(houseLights);
  saveStoredAppOptions(currentConfig, viewOptions);
}

function updateFlightHud(): void {
  for (const key of flightHudKeys) {
    key.classList.toggle("is-held", pressedKeys.has(key.dataset.keyHud ?? ""));
  }
}

function animateOpenings(deltaSeconds: number): void {
  for (const assembly of doorAssemblies) {
    animateDoor(assembly, deltaSeconds);
  }
  for (const assembly of windowAssemblies) {
    animateWindow(assembly, deltaSeconds);
  }
}

function syncLookAnglesFromCamera(): void {
  const forward = new Vector3();
  camera.getWorldDirection(forward);
  yawRadians = Math.atan2(forward.x, -forward.z);
  pitchRadians = Math.asin(Math.max(-1, Math.min(1, forward.y)));
}

function lookDirectionFromAngles(): Vector3 {
  const cosPitch = Math.cos(pitchRadians);
  return new Vector3(
    Math.sin(yawRadians) * cosPitch,
    Math.sin(pitchRadians),
    -Math.cos(yawRadians) * cosPitch
  ).normalize();
}

async function boot(): Promise<void> {
  let currentRenderer: import("./viewer/renderers").PreferredRenderer;
  let currentMode: RendererMode;

  {
    const result = await createPreferredRenderer({ canvas, antialias: true });
    currentRenderer = result.renderer;
    currentMode = result.mode;
  }

  loadingOverlay.remove();
  currentRenderer.setPixelRatio(devicePixelRatio);
  if (currentRenderer.shadowMap) {
    currentRenderer.shadowMap.enabled = true;
    currentRenderer.shadowMap.type = PCFSoftShadowMap;
  }
  renderMode.textContent = currentMode;
  renderMode.style.cursor = "pointer";
  renderMode.title = "Click to toggle renderer";

  async function setRendererMode(nextMode: RendererMode): Promise<RendererMode> {
    if (nextMode === currentMode) {
      return currentMode;
    }
    renderMode.textContent = `⟳ ${nextMode}`;
    try {
      const result = await toggleRenderer(currentMode === nextMode ? (nextMode === "WebGPU" ? "WebGL2" : "WebGPU") : currentMode, currentRenderer, { canvas, antialias: true });
      currentRenderer = result.renderer;
      currentMode = result.mode;
      currentRenderer.setPixelRatio(devicePixelRatio);
      if (currentRenderer.shadowMap) {
        currentRenderer.shadowMap.enabled = true;
        currentRenderer.shadowMap.type = PCFSoftShadowMap;
      }
      orbitControls = new OrbitControls(camera, currentRenderer.domElement);
      orbitControls.enableRotate = false;
      orbitControls.enableDamping = true;
      orbitControls.maxDistance = 180;
      orbitControls.target.copy(camera.position.clone().add(lookDirectionFromAngles().multiplyScalar(24)));
      orbitControls.update();
      renderMode.textContent = currentMode;
      return currentMode;
    } catch {
      renderMode.textContent = currentMode;
      return currentMode;
    }
  }

  renderMode.addEventListener("click", async () => {
    const nextMode: RendererMode = currentMode === "WebGPU" ? "WebGL2" : "WebGPU";
    await setRendererMode(nextMode);
  });
  renderMode.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    const nextMode: RendererMode = currentMode === "WebGPU" ? "WebGL2" : "WebGPU";
    await setRendererMode(nextMode);
  });

  orbitControls = new OrbitControls(camera, currentRenderer.domElement);
  orbitControls.enableRotate = false;
  orbitControls.enableDamping = true;
  orbitControls.maxDistance = 180;

  const savedPose = loadStoredCameraPose();
  if (savedPose) {
    camera.position.fromArray(savedPose.position);
    camera.quaternion.fromArray(savedPose.quaternion);
  }
  syncLookAnglesFromCamera();
  orbitControls.target.copy(camera.position.clone().add(lookDirectionFromAngles().multiplyScalar(24)));
  orbitControls.update();
  let previousFrameMs = performance.now();
  let lastCameraPoseJson = JSON.stringify(storedCameraPose(camera));
  let lastCameraPoseSaveMs = 0;
  let renderDurationSamples: number[] = [];

  function persistCameraPose(nowMs: number, force = false): void {
    const nextCameraPoseJson = JSON.stringify(storedCameraPose(camera));
    if (nextCameraPoseJson === lastCameraPoseJson) {
      return;
    }
    if (!force && nowMs - lastCameraPoseSaveMs < 500) {
      return;
    }
    lastCameraPoseJson = nextCameraPoseJson;
    lastCameraPoseSaveMs = nowMs;
    saveStoredCameraPose(camera);
  }

  function updateCameraLook(): void {
    const forward = lookDirectionFromAngles();
    const target = camera.position.clone().add(forward.multiplyScalar(24));
    camera.lookAt(target);
    orbitControls?.target.copy(target);
  }

  function focusCameraOnOccupant(position: Vector3, direction: Vector3): void {
    if (!walkthroughState.enabled || !walkthroughState.followCamera || activeInspectionView === "review-sheet") {
      return;
    }
    const side = new Vector3(-direction.z, 0, direction.x).normalize();
    const cameraOffset = direction.clone().multiplyScalar(-5.8).add(side.multiplyScalar(1.7)).add(new Vector3(0, 3.4, 0));
    const focusPoint = position.clone().add(new Vector3(0, 2.0, 0));
    const desiredCameraPosition = focusPoint.clone().add(cameraOffset);
    const clampedCameraPosition = clampFollowCameraToSameSideOfWalls(focusPoint, desiredCameraPosition, model.components);
    camera.position.lerp(clampedCameraPosition, 0.14);
    const target = focusPoint.clone().add(direction.clone().multiplyScalar(3.2));
    camera.lookAt(target);
    orbitControls?.target.lerp(target, 0.12);
    syncLookAnglesFromCamera();
  }

  function setInspectionView(viewId: InspectionViewId, updateHash = true): void {
    activeInspectionView = viewId;
    viewPresetSelect.value = viewId;
    if (isolatedComponentId) {
      setIsolation(null);
    }
    setViewMode(viewModeForInspectionView(viewId));
    if (viewId === "top" || viewId === "front" || viewId === "left" || viewId === "right" || viewId === "back" || viewId === "interior") {
      applyCameraPresetPosition(viewId);
    } else {
      setActiveCameraPreset(null);
      if (viewId === "model") {
        camera.up.set(0, 1, 0);
        camera.fov = 55;
        camera.updateProjectionMatrix();
      }
    }
    updateSelectionLabel();
    saveStoredCameraPose(camera);
    if (updateHash) {
      window.history.replaceState(null, "", hashForInspectionView(viewId));
    }
    if (viewId === "gravity-demand") {
      setPanelTab("structure");
    }
  }

  function applyLocationHash(): boolean {
    const hash = window.location.hash;
    if (hash === "#structural-demand" || hash === "#steel-structural-demand") {
      setInspectionView("gravity-demand", false);
      return true;
    }
    if (hash === "#camera-sheet") {
      setInspectionView("review-sheet", false);
      return true;
    }
    const presetId = hash.replace("#camera-", "") as CameraPresetId;
    if (presetId === "top" || presetId === "front" || presetId === "left" || presetId === "right" || presetId === "back" || presetId === "interior") {
      setInspectionView(presetId, false);
      return true;
    }
    return false;
  }

  function moveCameraAndTarget(delta: Vector3): void {
    const previousPosition = camera.position.clone();
    const nextPosition = resolveNavigationMove(previousPosition, previousPosition.clone().add(delta), navigationBlockers);
    const resolvedDelta = nextPosition.sub(previousPosition);
    camera.position.add(resolvedDelta);
    orbitControls?.target.add(resolvedDelta);
  }

  function applyFlyMovement(deltaSeconds: number): void {
    if (activeInspectionView === "review-sheet") {
      return;
    }
    const baseSpeedFtPerSecond = pressedKeys.has("shiftleft") || pressedKeys.has("shiftright") ? 42 : 16;
    const distance = baseSpeedFtPerSecond * deltaSeconds;
    const move = new Vector3();
    const forward = new Vector3();
    const right = new Vector3();
    const up = new Vector3(0, 1, 0);

    camera.getWorldDirection(forward);
    forward.normalize();
    right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();

    if (pressedKeys.has("keyw")) {
      move.add(forward);
    }
    if (pressedKeys.has("keys")) {
      move.sub(forward);
    }
    if (pressedKeys.has("keyd")) {
      move.add(right);
    }
    if (pressedKeys.has("keya")) {
      move.sub(right);
    }
    if (pressedKeys.has("keye")) {
      move.add(up);
    }
    if (pressedKeys.has("keyq")) {
      move.sub(up);
    }

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(distance);
      moveCameraAndTarget(move);
    }
  }

  function resize(): void {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    currentRenderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }

  function renderReviewSheet(rendererInstance: typeof currentRenderer, width: number, height: number): void {
    const halfWidth = Math.floor(width / 2);
    const halfHeight = Math.floor(height / 2);
    const aspect = halfWidth / Math.max(1, halfHeight);
    rendererInstance.setScissorTest?.(true);

    reviewSheetPresets.forEach((presetId, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const left = column * halfWidth;
      const viewportHeight = row === 0 ? halfHeight : height - halfHeight;
      const bottom = row === 0 ? 0 : halfHeight;
      const viewportWidth = column === 0 ? halfWidth : width - halfWidth;
      const preset = cameraPreset(presetId, currentConfig);
      const sheetCamera = new PerspectiveCamera(preset.fov, aspect, 0.1, 1000);
      if (preset.up) {
        sheetCamera.up.copy(preset.up);
      }
      sheetCamera.position.copy(preset.position);
      sheetCamera.lookAt(preset.target);
      sheetCamera.updateProjectionMatrix();
      rendererInstance.setViewport?.(left, bottom, viewportWidth, viewportHeight);
      rendererInstance.setScissor?.(left, bottom, viewportWidth, viewportHeight);
      rendererInstance.render(scene, sheetCamera);
    });

    rendererInstance.setScissorTest?.(false);
    rendererInstance.setViewport?.(0, 0, width, height);
  }

  function animate(): void {
    const nowMs = performance.now();
    const deltaSeconds = Math.min((nowMs - previousFrameMs) / 1000, 0.05);
    previousFrameMs = nowMs;
    resize();
    applyFlyMovement(deltaSeconds);
    animateOpenings(deltaSeconds);
    const occupantSample = updateOccupantAvatar(
      occupantAvatar,
      routeById(currentConfig, walkthroughState.routeId),
      walkthroughState,
      deltaSeconds,
      currentConfig,
      model.components
    );
    occupantAsset.update(deltaSeconds);
    focusCameraOnOccupant(occupantSample.position, occupantSample.direction);
    updateWalkthroughControls(occupantSample.progress);
    orbitControls?.update();
    persistCameraPose(nowMs);
    if (activeInspectionView === "review-sheet") {
      const renderStartMs = performance.now();
      renderReviewSheet(currentRenderer, canvas.clientWidth, canvas.clientHeight);
      renderDurationSamples.push(performance.now() - renderStartMs);
    } else {
      const renderStartMs = performance.now();
      currentRenderer.render(scene, camera);
      renderDurationSamples.push(performance.now() - renderStartMs);
    }
    if (renderDurationSamples.length > 1000) {
      renderDurationSamples = renderDurationSamples.slice(-500);
    }
    requestAnimationFrame(animate);
  }

  window.__r8RowhomeBenchmark = {
    getRendererMode: () => currentMode,
    setRendererMode,
    sampleFrames: async (options = {}) => {
      const warmupFrames = Math.max(0, Math.round(options.warmupFrames ?? 45));
      const sampleFrames = Math.max(5, Math.round(options.sampleFrames ?? 180));
      const waitFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
      for (let i = 0; i < warmupFrames; i += 1) {
        await waitFrame();
      }
      renderDurationSamples = [];
      const samples: number[] = [];
      let previous = await waitFrame();
      for (let i = 0; i < sampleFrames; i += 1) {
        const next = await waitFrame();
        samples.push(next - previous);
        previous = next;
      }
      const sorted = [...samples].sort((a, b) => a - b);
      const renderSamples = [...renderDurationSamples].slice(-samples.length);
      const sortedRenderSamples = [...renderSamples].sort((a, b) => a - b);
      const quantile = (q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)))];
      const renderQuantile = (q: number) => sortedRenderSamples[Math.min(sortedRenderSamples.length - 1, Math.max(0, Math.floor((sortedRenderSamples.length - 1) * q)))] ?? 0;
      return {
        mode: currentMode,
        frames: samples.length,
        averageFrameMs: samples.reduce((sum, value) => sum + value, 0) / samples.length,
        medianFrameMs: quantile(0.5),
        p95FrameMs: quantile(0.95),
        minFrameMs: sorted[0],
        maxFrameMs: sorted[sorted.length - 1],
        averageRenderMs: renderSamples.length > 0 ? renderSamples.reduce((sum, value) => sum + value, 0) / renderSamples.length : 0,
        medianRenderMs: renderQuantile(0.5),
        p95RenderMs: renderQuantile(0.95),
        maxRenderMs: sortedRenderSamples[sortedRenderSamples.length - 1] ?? 0
      };
    },
    sampleRenderCalls: (options = {}) => {
      const warmupCalls = Math.max(0, Math.round(options.warmupCalls ?? 20));
      const sampleCalls = Math.max(5, Math.round(options.sampleCalls ?? 120));
      const renderOnce = () => {
        const renderStartMs = performance.now();
        if (activeInspectionView === "review-sheet") {
          renderReviewSheet(currentRenderer, canvas.clientWidth, canvas.clientHeight);
        } else {
          currentRenderer.render(scene, camera);
        }
        return performance.now() - renderStartMs;
      };
      for (let i = 0; i < warmupCalls; i += 1) {
        renderOnce();
      }
      const samples: number[] = [];
      for (let i = 0; i < sampleCalls; i += 1) {
        samples.push(renderOnce());
      }
      const sorted = [...samples].sort((a, b) => a - b);
      const quantile = (q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)))];
      return {
        mode: currentMode,
        calls: samples.length,
        averageRenderMs: samples.reduce((sum, value) => sum + value, 0) / samples.length,
        medianRenderMs: quantile(0.5),
        p95RenderMs: quantile(0.95),
        minRenderMs: sorted[0],
        maxRenderMs: sorted[sorted.length - 1]
      };
    },
    getSceneStats: () => {
      let objects = 0;
      let meshes = 0;
      let triangles = 0;
      let visibleObjects = 0;
      scene.traverse((object) => {
        objects += 1;
        if (object.visible) {
          visibleObjects += 1;
        }
        if (object instanceof Mesh) {
          meshes += 1;
          const indexCount = object.geometry.index?.count;
          const positionCount = object.geometry.getAttribute("position")?.count ?? 0;
          triangles += Math.floor((indexCount ?? positionCount) / 3);
        }
      });
      return {
        components: model.components.length,
        objects,
        meshes,
        triangles,
        visibleObjects
      };
    },
    getRendererInfo: () => {
      const maybeRenderer = currentRenderer as typeof currentRenderer & { info?: unknown };
      return maybeRenderer.info ?? null;
    }
  };

  window.addEventListener("keydown", (event) => {
    if (isTypingTarget(event.target)) {
      return;
    }
    pressedKeys.add(event.code.toLowerCase());
    updateFlightHud();
  });

  window.addEventListener("keyup", (event) => {
    pressedKeys.delete(event.code.toLowerCase());
    updateFlightHud();
  });

  window.addEventListener("blur", () => {
    pressedKeys.clear();
    updateFlightHud();
    lookDrag = null;
  });

  function selectAt(clientX: number, clientY: number): void {
    if (activeInspectionView === "review-sheet") {
      selection.textContent = viewLabel(activeInspectionView);
      return;
    }
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(group.children, true)[0];
    if (!hit) {
      selection.textContent = "No selection";
      return;
    }
    const selected = componentFromObject(hit.object);
    if (!selected) {
      return;
    }
    selection.textContent = selected.metadata.name;
    if (isDoorLeafComponent(selected.metadata.id)) {
      const assembly = doorAssemblyForComponent(doorAssemblies, selected.metadata.id);
      if (assembly) {
        toggleDoor(assembly);
        selection.textContent = assembly.isOpen ? "Door opening" : "Door closing";
      }
      return;
    }
    if (isFrontWindowComponent(selected.metadata.id)) {
      const assembly = windowAssemblyForComponent(windowAssemblies, selected.metadata.id);
      if (assembly) {
        toggleWindow(assembly);
        selection.textContent = assembly.isOpen ? "Window opening" : "Window closing";
      }
      return;
    }
    if (selected.metadata.printable) {
      const stl = exportComponentStl(selected);
      console.info(`Prepared STL for ${selected.metadata.id}`, stl.slice(0, 80));
    }
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (activeInspectionView === "review-sheet") {
      return;
    }
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    lookDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false
    };
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!lookDrag || event.pointerId !== lookDrag.pointerId) {
      return;
    }
    const dx = event.clientX - lookDrag.lastX;
    const dy = event.clientY - lookDrag.lastY;
    const totalDx = event.clientX - lookDrag.startX;
    const totalDy = event.clientY - lookDrag.startY;
    lookDrag.lastX = event.clientX;
    lookDrag.lastY = event.clientY;

    if (Math.hypot(totalDx, totalDy) > 3) {
      lookDrag.moved = true;
    }

    const horizontalDirection = viewOptions.invertDragHorizontal ? 1 : -1;
    const verticalDirection = viewOptions.invertDragVertical ? 1 : -1;
    yawRadians += dx * viewOptions.dragSensitivity * horizontalDirection;
    pitchRadians += dy * viewOptions.dragSensitivity * verticalDirection;
    const pitchLimit = Math.PI / 2 - 0.02;
    pitchRadians = Math.max(-pitchLimit, Math.min(pitchLimit, pitchRadians));
    setActiveCameraPreset(null);
    activeInspectionView = "model";
    viewPresetSelect.value = "model";
    camera.up.set(0, 1, 0);
    updateCameraLook();
    updateSelectionLabel();
    persistCameraPose(performance.now());
  });

  canvas.addEventListener("pointerup", (event) => {
    if (!lookDrag || event.pointerId !== lookDrag.pointerId) {
      return;
    }
    const wasClick = !lookDrag.moved;
    lookDrag = null;
    canvas.releasePointerCapture(event.pointerId);
    if (wasClick) {
      selectAt(event.clientX, event.clientY);
    } else {
      persistCameraPose(performance.now(), true);
    }
  });

  canvas.addEventListener("pointercancel", (event) => {
    if (lookDrag?.pointerId === event.pointerId) {
      lookDrag = null;
    }
  });

  panel.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;

    const tabButton = target.closest<HTMLButtonElement>("[data-panel-tab]");
    if (tabButton?.dataset.panelTab) {
      setPanelTab(tabButton.dataset.panelTab as PanelTab);
      return;
    }

    const downloadButton = target.closest<HTMLButtonElement>("[data-download-stl]");
    if (downloadButton) {
      event.stopPropagation();
      const component = model.components.find((item) => item.metadata.id === downloadButton.dataset.downloadStl);
      if (!component || !component.metadata.printable) {
        return;
      }
      downloadTextFile(`${component.metadata.id}.stl`, exportComponentStl(component), "model/stl");
      return;
    }

    if (target.closest("[data-show-all-components]")) {
      setIsolation(null);
      setViewMode("all");
      return;
    }

    if (target.closest("#reset-saved-options")) {
      currentConfig = { ...defaultRowhomeConfig };
      viewOptions = { ...defaultViewOptions };
      saveStoredAppOptions(currentConfig, viewOptions);
      sun.intensity = viewOptions.ambientLightIntensity;
      rebuildModel(currentConfig);
      setPanelTab("view");
      return;
    }

    const viewButton = target.closest<HTMLButtonElement>("[data-view-mode]");
    if (viewButton?.dataset.viewMode) {
      setViewMode(viewButton.dataset.viewMode as ViewMode);
      return;
    }

    const row = target.closest<HTMLElement>("[data-component-id]");
    if (!row) {
      return;
    }

    const component = model.components.find((item) => item.metadata.id === row.dataset.componentId);
    if (!component) {
      return;
    }
    setIsolation(component.metadata.id);
  });

  panel.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) && !(target instanceof HTMLInputElement)) {
      return;
    }
    if (target.id === "facade-material-select") {
      rebuildModel({ ...currentConfig, facadeMaterialId: target.value });
    }
    if (target.id === "rowhome-count-select") {
      rebuildModel({ ...currentConfig, rowhomeCount: Math.max(1, Math.min(6, Number(target.value))) });
    }
    if (target.id === "facade-style-select") {
      rebuildModel({ ...currentConfig, facadeStyleId: target.value });
    }
    if (target.id === "stair-implementation-select") {
      const stairImplementation = target.value as StairImplementation;
      rebuildModel({
        ...currentConfig,
        stairImplementation,
        facadeStyleId: stairImplementation === "spiral" ? "bowed-front" : currentConfig.facadeStyleId
      });
    }
    if (target.id === "structural-support-select") {
      rebuildModel({ ...currentConfig, structuralSupportScheme: target.value as StructuralSupportScheme });
    }
    if (target.id === "construction-system-select") {
      rebuildModel({ ...currentConfig, constructionSystem: target.value === "steel-concrete" ? "steel-concrete" : "masonry-wood" });
    }
    if (target.id === "urban-scale-select") {
      const urbanScale = target.value === "block-32" || target.value === "district-128" ? target.value : "single";
      rebuildModel({ ...currentConfig, urbanScale });
    }
    if (target.id === "brick-detail-mode-select") {
      rebuildModel({ ...currentConfig, brickDetailMode: target.value as BrickDetailMode });
    }
    if (target.id === "invert-drag-horizontal") {
      viewOptions.invertDragHorizontal = target.value === "inverted";
      saveStoredAppOptions(currentConfig, viewOptions);
    }
    if (target.id === "invert-drag-vertical") {
      viewOptions.invertDragVertical = target.value === "inverted";
      saveStoredAppOptions(currentConfig, viewOptions);
    }
    if (target.id === "drag-sensitivity") {
      viewOptions.dragSensitivity = Number(target.value);
      saveStoredAppOptions(currentConfig, viewOptions);
    }
    if (target.id === "ambient-light-intensity") {
      viewOptions.ambientLightIntensity = Number(target.value);
      applyViewOptions();
      renderPanels(model, panel, currentConfig, activePanelTab, viewOptions);
      setPanelTab("view");
    }
    if (target.id === "room-light-intensity") {
      viewOptions.roomLightIntensity = Number(target.value);
      applyViewOptions();
      renderPanels(model, panel, currentConfig, activePanelTab, viewOptions);
      setPanelTab("view");
    }
    if (target.id === "render-detail") {
      viewOptions.renderDetail = target.value === "detailed" || target.value === "balanced" ? target.value : "fast";
      saveStoredAppOptions(currentConfig, viewOptions);
      rebuildModel(currentConfig);
      setPanelTab("view");
    }
  });

  panel.addEventListener("keydown", (event) => {
    const target = event.target as HTMLElement;
    // Arrow-key navigation between panel tabs per the WAI-ARIA tabs pattern.
    if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && target.closest("[data-panel-tab]")) {
      const tabs = [...panel.querySelectorAll<HTMLButtonElement>("[data-panel-tab]")];
      const currentIndex = tabs.findIndex((tab) => tab === target.closest("[data-panel-tab]"));
      if (currentIndex >= 0) {
        event.preventDefault();
        const nextIndex = (currentIndex + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
        tabs[nextIndex].focus();
        setPanelTab(tabs[nextIndex].dataset.panelTab as PanelTab);
      }
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    if (target.closest("[data-download-stl]")) {
      return;
    }
    const row = target.closest<HTMLElement>("[data-component-id]");
    if (!row) {
      return;
    }
    event.preventDefault();
    setIsolation(row.dataset.componentId ?? null);
  });

  exportModelButton.addEventListener("click", () => {
    downloadTextFile("r8-rowhome.stl", exportModelStl(model), "model/stl");
  });

  exportJsonButton.addEventListener("click", () => {
    downloadTextFile("r8-rowhome-metadata.json", exportModelMetadataJson(model), "application/json");
  });

  viewPresetSelect.addEventListener("change", () => {
    const nextView = viewPresetSelect.value as InspectionViewId;
    if (nextView === "model" || nextView === "gravity-demand" || nextView === "top" || nextView === "front" || nextView === "left" || nextView === "right" || nextView === "back" || nextView === "interior" || nextView === "review-sheet") {
      setInspectionView(nextView);
    }
  });

  walkthroughRouteSelect.addEventListener("change", () => {
    walkthroughState.routeId = walkthroughRouteSelect.value as OccupantRouteId;
    walkthroughState.elapsedSeconds = 0;
    walkthroughState.enabled = true;
    walkthroughState.paused = false;
    setInspectionView("model");
    updateWalkthroughControls();
  });

  walkthroughToggleButton.addEventListener("click", () => {
    if (!walkthroughState.enabled) {
      walkthroughState.enabled = true;
      walkthroughState.paused = false;
      setInspectionView("model");
    } else {
      walkthroughState.paused = !walkthroughState.paused;
    }
    updateWalkthroughControls();
  });

  walkthroughFollowButton.addEventListener("click", () => {
    walkthroughState.followCamera = !walkthroughState.followCamera;
    updateWalkthroughControls();
  });

  window.addEventListener("hashchange", () => {
    applyLocationHash();
  });

  window.addEventListener("beforeunload", () => {
    saveStoredCameraPose(camera);
  });

  if (window.location.hash === "#steel-support" || window.location.hash === "#steel-structural-demand") {
    rebuildModel({ ...currentConfig, structuralSupportScheme: "steel-post-beam" });
    setPanelTab(window.location.hash === "#steel-structural-demand" ? "structure" : "options");
  }

  if (window.location.hash === "#steel-concrete") {
    rebuildModel({ ...currentConfig, constructionSystem: "steel-concrete" });
    setPanelTab("options");
  }

  if (window.location.hash === "#city-block" || window.location.hash === "#district") {
    rebuildModel({ ...currentConfig, urbanScale: window.location.hash === "#district" ? "district-128" : "block-32" });
    setPanelTab("options");
  }

  if (window.location.hash === "#investor") {
    setPanelTab("invest");
  }

  if (window.location.hash === "#structural-demand" || window.location.hash === "#steel-structural-demand") {
    setInspectionView("gravity-demand", false);
    setPanelTab("structure");
  }

  applyLocationHash();

  setIsolation(isolatedComponentId);
  animate();
}

boot().catch((error: unknown) => {
  console.error(error);
  renderMode.textContent = "Renderer failed";
});
