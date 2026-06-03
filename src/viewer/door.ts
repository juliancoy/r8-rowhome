import { Quaternion, Vector3 } from "three";
import type { ModelComponent } from "../core/types";

interface ClosedDoorTransform {
  component: ModelComponent;
  position: Vector3;
  quaternion: Quaternion;
}

export interface FrontDoorAssembly {
  isOpen: boolean;
  progress: number;
  targetProgress: number;
  hinge: Vector3;
  closedTransforms: ClosedDoorTransform[];
}

interface ClosedWindowTransform {
  component: ModelComponent;
  position: Vector3;
}

export interface WindowAssembly {
  id: string;
  isOpen: boolean;
  progress: number;
  targetProgress: number;
  slideDistanceFt: number;
  closedTransforms: ClosedWindowTransform[];
}

const unitPrefixPattern = "(?:unit-\\d+-)?";
const frontDoorLeafPartPattern = new RegExp(`^${unitPrefixPattern}front-door(?:(?:-(?:top|lock|bottom)-rail)|(?:-(?:hanging|lock|center)-stile)|(?:-(?:upper|lower)-(?:left|right)-panel)|(?:-knob))?$`);
const frontWindowBasePattern = new RegExp(`^${unitPrefixPattern}front-window-(?:left|right)-\\d+$`);
const frontWindowMovablePartPattern = new RegExp(`^(${unitPrefixPattern}front-window-(?:left|right)-\\d+)(?:(?:-meeting-rail)|(?:-bottom-sash)|(?:-(?:left|right)-vertical-muntin)|(?:-horizontal-muntin-\\d+))?$`);
const frontWindowAnyPartPattern = new RegExp(`^(${unitPrefixPattern}front-window-(?:left|right)-\\d+)(?:$|-)`);

export function isFrontDoorLeafComponent(componentId: string): boolean {
  return frontDoorLeafPartPattern.test(componentId);
}

export function frontWindowAssemblyId(componentId: string): string | null {
  const match = componentId.match(frontWindowAnyPartPattern);
  return match?.[1] ?? null;
}

export function isFrontWindowComponent(componentId: string): boolean {
  return frontWindowAssemblyId(componentId) !== null;
}

export function isFrontWindowMovableComponent(componentId: string): boolean {
  return frontWindowBasePattern.test(componentId) || frontWindowMovablePartPattern.test(componentId);
}

function findComponent(components: ModelComponent[], id: string): ModelComponent {
  const component = components.find((item) => item.metadata.id === id);
  if (!component) {
    throw new Error(`Missing door component: ${id}`);
  }
  return component;
}

export function createFrontDoorAssembly(components: ModelComponent[]): FrontDoorAssembly {
  const movingComponents = components.filter((component) => isFrontDoorLeafComponent(component.metadata.id));
  const hangingStile = findComponent(components, "front-door-hanging-stile").object;
  const hinge = new Vector3(hangingStile.position.x, 0, hangingStile.position.z);

  return {
    isOpen: false,
    progress: 0,
    targetProgress: 0,
    hinge,
    closedTransforms: movingComponents.map((component) => ({
      component,
      position: component.object.position.clone(),
      quaternion: component.object.quaternion.clone()
    }))
  };
}

function applyFrontDoorProgress(assembly: FrontDoorAssembly, progress: number): void {
  const angle = (Math.PI / 2.7) * progress;
  const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), angle);

  for (const closed of assembly.closedTransforms) {
    const offset = closed.position.clone().sub(assembly.hinge);
    closed.component.object.position.copy(assembly.hinge).add(offset.applyQuaternion(rotation));
    closed.component.object.quaternion.copy(closed.quaternion).premultiply(rotation);
    closed.component.object.updateMatrixWorld(true);
  }
  assembly.progress = progress;
  assembly.isOpen = progress > 0.5;
}

export function setFrontDoorOpen(assembly: FrontDoorAssembly, isOpen: boolean): void {
  assembly.targetProgress = isOpen ? 1 : 0;
  applyFrontDoorProgress(assembly, assembly.targetProgress);
  assembly.isOpen = isOpen;
}

export function toggleFrontDoor(assembly: FrontDoorAssembly): void {
  assembly.targetProgress = assembly.targetProgress > 0.5 ? 0 : 1;
  assembly.isOpen = assembly.targetProgress > 0.5;
}

export function animateFrontDoor(assembly: FrontDoorAssembly, deltaSeconds: number): void {
  const speed = 4;
  const next = assembly.progress + Math.sign(assembly.targetProgress - assembly.progress) * speed * deltaSeconds;
  const clamped = assembly.targetProgress > assembly.progress
    ? Math.min(assembly.targetProgress, next)
    : Math.max(assembly.targetProgress, next);
  applyFrontDoorProgress(assembly, clamped);
}

export function createFrontDoorAssemblies(components: ModelComponent[]): FrontDoorAssembly[] {
  const byPrefix = new Map<string, ModelComponent[]>();
  for (const component of components) {
    if (!isFrontDoorLeafComponent(component.metadata.id)) {
      continue;
    }
    const prefix = component.metadata.id.match(/^(unit-\d+-)?front-door/)?.[1] ?? "";
    byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), component]);
  }

  return [...byPrefix.entries()].flatMap(([prefix, movingComponents]) => {
    const hangingStile = components.find((component) => component.metadata.id === `${prefix}front-door-hanging-stile`);
    if (!hangingStile) {
      return [];
    }
    const hinge = new Vector3(hangingStile.object.position.x, 0, hangingStile.object.position.z);
    return [{
      isOpen: false,
      progress: 0,
      targetProgress: 0,
      hinge,
      closedTransforms: movingComponents.map((component) => ({
        component,
        position: component.object.position.clone(),
        quaternion: component.object.quaternion.clone()
      }))
    }];
  });
}

export function doorAssemblyForComponent(assemblies: FrontDoorAssembly[], componentId: string): FrontDoorAssembly | undefined {
  return assemblies.find((assembly) =>
    assembly.closedTransforms.some((closed) => closed.component.metadata.id === componentId)
  );
}

export function createWindowAssemblies(components: ModelComponent[]): WindowAssembly[] {
  const byWindow = new Map<string, ModelComponent[]>();
  for (const component of components) {
    if (!isFrontWindowMovableComponent(component.metadata.id)) {
      continue;
    }
    const id = frontWindowAssemblyId(component.metadata.id);
    if (!id) {
      continue;
    }
    byWindow.set(id, [...(byWindow.get(id) ?? []), component]);
  }

  return [...byWindow.entries()].map(([id, movingComponents]) => ({
    id,
    isOpen: false,
    progress: 0,
    targetProgress: 0,
    slideDistanceFt: 1.35,
    closedTransforms: movingComponents.map((component) => ({
      component,
      position: component.object.position.clone()
    }))
  }));
}

function applyWindowProgress(assembly: WindowAssembly, progress: number): void {
  for (const closed of assembly.closedTransforms) {
    closed.component.object.position.copy(closed.position);
    closed.component.object.position.y += assembly.slideDistanceFt * progress;
    closed.component.object.updateMatrixWorld(true);
  }
  assembly.progress = progress;
  assembly.isOpen = progress > 0.5;
}

export function setWindowOpen(assembly: WindowAssembly, isOpen: boolean): void {
  assembly.targetProgress = isOpen ? 1 : 0;
  applyWindowProgress(assembly, assembly.targetProgress);
  assembly.isOpen = isOpen;
}

export function toggleWindow(assembly: WindowAssembly): void {
  assembly.targetProgress = assembly.targetProgress > 0.5 ? 0 : 1;
  assembly.isOpen = assembly.targetProgress > 0.5;
}

export function animateWindow(assembly: WindowAssembly, deltaSeconds: number): void {
  const speed = 3.6;
  const next = assembly.progress + Math.sign(assembly.targetProgress - assembly.progress) * speed * deltaSeconds;
  const clamped = assembly.targetProgress > assembly.progress
    ? Math.min(assembly.targetProgress, next)
    : Math.max(assembly.targetProgress, next);
  applyWindowProgress(assembly, clamped);
}

export function windowAssemblyForComponent(assemblies: WindowAssembly[], componentId: string): WindowAssembly | undefined {
  const id = frontWindowAssemblyId(componentId);
  return id ? assemblies.find((assembly) => assembly.id === id) : undefined;
}
