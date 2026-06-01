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
import { createPreferredRenderer } from "./viewer/renderers";
import { componentMatchesViewMode, type ViewMode } from "./viewer/layers";
import { createFrontDoorAssembly, isFrontDoorLeafComponent, toggleFrontDoor, type FrontDoorAssembly } from "./viewer/door";
import { buildHouseLighting } from "./viewer/lighting";
import type { ModelComponent, RowhomeConfig, RowhomeModel, StairImplementation, ViewOptions } from "./core/types";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("Missing #app root");
}

app.innerHTML = `
  <main class="layout">
    <section class="viewport">
      <div class="toolbar">
        <button id="export-model-stl" type="button">Export STL</button>
        <button id="export-json" type="button">Export JSON</button>
        <span id="render-mode">Renderer</span>
        <span id="selection">No selection</span>
      </div>
      <canvas id="scene"></canvas>
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
const exportModelButton = requireElement<HTMLButtonElement>("#export-model-stl");
const exportJsonButton = requireElement<HTMLButtonElement>("#export-json");

let currentConfig: RowhomeConfig = { ...defaultRowhomeConfig };
let model: RowhomeModel = generateRowhome(currentConfig);
let activePanelTab: PanelTab = "options";
const viewOptions: ViewOptions = {
  invertDragHorizontal: false,
  invertDragVertical: false,
  dragSensitivity: 0.003
};
renderPanels(model, panel, currentConfig, activePanelTab, viewOptions);

const cameraPoseStorageKey = "r8-rowhome.cameraPose.v1";

interface StoredCameraPose {
  position: [number, number, number];
  quaternion: [number, number, number, number];
}

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

const sun = new HemisphereLight("#dcefff", "#161611", 0.42);
scene.add(sun);
scene.add(new GridHelper(120, 24, "#53606a", "#2c353c"));

let group: Group = modelGroup(model.components);
let frontDoorAssembly: FrontDoorAssembly = createFrontDoorAssembly(model.components);
scene.add(group);
let houseLights: Group = buildHouseLighting(model);
scene.add(houseLights);

const raycaster = new Raycaster();
const pointer = new Vector2();
const pressedKeys = new Set<string>();
let isolatedComponentId: string | null = null;
let yawRadians = 0;
let pitchRadians = 0;

interface LookDrag {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
}

let lookDrag: LookDrag | null = null;
let activeViewMode: ViewMode = "all";

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

function setIsolation(componentId: string | null): void {
  isolatedComponentId = componentId;
  for (const component of model.components) {
    component.object.visible = componentMatchesViewMode(component, activeViewMode) && (!componentId || component.metadata.id === componentId);
  }

  const isolated = componentId ? model.components.find((component) => component.metadata.id === componentId) : undefined;
  selection.textContent = isolated ? `Isolated: ${isolated.metadata.name}` : "Full model";

  panel.querySelectorAll<HTMLElement>("[data-component-id]").forEach((row) => {
    row.classList.toggle("is-isolated", row.dataset.componentId === componentId);
  });
}

function setViewMode(viewMode: ViewMode): void {
  activeViewMode = viewMode;
  setIsolation(isolatedComponentId);
  selection.textContent = viewMode === "all" ? "Full model" : `${viewMode} view`;
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

function rebuildModel(nextConfig: RowhomeConfig): void {
  currentConfig = { ...nextConfig };
  scene.remove(group);
  scene.remove(houseLights);
  model = generateRowhome(currentConfig);
  group = modelGroup(model.components);
  frontDoorAssembly = createFrontDoorAssembly(model.components);
  scene.add(group);
  houseLights = buildHouseLighting(model);
  scene.add(houseLights);
  renderPanels(model, panel, currentConfig, activePanelTab, viewOptions);
  setIsolation(isolatedComponentId && model.components.some((component) => component.metadata.id === isolatedComponentId) ? isolatedComponentId : null);
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
  const { renderer, mode } = await createPreferredRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(devicePixelRatio);
  if (renderer.shadowMap) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
  }
  renderMode.textContent = mode;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableRotate = false;
  controls.enableDamping = true;
  controls.maxDistance = 180;

  const savedPose = loadStoredCameraPose();
  if (savedPose) {
    camera.position.fromArray(savedPose.position);
    camera.quaternion.fromArray(savedPose.quaternion);
  }
  syncLookAnglesFromCamera();
  controls.target.copy(camera.position.clone().add(lookDirectionFromAngles().multiplyScalar(24)));
  controls.update();
  let previousFrameMs = performance.now();
  let lastCameraPoseJson = JSON.stringify(storedCameraPose(camera));
  let lastCameraPoseSaveMs = 0;

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
    controls.target.copy(target);
  }

  function moveCameraAndTarget(delta: Vector3): void {
    camera.position.add(delta);
    controls.target.add(delta);
  }

  function applyFlyMovement(deltaSeconds: number): void {
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
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }

  function animate(): void {
    const nowMs = performance.now();
    const deltaSeconds = Math.min((nowMs - previousFrameMs) / 1000, 0.05);
    previousFrameMs = nowMs;
    resize();
    applyFlyMovement(deltaSeconds);
    controls.update();
    persistCameraPose(nowMs);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  window.addEventListener("keydown", (event) => {
    if (isTypingTarget(event.target)) {
      return;
    }
    pressedKeys.add(event.code.toLowerCase());
  });

  window.addEventListener("keyup", (event) => {
    pressedKeys.delete(event.code.toLowerCase());
  });

  window.addEventListener("blur", () => {
    pressedKeys.clear();
    lookDrag = null;
  });

  function selectAt(clientX: number, clientY: number): void {
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
    if (isFrontDoorLeafComponent(selected.metadata.id)) {
      toggleFrontDoor(frontDoorAssembly);
      selection.textContent = frontDoorAssembly.isOpen ? "Front door open" : "Front door closed";
      return;
    }
    if (selected.metadata.printable) {
      const stl = exportComponentStl(selected);
      console.info(`Prepared STL for ${selected.metadata.id}`, stl.slice(0, 80));
    }
  }

  canvas.addEventListener("pointerdown", (event) => {
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
    updateCameraLook();
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
      activeViewMode = "all";
      setIsolation(null);
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
    if (!(target instanceof HTMLSelectElement)) {
      return;
    }
    if (target.id === "facade-material-select") {
      rebuildModel({ ...currentConfig, facadeMaterialId: target.value });
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
    if (target.id === "invert-drag-horizontal") {
      viewOptions.invertDragHorizontal = target.value === "inverted";
    }
    if (target.id === "invert-drag-vertical") {
      viewOptions.invertDragVertical = target.value === "inverted";
    }
    if (target.id === "drag-sensitivity") {
      viewOptions.dragSensitivity = Number(target.value);
    }
  });

  panel.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    const target = event.target as HTMLElement;
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

  window.addEventListener("beforeunload", () => {
    saveStoredCameraPose(camera);
  });

  animate();
}

boot().catch((error: unknown) => {
  console.error(error);
  renderMode.textContent = "Renderer failed";
});
