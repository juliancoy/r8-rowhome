import { Quaternion, Vector3 } from "three";
import type { ModelComponent } from "../core/types";

interface ClosedDoorTransform {
  component: ModelComponent;
  position: Vector3;
  quaternion: Quaternion;
}

export interface FrontDoorAssembly {
  isOpen: boolean;
  hinge: Vector3;
  closedTransforms: ClosedDoorTransform[];
}

const frontDoorLeafPartPattern = /^front-door(?:(?:-(?:top|lock|bottom)-rail)|(?:-(?:hanging|lock|center)-stile)|(?:-(?:upper|lower)-(?:left|right)-panel)|(?:-knob))?$/;

export function isFrontDoorLeafComponent(componentId: string): boolean {
  return frontDoorLeafPartPattern.test(componentId);
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
    hinge,
    closedTransforms: movingComponents.map((component) => ({
      component,
      position: component.object.position.clone(),
      quaternion: component.object.quaternion.clone()
    }))
  };
}

export function setFrontDoorOpen(assembly: FrontDoorAssembly, isOpen: boolean): void {
  const angle = isOpen ? Math.PI / 2.7 : 0;
  const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), angle);

  for (const closed of assembly.closedTransforms) {
    const offset = closed.position.clone().sub(assembly.hinge);
    closed.component.object.position.copy(assembly.hinge).add(offset.applyQuaternion(rotation));
    closed.component.object.quaternion.copy(closed.quaternion).premultiply(rotation);
    closed.component.object.updateMatrixWorld(true);
  }

  assembly.isOpen = isOpen;
}

export function toggleFrontDoor(assembly: FrontDoorAssembly): void {
  setFrontDoorOpen(assembly, !assembly.isOpen);
}
