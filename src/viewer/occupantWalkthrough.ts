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
import { Body, Box, Material, Sphere, Vec3, World } from "cannon-es";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ModelComponent, RowhomeConfig } from "../core/types";

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

const occupantRouteHeightFt = 1.25;
const occupantPhysicsRadiusFt = 0.45;
const physicsStepSeconds = 1 / 60;
const occupantPhysicsSpeedGain = 12;
const maxOccupantPhysicsSpeedFtPerSecond = 9;
const colliderMinHeightFt = 0.7;
const maxNonStairSurfaceRiseFtPerSecond = 1.2;
const defaultFollowCameraCollisionBufferFt = 0.75;

interface NavigationNode {
  id: string;
  position: Vector3;
  links: string[];
}

interface OccupantGoalPlan {
  id: OccupantRouteId;
  label: string;
  goals: string[];
}

interface OccupantPhysics {
  initialized?: boolean;
  world?: World;
  body?: Body;
  support?: Body;
  surfaceY?: number;
  grounded?: boolean;
  colliderKey?: string;
}

export function createOccupantAvatar(): Group {
  const group = new Group();
  group.name = "walkthrough-person";

  const shirt = new MeshStandardMaterial({ color: "#2f6f91", roughness: 0.7 });
  const pants = new MeshStandardMaterial({ color: "#25313a", roughness: 0.8 });
  const skin = new MeshStandardMaterial({ color: "#b98660", roughness: 0.65 });
  const shoes = new MeshStandardMaterial({ color: "#1b1f22", roughness: 0.8 });

  const torso = new Mesh(new CapsuleGeometry(0.38, 0.9, 8, 12), shirt);
  torso.position.set(0, 2.25, 0);
  group.add(torso);

  const head = new Mesh(new SphereGeometry(0.32, 16, 12), skin);
  head.position.set(0, 3.1, 0);
  group.add(head);

  for (const [side, x] of [["left", -0.24], ["right", 0.24]] as const) {
    const leg = new Mesh(new BoxGeometry(0.2, 1.0, 0.22), pants);
    leg.name = `${side}-leg`;
    leg.position.set(x, 0.68, 0);
    group.add(leg);
    const shoe = new Mesh(new BoxGeometry(0.26, 0.12, 0.42), shoes);
    shoe.name = `${side}-shoe`;
    shoe.position.set(x, 0.06, 0.08);
    group.add(shoe);
    const arm = new Mesh(new BoxGeometry(0.16, 0.9, 0.18), shirt);
    arm.name = `${side}-arm`;
    arm.position.set(x < 0 ? -0.5 : 0.5, 2.2, 0);
    group.add(arm);
  }

  group.traverse((object) => {
    object.castShadow = true;
    object.receiveShadow = true;
  });
  group.userData.nonSelectable = true;
  return group;
}

export function walkableSurfaceHeight(config: RowhomeConfig, routePosition: Vector3): number {
  const roofDeckY = config.stories * config.storyHeightFt + 0.16;
  if (routePosition.y >= config.stories * config.storyHeightFt + 0.5) {
    return roofDeckY;
  }
  return Math.max(0, routePosition.y - occupantRouteHeightFt);
}

function isOccupantCollisionComponent(component: ModelComponent): boolean {
  const id = component.metadata.id;
  const text = `${id} ${component.metadata.name} ${component.metadata.material} ${component.metadata.category}`.toLowerCase();
  if (!component.metadata.printable) return false;
  if (component.object.visible === false) return false;
  if (/\b(door|window|glazing|transom|pane|sash|muntin|knob|threshold|clearance|zone|floor plate|roof deck|stair|rail|guard|lamp|heater|thermostat|duct|conduit|circuit|solar|tree|plant|yard|stoop)\b/.test(text)) return false;
  return /\b(wall|facade|partition|gypsum|ceiling|roof insulation|sheathing|insulation|masonry|brick|foundation|parapet|pilaster|surround|furniture|bed|sofa|table|chair|cabinet|countertop|appliance|refrigerator|range|toilet|lavatory|shower|desk)\b/.test(text);
}

function isFollowCameraCollisionComponent(component: ModelComponent): boolean {
  const text = `${component.metadata.id} ${component.metadata.name} ${component.metadata.material} ${component.metadata.category}`.toLowerCase();
  if (!component.metadata.printable) return false;
  if (component.object.visible === false) return false;
  if (/\b(door|window|glazing|transom|pane|sash|muntin|knob|threshold|clearance|zone|floor plate|stair|rail|guard|lamp|heater|thermostat|duct|conduit|circuit|solar|tree|plant|yard|stoop|furniture|bed|sofa|table|chair|cabinet|countertop|appliance|refrigerator|range|toilet|lavatory|shower|desk)\b/.test(text)) return false;
  return /\b(wall|facade|partition|gypsum|ceiling|roof insulation|roof.*air barrier|sheathing|insulation|masonry|brick|foundation|parapet|pilaster|surround)\b/.test(text);
}

function segmentBoxHitT(start: Vector3, end: Vector3, box: Box3): number | null {
  const direction = end.clone().sub(start);
  let tMin = 0;
  let tMax = 1;

  for (const axis of ["x", "y", "z"] as const) {
    const origin = start[axis];
    const delta = direction[axis];
    const min = box.min[axis];
    const max = box.max[axis];
    if (Math.abs(delta) < 1e-6) {
      if (origin < min || origin > max) {
        return null;
      }
      continue;
    }
    const t1 = (min - origin) / delta;
    const t2 = (max - origin) / delta;
    const near = Math.min(t1, t2);
    const far = Math.max(t1, t2);
    tMin = Math.max(tMin, near);
    tMax = Math.min(tMax, far);
    if (tMin > tMax) {
      return null;
    }
  }

  return tMax >= 0 && tMin <= 1 ? Math.max(0, tMin) : null;
}

export function clampFollowCameraToSameSideOfWalls(
  focusPoint: Vector3,
  desiredCameraPosition: Vector3,
  components: ModelComponent[] = [],
  collisionBufferFt = defaultFollowCameraCollisionBufferFt
): Vector3 {
  const desiredOffset = desiredCameraPosition.clone().sub(focusPoint);
  const desiredDistance = desiredOffset.length();
  if (desiredDistance < 0.001 || components.length === 0) {
    return desiredCameraPosition.clone();
  }

  let nearestHitT = 1;
  for (const component of components) {
    if (!isFollowCameraCollisionComponent(component)) {
      continue;
    }
    component.object.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(component.object).expandByScalar(collisionBufferFt * 0.35);
    const hitT = segmentBoxHitT(focusPoint, desiredCameraPosition, bounds);
    if (hitT !== null && hitT > 0.02 && hitT < nearestHitT) {
      nearestHitT = hitT;
    }
  }

  if (nearestHitT >= 1) {
    return desiredCameraPosition.clone();
  }

  const clampedDistance = Math.max(1.2, desiredDistance * nearestHitT - collisionBufferFt);
  return focusPoint.clone().add(desiredOffset.normalize().multiplyScalar(clampedDistance));
}

function addComponentColliders(world: World, components: ModelComponent[] = []): void {
  for (const component of components) {
    if (!isOccupantCollisionComponent(component)) {
      continue;
    }
    component.object.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(component.object);
    const size = new Vector3();
    const center = new Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);
    const text = `${component.metadata.id} ${component.metadata.name} ${component.metadata.material}`.toLowerCase();
    const isHorizontalBarrier = /\b(ceiling|roof insulation|roof.*air barrier)\b/.test(text);
    if ((!isHorizontalBarrier && size.y < colliderMinHeightFt) || size.x < 0.05 || size.z < 0.05) {
      continue;
    }
    const collider = new Body({
      mass: 0,
      shape: new Box(new Vec3(size.x / 2, size.y / 2, size.z / 2)),
      position: new Vec3(center.x, center.y, center.z)
    });
    world.addBody(collider);
  }
}

function isInStairwell(position: Vector3): boolean {
  return position.x >= 1.0 && position.x <= 5.4 && position.z >= 17.0 && position.z <= 34.8;
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

function routePoint(config: RowhomeConfig, x: number, floor: number, y: number): Vector3 {
  return p(x, floor * config.storyHeightFt + occupantRouteHeightFt, y);
}

function stairWaypoints(config: RowhomeConfig, floor: number): Vector3[] {
  const base = floor * config.storyHeightFt;
  const x = 2.8;
  const direction = floor % 2 === 0 ? 1 : -1;
  const yStart = direction === 1 ? 18.4 : 32.6;
  const points: Vector3[] = [];
  for (let step = 0; step <= 16; step += 1) {
    const y = yStart + direction * (step * 0.78 + 0.39);
    const surfaceY = base + Math.min(step * 0.625, config.storyHeightFt);
    points.push(p(x, surfaceY + occupantRouteHeightFt, y));
  }
  const topY = yStart + direction * (16 * 0.78 + 1.7);
  points.push(p(x, base + config.storyHeightFt + occupantRouteHeightFt, topY));
  points.push(p(4.85, base + config.storyHeightFt + occupantRouteHeightFt, topY));
  return points;
}

function navigationGraph(config: RowhomeConfig): NavigationNode[] {
  const frontDoorX = config.buildingWidthFt / 2 - 0.4;
  const rearDoorX = config.buildingWidthFt / 2;
  const doorX = config.buildingWidthFt / 2 - 1.2;
  const nodes: NavigationNode[] = [
    { id: "front-yard", position: p(frontDoorX, occupantRouteHeightFt, -5.0), links: ["entry"] },
    { id: "entry", position: routePoint(config, frontDoorX, 0, 2.8), links: ["front-yard", "living"] },
    { id: "living", position: routePoint(config, 8.8, 0, 10.2), links: ["entry", "dining", "stair-0-bottom"] },
    { id: "dining", position: routePoint(config, 8.8, 0, 23.5), links: ["living", "partition-1-front"] },
    { id: "partition-1-front", position: routePoint(config, doorX, 0, 30.9), links: ["dining", "partition-1-back"] },
    { id: "partition-1-back", position: routePoint(config, doorX, 0, 31.8), links: ["partition-1-front", "kitchen"] },
    { id: "kitchen", position: routePoint(config, 8.6, 0, 39.5), links: ["partition-1-back", "rear-exit"] },
    { id: "rear-exit", position: routePoint(config, rearDoorX, 0, 45.0), links: ["kitchen"] },
    { id: "stair-0-bottom", position: routePoint(config, 2.8, 0, 18.4), links: ["living", "stair-0-top"] },
    { id: "stair-0-top", position: routePoint(config, 4.85, 1, 32.6), links: ["stair-0-bottom", "second-hall", "stair-1-bottom"] },
    { id: "second-hall", position: routePoint(config, 7.2, 1, 28.2), links: ["stair-0-top", "primary-bedroom", "second-bedroom", "bath-2"] },
    { id: "primary-bedroom", position: routePoint(config, 7.2, 1, 8.6), links: ["second-hall"] },
    { id: "second-bedroom", position: routePoint(config, 7.2, 1, 36.0), links: ["second-hall"] },
    { id: "bath-2", position: routePoint(config, 12.6, 1, 28.2), links: ["second-hall"] },
    { id: "stair-1-bottom", position: routePoint(config, 2.8, 1, 32.6), links: ["stair-0-top", "stair-1-top"] },
    { id: "stair-1-top", position: routePoint(config, 4.85, 2, 20.1), links: ["stair-1-bottom", "third-hall", "stair-2-bottom"] },
    { id: "third-hall", position: routePoint(config, 7.2, 2, 24.8), links: ["stair-1-top", "third-bedroom", "office", "bath-3"] },
    { id: "third-bedroom", position: routePoint(config, 7.0, 2, 10.0), links: ["third-hall"] },
    { id: "office", position: routePoint(config, 7.0, 2, 34.0), links: ["third-hall"] },
    { id: "bath-3", position: routePoint(config, 12.6, 2, 28.2), links: ["third-hall"] },
    { id: "stair-2-bottom", position: routePoint(config, 2.8, 2, 18.4), links: ["stair-1-top", "roof"] },
    { id: "roof", position: p(5.75, config.stories * config.storyHeightFt + 0.8, 32.6), links: ["stair-2-bottom", "roof-garden"] },
    { id: "roof-garden", position: p(5.75, config.stories * config.storyHeightFt + 0.8, 36.0), links: ["roof", "roof-planter"] },
    { id: "roof-planter", position: p(5.75, config.stories * config.storyHeightFt + 0.8, 43.0), links: ["roof-garden", "roof-front"] },
    { id: "roof-front", position: p(5.75, config.stories * config.storyHeightFt + 0.8, 29.0), links: ["roof-planter"] }
  ];
  return nodes;
}

function goalPlans(): OccupantGoalPlan[] {
  return [
    { id: "daily-use", label: "Daily Use", goals: ["front-yard", "entry", "living", "dining", "partition-1-front", "partition-1-back", "kitchen", "rear-exit", "kitchen", "partition-1-back", "partition-1-front", "living", "entry"] },
    { id: "stairs-and-bedrooms", label: "Stairs + Bedrooms", goals: ["entry", "living", "stair-0-bottom", "stair-0-top", "primary-bedroom", "second-bedroom", "stair-1-bottom", "stair-1-top", "third-bedroom", "office", "third-hall", "stair-1-top", "stair-1-bottom", "stair-0-top", "stair-0-bottom", "living"] },
    { id: "roof-garden", label: "Roof Garden", goals: ["third-hall", "stair-2-bottom", "roof", "roof-garden", "roof-planter", "roof-front", "roof-planter", "roof-garden", "roof", "stair-2-bottom", "third-hall"] },
    { id: "egress", label: "Egress", goals: ["third-bedroom", "third-hall", "stair-1-top", "stair-1-bottom", "stair-0-top", "stair-0-bottom", "living", "entry", "front-yard"] }
  ];
}

function shortestNodePath(nodes: NavigationNode[], startId: string, goalId: string): string[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const queue = [startId];
  const previous = new Map<string, string | null>([[startId, null]]);
  for (let i = 0; i < queue.length; i += 1) {
    const current = queue[i];
    if (current === goalId) break;
    for (const next of byId.get(current)?.links ?? []) {
      if (!previous.has(next)) {
        previous.set(next, current);
        queue.push(next);
      }
    }
  }
  if (!previous.has(goalId)) return [startId];
  const path: string[] = [];
  for (let at: string | null = goalId; at; at = previous.get(at) ?? null) {
    path.push(at);
  }
  return path.reverse();
}

function expandStairSegment(config: RowhomeConfig, fromId: string, toId: string): Vector3[] | null {
  if (fromId === "stair-0-bottom" && toId === "stair-0-top") return stairWaypoints(config, 0);
  if (fromId === "stair-0-top" && toId === "stair-0-bottom") return stairWaypoints(config, 0).reverse();
  if (fromId === "stair-1-bottom" && toId === "stair-1-top") return stairWaypoints(config, 1);
  if (fromId === "stair-1-top" && toId === "stair-1-bottom") return stairWaypoints(config, 1).reverse();
  if (fromId === "stair-2-bottom" && toId === "roof") return stairWaypoints(config, 2);
  if (fromId === "roof" && toId === "stair-2-bottom") return stairWaypoints(config, 2).reverse();
  return null;
}

export function planOccupantGoalRoute(config: RowhomeConfig, id: OccupantRouteId): OccupantRoute {
  const nodes = navigationGraph(config);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const plan = goalPlans().find((item) => item.id === id) ?? goalPlans()[0];
  const points: Vector3[] = [];

  for (let i = 1; i < plan.goals.length; i += 1) {
    const path = shortestNodePath(nodes, plan.goals[i - 1], plan.goals[i]);
    for (let j = 0; j < path.length; j += 1) {
      const from = path[j - 1];
      const to = path[j];
      const expanded = from ? expandStairSegment(config, from, to) : null;
      const segment = expanded ?? [byId.get(to)?.position].filter((point): point is Vector3 => Boolean(point));
      for (const point of segment) {
        const last = points[points.length - 1];
        if (!last || last.distanceTo(point) > 0.01) {
          points.push(point.clone());
        }
      }
    }
  }

  return { id: plan.id, label: plan.label, points };
}

export function occupantRoutes(config: RowhomeConfig): OccupantRoute[] {
  return goalPlans().map((plan) => planOccupantGoalRoute(config, plan.id));
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
  deltaSeconds: number,
  config?: RowhomeConfig,
  components?: ModelComponent[]
): { position: Vector3; direction: Vector3; progress: number } {
  if (state.enabled && !state.paused) {
    state.elapsedSeconds += deltaSeconds;
  }
  const sample = sampleRoute(route, state.elapsedSeconds, state.speedFtPerSecond);
  let surfaceY = config ? walkableSurfaceHeight(config, sample.position) : sample.position.y - occupantRouteHeightFt;
  const colliderKey = components ? `${components.length}:${config?.buildingWidthFt ?? 0}:${config?.buildingDepthFt ?? 0}:${config?.stories ?? 0}` : "none";
  let physics = avatar.userData.occupantPhysics as OccupantPhysics | undefined ?? {};
  if (!physics.initialized || physics.colliderKey !== colliderKey) {
    const material = new Material("occupant-walkthrough-contact");
    const world = new World({
      gravity: new Vec3(0, -32.174, 0)
    });
    world.defaultContactMaterial.friction = 0.5;
    world.defaultContactMaterial.restitution = 0;

    const support = new Body({
      mass: 0,
      material,
      shape: new Box(new Vec3(80, 0.05, 80)),
      position: new Vec3(sample.position.x, surfaceY - 0.05, sample.position.z)
    });
    const body = new Body({
      mass: 1,
      material,
      shape: new Sphere(occupantPhysicsRadiusFt),
      position: new Vec3(sample.position.x, surfaceY + occupantPhysicsRadiusFt, sample.position.z),
      linearDamping: 0.65,
      angularDamping: 1,
      fixedRotation: true
    });
    world.addBody(support);
    world.addBody(body);
    addComponentColliders(world, components);

    physics = {
      initialized: true,
      world,
      body,
      support,
      surfaceY,
      grounded: true,
      colliderKey
    };
  }

  const body = physics.body;
  const support = physics.support;
  if (body && support && physics.world) {
    const previousSurfaceY = physics.surfaceY ?? surfaceY;
    if (surfaceY > previousSurfaceY && !isInStairwell(new Vector3(body.position.x, body.position.y, body.position.z))) {
      surfaceY = Math.min(surfaceY, previousSurfaceY + maxNonStairSurfaceRiseFtPerSecond * deltaSeconds);
    }
    support.position.set(sample.position.x, surfaceY - 0.05, sample.position.z);
    support.aabbNeedsUpdate = true;
    const targetOffsetX = sample.position.x - body.position.x;
    const targetOffsetZ = sample.position.z - body.position.z;
    body.velocity.x = Math.max(-maxOccupantPhysicsSpeedFtPerSecond, Math.min(maxOccupantPhysicsSpeedFtPerSecond, targetOffsetX * occupantPhysicsSpeedGain));
    body.velocity.z = Math.max(-maxOccupantPhysicsSpeedFtPerSecond, Math.min(maxOccupantPhysicsSpeedFtPerSecond, targetOffsetZ * occupantPhysicsSpeedGain));
    body.angularVelocity.set(0, 0, 0);

    const minimumCenterY = surfaceY + occupantPhysicsRadiusFt;
    if (body.position.y < minimumCenterY || surfaceY > (physics.surfaceY ?? surfaceY)) {
      body.position.y = minimumCenterY;
      body.velocity.y = 0;
    }

    physics.world.step(physicsStepSeconds, Math.min(deltaSeconds, 0.1), 4);
    if (body.position.y < minimumCenterY) {
      body.position.y = minimumCenterY;
      body.velocity.y = 0;
    }
  }
  physics.surfaceY = surfaceY;
  physics.grounded = Boolean(body && Math.abs(body.position.y - (surfaceY + occupantPhysicsRadiusFt)) < 0.03 && Math.abs(body.velocity.y) < 0.05);
  avatar.userData.occupantPhysics = physics;

  const avatarY = body ? body.position.y - occupantPhysicsRadiusFt : surfaceY;
  avatar.visible = state.enabled;
  const avatarX = body ? body.position.x : sample.position.x;
  const avatarZ = body ? body.position.z : sample.position.z;
  avatar.position.set(avatarX, avatarY, avatarZ);
  const facing = body && Math.hypot(body.velocity.x, body.velocity.z) > 0.05
    ? new Vector3(body.velocity.x, 0, body.velocity.z).normalize()
    : sample.direction;
  const yaw = Math.atan2(facing.x, facing.z);
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

  return {
    ...sample,
    position: new Vector3(avatarX, avatarY + occupantRouteHeightFt, avatarZ),
    direction: facing
  };
}
