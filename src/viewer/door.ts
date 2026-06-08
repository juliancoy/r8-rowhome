import { Box3, Quaternion, Vector3 } from "three";
import type { ModelComponent } from "../core/types";

interface ClosedDoorTransform {
  component: ModelComponent;
  position: Vector3;
  quaternion: Quaternion;
}

export interface DoorAssembly {
  id: string;
  isOpen: boolean;
  progress: number;
  targetProgress: number;
  hinge: Vector3;
  closedTransforms: ClosedDoorTransform[];
}

export type FrontDoorAssembly = DoorAssembly;

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
const rearDoorLeafPartPattern = new RegExp(`^${unitPrefixPattern}rear-exit-door-\\d+(?:-panic-handle)?$`);
const roofAccessDoorLeafPartPattern = new RegExp(`^${unitPrefixPattern}architect-roof-access-rated-door$`);
const frontWindowBasePattern = new RegExp(`^${unitPrefixPattern}front-window-(?:left|right)-\\d+$`);
const frontWindowMovablePartPattern = new RegExp(`^(${unitPrefixPattern}front-window-(?:left|right)-\\d+)(?:(?:-meeting-rail)|(?:-bottom-sash)|(?:-(?:left|right)-vertical-muntin)|(?:-horizontal-muntin-\\d+))?$`);
const frontWindowAnyPartPattern = new RegExp(`^(${unitPrefixPattern}front-window-(?:left|right)-\\d+)(?:$|-)`);

export function isFrontDoorLeafComponent(componentId: string): boolean {
  return frontDoorLeafPartPattern.test(componentId);
}

export function doorAssemblyId(componentId: string): string | null {
  if (frontDoorLeafPartPattern.test(componentId)) {
    const prefix = componentId.match(/^(unit-\d+-)?front-door/)?.[1] ?? "";
    return `${prefix}front-door`;
  }
  const rearMatch = componentId.match(new RegExp(`^(${unitPrefixPattern}rear-exit-door-\\d+)(?:-panic-handle)?$`));
  if (rearMatch) {
    return rearMatch[1];
  }
  const roofMatch = componentId.match(new RegExp(`^(${unitPrefixPattern}architect-roof-access-rated-door)$`));
  return roofMatch?.[1] ?? null;
}

export function isDoorLeafComponent(componentId: string): boolean {
  return doorAssemblyId(componentId) !== null;
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
    id: "front-door",
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

function applyDoorProgress(assembly: DoorAssembly, progress: number): void {
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

export function setDoorOpen(assembly: DoorAssembly, isOpen: boolean): void {
  assembly.targetProgress = isOpen ? 1 : 0;
  applyDoorProgress(assembly, assembly.targetProgress);
  assembly.isOpen = isOpen;
}

export function toggleDoor(assembly: DoorAssembly): void {
  assembly.targetProgress = assembly.targetProgress > 0.5 ? 0 : 1;
  assembly.isOpen = assembly.targetProgress > 0.5;
}

export function animateDoor(assembly: DoorAssembly, deltaSeconds: number): void {
  const speed = 4;
  const next = assembly.progress + Math.sign(assembly.targetProgress - assembly.progress) * speed * deltaSeconds;
  const clamped = assembly.targetProgress > assembly.progress
    ? Math.min(assembly.targetProgress, next)
    : Math.max(assembly.targetProgress, next);
  applyDoorProgress(assembly, clamped);
}

function hingeForDoor(id: string, movingComponents: ModelComponent[], components: ModelComponent[]): Vector3 | null {
  if (id.endsWith("front-door")) {
    const hangingStile = components.find((component) => component.metadata.id === `${id.replace(/front-door$/, "")}front-door-hanging-stile`);
    if (hangingStile) {
      return new Vector3(hangingStile.object.position.x, 0, hangingStile.object.position.z);
    }
  }
  const leaf = movingComponents.find((component) => component.metadata.id === id) ?? movingComponents[0];
  if (!leaf) {
    return null;
  }
  leaf.object.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(leaf.object);
  const center = new Vector3();
  bounds.getCenter(center);
  return new Vector3(bounds.min.x, 0, center.z);
}

export function createDoorAssemblies(components: ModelComponent[]): DoorAssembly[] {
  const byPrefix = new Map<string, ModelComponent[]>();
  for (const component of components) {
    const id = doorAssemblyId(component.metadata.id);
    if (!id) {
      continue;
    }
    byPrefix.set(id, [...(byPrefix.get(id) ?? []), component]);
  }

  return [...byPrefix.entries()].flatMap(([id, movingComponents]) => {
    const hinge = hingeForDoor(id, movingComponents, components);
    if (!hinge) {
      return [];
    }
    for (const component of movingComponents) {
      component.object.userData.interactionClass = "hinged-door";
      component.object.userData.doorAssemblyId = id;
    }
    return [{
      id,
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

export function createFrontDoorAssemblies(components: ModelComponent[]): FrontDoorAssembly[] {
  return createDoorAssemblies(components).filter((assembly) => assembly.id.endsWith("front-door"));
}

export function doorAssemblyForComponent(assemblies: DoorAssembly[], componentId: string): DoorAssembly | undefined {
  const id = doorAssemblyId(componentId);
  return id ? assemblies.find((assembly) => assembly.id === id) : undefined;
}

export const setFrontDoorOpen = setDoorOpen;
export const toggleFrontDoor = toggleDoor;
export const animateFrontDoor = animateDoor;

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
