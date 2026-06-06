import {
  AnimationMixer,
  Box3,
  BoxGeometry,
  CapsuleGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Vector3
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { RowhomeConfig } from "../core/types";

export type OccupantRouteId = "daily-use" | "stairs-and-bedrooms" | "roof-garden" | "egress";

export const sketchfabOccupantModelUrl = "/models/sketchfab/nathan-animated-walking-man/scene.gltf";
export const sketchfabOccupantAttribution = {
  title: "Nathan Animated 003 - Walking 3D Man",
  author: "Renderpeople",
  source: "https://sketchfab.com/3d-models/nathan-animated-003-walking-3d-man-143a2b1ea5eb4385ae90a73657aca3bc",
  license: "Creative Commons Attribution 4.0"
} as const;

export interface OccupantRoute {
  id: OccupantRouteId;
  label: string;
  points: Vector3[];
}

export interface OccupantWalkthroughState {
  enabled: boolean;
  paused: boolean;
  routeId: OccupantRouteId;
  elapsedSeconds: number;
  speedFtPerSecond: number;
  followCamera: boolean;
}

export function createOccupantAvatar(): Group {
  const group = new Group();
  group.name = "walkthrough-person";

  const shirt = new MeshStandardMaterial({ color: "#2f6f91", roughness: 0.7 });
  const pants = new MeshStandardMaterial({ color: "#25313a", roughness: 0.8 });
  const skin = new MeshStandardMaterial({ color: "#b98660", roughness: 0.65 });
  const shoes = new MeshStandardMaterial({ color: "#1b1f22", roughness: 0.8 });

  const torso = new Mesh(new CapsuleGeometry(0.38, 0.9, 8, 12), shirt);
  torso.position.set(0, 3.05, 0);
  group.add(torso);

  const head = new Mesh(new SphereGeometry(0.32, 16, 12), skin);
  head.position.set(0, 3.9, 0);
  group.add(head);

  for (const [side, x] of [["left", -0.24], ["right", 0.24]] as const) {
    const leg = new Mesh(new BoxGeometry(0.2, 1.0, 0.22), pants);
    leg.name = `${side}-leg`;
    leg.position.set(x, 2.0, 0);
    group.add(leg);
    const shoe = new Mesh(new BoxGeometry(0.26, 0.12, 0.42), shoes);
    shoe.name = `${side}-shoe`;
    shoe.position.set(x, 1.43, 0.08);
    group.add(shoe);
    const arm = new Mesh(new BoxGeometry(0.16, 0.9, 0.18), shirt);
    arm.name = `${side}-arm`;
    arm.position.set(x < 0 ? -0.5 : 0.5, 3.0, 0);
    group.add(arm);
  }

  group.traverse((object) => {
    object.castShadow = true;
    object.receiveShadow = true;
  });
  group.userData.nonSelectable = true;
  return group;
}

export interface OccupantAssetController {
  update: (deltaSeconds: number) => void;
}

function makeProceduralAvatarVisible(avatar: Group, visible: boolean): void {
  for (const child of avatar.children) {
    if (child.name !== "sketchfab-walking-person") {
      child.visible = visible;
    }
  }
}

function fitObjectToAvatar(object: Object3D, heightFt: number): void {
  const bounds = new Box3().setFromObject(object);
  const size = new Vector3();
  bounds.getSize(size);
  const sourceHeight = Math.max(size.y, 0.001);
  const scale = heightFt / sourceHeight;
  object.scale.setScalar(scale);

  const scaledBounds = new Box3().setFromObject(object);
  const center = new Vector3();
  scaledBounds.getCenter(center);
  object.position.sub(new Vector3(center.x, scaledBounds.min.y, center.z));
}

export function attachOccupantAsset(
  avatar: Group,
  modelUrl = sketchfabOccupantModelUrl
): OccupantAssetController {
  const loader = new GLTFLoader();
  let mixer: AnimationMixer | null = null;

  loader.load(
    modelUrl,
    (gltf) => {
      const asset = gltf.scene;
      asset.name = "sketchfab-walking-person";
      fitObjectToAvatar(asset, 5.6);
      asset.traverse((object) => {
        object.castShadow = true;
        object.receiveShadow = true;
      });
      avatar.add(asset);
      makeProceduralAvatarVisible(avatar, false);

      if (gltf.animations.length > 0) {
        mixer = new AnimationMixer(asset);
        mixer.clipAction(gltf.animations[0]).play();
      }
    },
    undefined,
    () => {
      makeProceduralAvatarVisible(avatar, true);
    }
  );

  return {
    update(deltaSeconds: number): void {
      mixer?.update(deltaSeconds);
    }
  };
}

function p(x: number, y: number, z: number): Vector3 {
  return new Vector3(x, y, z);
}

export function occupantRoutes(config: RowhomeConfig): OccupantRoute[] {
  const story = config.storyHeightFt;
  const roofY = config.stories * story + 0.8;
  return [
    {
      id: "daily-use",
      label: "Daily Use",
      points: [
        p(8.6, 1.25, -5.0),
        p(8.6, 1.25, 2.6),
        p(9.8, 1.25, 9.0),
        p(10.0, 1.25, 13.0),
        p(9.2, 1.25, 24.0),
        p(11.0, 1.25, 36.0),
        p(13.5, 1.25, 39.5),
        p(10.0, 1.25, 41.0),
        p(9.0, 1.25, 25.0),
        p(8.6, 1.25, 2.6)
      ]
    },
    {
      id: "stairs-and-bedrooms",
      label: "Stairs + Bedrooms",
      points: [
        p(8.6, 1.25, 6.0),
        p(5.1, 1.25, 18.5),
        p(2.8, story + 1.25, 32.6),
        p(8.2, story + 1.25, 29.0),
        p(10.8, story + 1.25, 35.5),
        p(8.4, story + 1.25, 17.0),
        p(2.8, story * 2 + 1.25, 18.4),
        p(10.8, story * 2 + 1.25, 10.0),
        p(10.6, story * 2 + 1.25, 34.0),
        p(2.8, story + 1.25, 32.6),
        p(5.1, 1.25, 18.5)
      ]
    },
    {
      id: "roof-garden",
      label: "Roof Garden",
      points: [
        p(2.8, story * 2 + 1.25, 18.4),
        p(2.8, roofY, 32.6),
        p(4.45, roofY, 34.5),
        p(4.45, roofY, 22.0),
        p(2.75, roofY, 15.0),
        p(2.75, roofY, 8.8),
        p(5.2, roofY, 9.0),
        p(2.8, roofY, 32.6)
      ]
    },
    {
      id: "egress",
      label: "Egress",
      points: [
        p(10.8, story * 2 + 1.25, 10.0),
        p(9.0, story * 2 + 1.25, 30.5),
        p(9.0, story * 2 + 1.25, 48.0),
        p(9.0, story + 1.25, 50.5),
        p(9.0, 1.25, 50.5),
        p(9.0, 1.25, 57.0)
      ]
    }
  ];
}

function routeLength(points: Vector3[]): number {
  return points.reduce((sum, point, index) => index === 0 ? 0 : sum + point.distanceTo(points[index - 1]), 0);
}

export function routeById(config: RowhomeConfig, id: OccupantRouteId): OccupantRoute {
  return occupantRoutes(config).find((route) => route.id === id) ?? occupantRoutes(config)[0];
}

export function sampleRoute(route: OccupantRoute, elapsedSeconds: number, speedFtPerSecond: number): {
  position: Vector3;
  direction: Vector3;
  progress: number;
} {
  const totalLength = Math.max(routeLength(route.points), 0.001);
  const distance = (elapsedSeconds * speedFtPerSecond) % totalLength;
  let walked = 0;
  for (let i = 1; i < route.points.length; i += 1) {
    const start = route.points[i - 1];
    const end = route.points[i];
    const segmentLength = start.distanceTo(end);
    if (walked + segmentLength >= distance) {
      const t = (distance - walked) / Math.max(segmentLength, 0.001);
      const position = start.clone().lerp(end, t);
      const direction = end.clone().sub(start).normalize();
      return {
        position,
        direction,
        progress: distance / totalLength
      };
    }
    walked += segmentLength;
  }
  const final = route.points[route.points.length - 1].clone();
  return {
    position: final,
    direction: new Vector3(0, 0, 1),
    progress: 1
  };
}

export function updateOccupantAvatar(
  avatar: Group,
  route: OccupantRoute,
  state: OccupantWalkthroughState,
  deltaSeconds: number
): { position: Vector3; direction: Vector3; progress: number } {
  if (state.enabled && !state.paused) {
    state.elapsedSeconds += deltaSeconds;
  }
  const sample = sampleRoute(route, state.elapsedSeconds, state.speedFtPerSecond);
  avatar.visible = state.enabled;
  avatar.position.copy(sample.position);
  const yaw = Math.atan2(sample.direction.x, sample.direction.z);
  avatar.rotation.set(0, yaw, 0);

  const stride = Math.sin(state.elapsedSeconds * state.speedFtPerSecond * 4.5) * 0.18;
  const leftLeg = avatar.getObjectByName("left-leg");
  const rightLeg = avatar.getObjectByName("right-leg");
  const leftArm = avatar.getObjectByName("left-arm");
  const rightArm = avatar.getObjectByName("right-arm");
  if (leftLeg) leftLeg.rotation.x = stride;
  if (rightLeg) rightLeg.rotation.x = -stride;
  if (leftArm) leftArm.rotation.x = -stride;
  if (rightArm) rightArm.rotation.x = stride;

  return sample;
}
