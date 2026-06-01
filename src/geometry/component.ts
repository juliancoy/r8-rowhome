import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D
} from "three";
import type { ComponentMetadata, ModelComponent } from "../core/types";

type MaterialFamily =
  | "glass"
  | "brick"
  | "stone"
  | "wood"
  | "metal"
  | "duct"
  | "appliance"
  | "concrete"
  | "site"
  | "gypsum"
  | "insulation"
  | "generic";
type ShaderPatch = {
  uniforms: Record<string, { value: number }>;
  vertexShader: string;
  fragmentShader: string;
};

function classifyMaterial(metadata?: ComponentMetadata): MaterialFamily {
  const text = `${metadata?.material ?? ""} ${metadata?.name ?? ""} ${metadata?.category ?? ""}`.toLowerCase();
  if (text.includes("window") || text.includes("glass") || text.includes("glazing")) return "glass";
  if (text.includes("brick") || text.includes("masonry")) return "brick";
  if (text.includes("stone") || text.includes("sill") || text.includes("lintel") || text.includes("coping")) return "stone";
  if (text.includes("wood") || text.includes("cabinet") || text.includes("headboard") || text.includes("table")) return "wood";
  if (text.includes("duct") || text.includes("register")) return "duct";
  if (text.includes("metal") || text.includes("rail") || text.includes("panel") || text.includes("conductor") || text.includes("copper")) return "metal";
  if (text.includes("appliance") || text.includes("range") || text.includes("refrigerator") || text.includes("heat pump") || text.includes("air handler")) return "appliance";
  if (text.includes("concrete") || text.includes("stoop") || text.includes("pad")) return "concrete";
  if (text.includes("site") || text.includes("yard") || text.includes("tree") || text.includes("grass")) return "site";
  if (text.includes("gypsum") || text.includes("drywall") || text.includes("type x")) return "gypsum";
  if (text.includes("insulation") || text.includes("mineral wool") || text.includes("air sealing")) return "insulation";
  return "generic";
}

function addProceduralSurfaceShader(material: MeshStandardMaterial | MeshPhysicalMaterial, family: MaterialFamily): void {
  if (family === "glass" || family === "generic") {
    return;
  }

  const intensityByFamily: Record<Exclude<MaterialFamily, "glass" | "generic">, number> = {
    brick: 0.22,
    stone: 0.14,
    wood: 0.18,
    metal: 0.08,
    duct: 0.10,
    appliance: 0.06,
    concrete: 0.16,
    site: 0.20,
    gypsum: 0.05,
    insulation: 0.24
  };
  const scaleByFamily: Record<Exclude<MaterialFamily, "glass" | "generic">, number> = {
    brick: 3.2,
    stone: 1.7,
    wood: 5.4,
    metal: 7.0,
    duct: 8.0,
    appliance: 6.0,
    concrete: 2.1,
    site: 3.5,
    gypsum: 2.6,
    insulation: 5.8
  };

  const intensity = intensityByFamily[family];
  const scale = scaleByFamily[family];
  material.onBeforeCompile = (shader: ShaderPatch) => {
    shader.uniforms.surfaceVariationIntensity = { value: intensity };
    shader.uniforms.surfaceVariationScale = { value: scale };
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>
       varying vec3 vSurfaceWorldPosition;`
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
       vSurfaceWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
       uniform float surfaceVariationIntensity;
       uniform float surfaceVariationScale;
       varying vec3 vSurfaceWorldPosition;
       float surfaceHash(vec3 p) {
         return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
       }`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
       vec3 cell = floor(vSurfaceWorldPosition * surfaceVariationScale);
       float variation = surfaceHash(cell) - 0.5;
       diffuseColor.rgb *= 1.0 + variation * surfaceVariationIntensity;`
    );
  };
  material.needsUpdate = true;
}

export function makeMaterial(color: string, metadata?: ComponentMetadata): MeshStandardMaterial | MeshPhysicalMaterial {
  const family = classifyMaterial(metadata);
  if (family === "glass") {
    return new MeshPhysicalMaterial({
      color: new Color(color),
      roughness: 0.05,
      metalness: 0,
      transmission: 0.58,
      transparent: true,
      opacity: 0.34,
      ior: 1.45,
      thickness: 0.08,
      depthWrite: false
    });
  }

  const roughnessByFamily: Record<Exclude<MaterialFamily, "glass">, number> = {
    brick: 0.9,
    stone: 0.72,
    wood: 0.62,
    metal: 0.38,
    duct: 0.28,
    appliance: 0.24,
    concrete: 0.86,
    site: 0.95,
    gypsum: 0.82,
    insulation: 0.96,
    generic: 0.74
  };
  const metalnessByFamily: Record<Exclude<MaterialFamily, "glass">, number> = {
    brick: 0.0,
    stone: 0.0,
    wood: 0.0,
    metal: 0.74,
    duct: 0.62,
    appliance: 0.45,
    concrete: 0.0,
    site: 0.0,
    gypsum: 0.0,
    insulation: 0.0,
    generic: 0.02
  };

  const material = new MeshStandardMaterial({
    color: new Color(color),
    roughness: roughnessByFamily[family],
    metalness: metalnessByFamily[family]
  });
  addProceduralSurfaceShader(material, family);
  return material;
}

export function makeBoxComponent(
  metadata: ComponentMetadata,
  color: string,
  width: number,
  depth: number,
  height: number,
  center: { x: number; y: number; z: number },
  rotationYRadians = 0
): ModelComponent {
  const geometry = new BoxGeometry(width, height, depth);
  geometry.computeVertexNormals();
  const mesh = new Mesh(geometry, makeMaterial(color, metadata));
  mesh.position.set(center.x, center.z, center.y);
  mesh.rotation.y = rotationYRadians;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = metadata.name;
  mesh.userData = metadata;
  return { metadata, object: mesh, geometry };
}

export function makeCylinderComponent(
  metadata: ComponentMetadata,
  color: string,
  radius: number,
  height: number,
  center: { x: number; y: number; z: number },
  radialSegments = 18
): ModelComponent {
  const geometry = new CylinderGeometry(radius, radius, height, radialSegments);
  geometry.computeVertexNormals();
  const mesh = new Mesh(geometry, makeMaterial(color, metadata));
  mesh.position.set(center.x, center.z, center.y);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = metadata.name;
  mesh.userData = metadata;
  return { metadata, object: mesh, geometry };
}

export type DuctAxis = "x" | "y" | "z";
export type PipeAxis = "x" | "y" | "z";

export function makeHollowRectangularDuctComponent(
  metadata: ComponentMetadata,
  color: string,
  outerWidth: number,
  outerHeight: number,
  length: number,
  wallThickness: number,
  center: { x: number; y: number; z: number },
  axis: DuctAxis
): ModelComponent {
  const innerWidth = Math.max(outerWidth - wallThickness * 2, wallThickness);
  const innerHeight = Math.max(outerHeight - wallThickness * 2, wallThickness);
  const positions: number[] = [];
  const indices: number[] = [];

  function orient(point: [number, number, number]): [number, number, number] {
    const [x, y, z] = point;
    if (axis === "x") {
      return [z, y, x];
    }
    if (axis === "z") {
      return [x, z, y];
    }
    return [x, y, z];
  }

  function addCuboid(cx: number, cy: number, cz: number, width: number, height: number, depth: number): void {
    const start = positions.length / 3;
    const x0 = cx - width / 2;
    const x1 = cx + width / 2;
    const y0 = cy - height / 2;
    const y1 = cy + height / 2;
    const z0 = cz - depth / 2;
    const z1 = cz + depth / 2;
    for (const point of [
      [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
      [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]
    ] as [number, number, number][]) {
      positions.push(...orient(point));
    }
    indices.push(
      start, start + 1, start + 2, start, start + 2, start + 3,
      start + 4, start + 6, start + 5, start + 4, start + 7, start + 6,
      start, start + 4, start + 5, start, start + 5, start + 1,
      start + 1, start + 5, start + 6, start + 1, start + 6, start + 2,
      start + 2, start + 6, start + 7, start + 2, start + 7, start + 3,
      start + 3, start + 7, start + 4, start + 3, start + 4, start
    );
  }

  addCuboid(0, innerHeight / 2 + wallThickness / 2, 0, outerWidth, wallThickness, length);
  addCuboid(0, -innerHeight / 2 - wallThickness / 2, 0, outerWidth, wallThickness, length);
  addCuboid(-innerWidth / 2 - wallThickness / 2, 0, 0, wallThickness, innerHeight, length);
  addCuboid(innerWidth / 2 + wallThickness / 2, 0, 0, wallThickness, innerHeight, length);

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new Mesh(geometry, makeMaterial(color, metadata));
  mesh.position.set(center.x, center.z, center.y);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = metadata.name;
  mesh.userData = metadata;
  mesh.userData.hvac = {
    hollow: true,
    outerWidthFt: outerWidth,
    outerHeightFt: outerHeight,
    innerWidthFt: innerWidth,
    innerHeightFt: innerHeight,
    lengthFt: length,
    wallThicknessFt: wallThickness,
    axis
  };
  return { metadata, object: mesh, geometry };
}

export function makeHollowPipeComponent(
  metadata: ComponentMetadata,
  color: string,
  outerRadius: number,
  innerRadius: number,
  length: number,
  center: { x: number; y: number; z: number },
  axis: PipeAxis,
  radialSegments = 18
): ModelComponent {
  const positions: number[] = [];
  const indices: number[] = [];
  const safeInnerRadius = Math.max(0.01, Math.min(innerRadius, outerRadius - 0.01));

  function orient(point: [number, number, number]): [number, number, number] {
    const [x, y, z] = point;
    if (axis === "x") {
      return [y, z, x];
    }
    if (axis === "z") {
      return [x, y, z];
    }
    return [x, z, y];
  }

  for (let i = 0; i < radialSegments; i += 1) {
    const angle = (i / radialSegments) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const xOuter = cos * outerRadius;
    const zOuter = sin * outerRadius;
    const xInner = cos * safeInnerRadius;
    const zInner = sin * safeInnerRadius;
    for (const y of [-length / 2, length / 2]) {
      positions.push(...orient([xOuter, y, zOuter]));
      positions.push(...orient([xInner, y, zInner]));
    }
  }

  for (let i = 0; i < radialSegments; i += 1) {
    const next = (i + 1) % radialSegments;
    const a = i * 4;
    const b = next * 4;
    indices.push(a, b, b + 2, a, b + 2, a + 2);
    indices.push(a + 1, a + 3, b + 3, a + 1, b + 3, b + 1);
    indices.push(a + 2, b + 2, b + 3, a + 2, b + 3, a + 3);
    indices.push(a, a + 1, b + 1, a, b + 1, b);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new Mesh(geometry, makeMaterial(color, metadata));
  mesh.position.set(center.x, center.z, center.y);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = metadata.name;
  mesh.userData = metadata;
  mesh.userData.plumbing = {
    hollow: true,
    outerRadiusFt: outerRadius,
    innerRadiusFt: safeInnerRadius,
    innerDiameterFt: safeInnerRadius * 2,
    lengthFt: length,
    axis
  };
  return { metadata, object: mesh, geometry };
}

export function makeCurvedFacadeComponent(
  metadata: ComponentMetadata,
  color: string,
  width: number,
  thickness: number,
  height: number,
  bowDepth: number,
  center: { x: number; y: number; z: number },
  segments = 18
): ModelComponent {
  const positions: number[] = [];
  const indices: number[] = [];
  const radius = (width * width) / (8 * bowDepth) + bowDepth / 2;
  const radiusOffset = radius - bowDepth;

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const x = (t - 0.5) * width;
    const bow = Math.sqrt(Math.max(0, radius * radius - x * x)) - radiusOffset;
    const frontZ = -thickness - bow;
    const backZ = -bow;
    positions.push(x, 0, frontZ, x, height, frontZ, x, 0, backZ, x, height, backZ);
  }

  for (let i = 0; i < segments; i += 1) {
    const a = i * 4;
    const b = (i + 1) * 4;
    indices.push(a, b, b + 1, a, b + 1, a + 1);
    indices.push(a + 2, a + 3, b + 3, a + 2, b + 3, b + 2);
    indices.push(a + 1, b + 1, b + 3, a + 1, b + 3, a + 3);
    indices.push(a, a + 2, b + 2, a, b + 2, b);
  }

  indices.push(0, 1, 3, 0, 3, 2);
  const end = segments * 4;
  indices.push(end, end + 2, end + 3, end, end + 3, end + 1);

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new Mesh(geometry, makeMaterial(color, metadata));
  mesh.position.set(center.x, center.z, center.y);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = metadata.name;
  mesh.userData = metadata;
  return { metadata, object: mesh, geometry };
}

export function modelGroup(components: ModelComponent[]): Group {
  const group = new Group();
  group.name = "R8 rowhome model";
  for (const component of components) {
    group.add(component.object);
  }
  return group;
}

export function cloneWorldObject(component: ModelComponent): Object3D {
  const object = component.object.clone(true);
  object.updateMatrixWorld(true);
  return object;
}

export function geometryTriangleCount(geometry: BufferGeometry): number {
  const index = geometry.getIndex();
  if (index) {
    return index.count / 3;
  }
  const position = geometry.getAttribute("position");
  return position.count / 3;
}
