import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Color,
  CylinderGeometry,
  DataTexture,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  MeshNormalMaterial,
  Object3D,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  ShaderMaterial,
  type Texture
} from "three";
import type { ComponentMetadata, ModelComponent, RenderMaterialStyle } from "../core/types";

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
type TexturedMaterialFamily = Exclude<MaterialFamily, "glass" | "generic">;
type SurfaceTextureSet = {
  colorMap: Texture;
  bumpMap: Texture;
  bumpScale: number;
};

const surfaceTextureCache = new Map<TexturedMaterialFamily, SurfaceTextureSet>();
type AppearanceOption = { value: RenderMaterialStyle; label: string };
type RenderStyledObject = Object3D & {
  isMesh?: boolean;
  isInstancedMesh?: boolean;
  material?: Material | Material[];
  userData: Object3D["userData"] & {
    originalRenderMaterials?: Material[];
    originalRenderMaterialsWereArray?: boolean;
    renderMaterialStyle?: RenderMaterialStyle;
  };
};

export const renderMaterialOptions: AppearanceOption[] = [
  { value: "standard", label: "Standard" },
  { value: "brushed-metal", label: "Brushed metal" },
  { value: "polished-metal", label: "Polished metal" },
  { value: "iridescent", label: "Iridescent metal" },
  { value: "pearl", label: "Pearlescent" },
  { value: "glass", label: "Tinted glass" },
  { value: "emissive", label: "Neon glow" },
  { value: "hologram", label: "Hologram" },
  { value: "xray", label: "X-ray" },
  { value: "phong", label: "Phong" },
  { value: "toon", label: "Toon" },
  { value: "normal", label: "Normals" },
  { value: "wireframe", label: "Wireframe" }
];
const proceduralBrickTextureModules = {
  horizontal: 4,
  vertical: 8
} as const;

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

function hash2(x: number, y: number, seed: number): number {
  return Math.abs(Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453) % 1;
}

function surfaceValue(family: TexturedMaterialFamily, x: number, y: number, size: number): number {
  const noise = hash2(x, y, family.length);
  if (family === "brick") {
    const brickWidth = 16;
    const brickHeight = 8;
    const course = Math.floor(y / brickHeight);
    const shiftedX = (x + (course % 2) * brickWidth * 0.5) % brickWidth;
    const mortar = shiftedX < 1 || y % brickHeight < 1;
    return mortar ? 0.48 : 0.82 + noise * 0.14;
  }
  if (family === "wood") {
    const grain = Math.sin((x / size) * Math.PI * 18 + Math.sin(y * 0.18) * 0.8);
    return 0.70 + grain * 0.10 + noise * 0.08;
  }
  if (family === "metal" || family === "duct" || family === "appliance") {
    const seam = x % 18 < 1 || y % 18 < 1;
    return seam ? 0.62 : 0.82 + Math.sin((x + y) * 0.55) * 0.04 + noise * 0.05;
  }
  if (family === "site") {
    return 0.55 + noise * 0.34 + Math.sin(x * 0.9) * Math.sin(y * 0.7) * 0.08;
  }
  if (family === "insulation") {
    return 0.58 + noise * 0.30 + Math.sin((x - y) * 0.9) * 0.10;
  }
  if (family === "gypsum") {
    return 0.80 + noise * 0.08;
  }
  if (family === "stone" || family === "concrete") {
    return 0.66 + noise * 0.22 + Math.sin(x * 0.32) * Math.sin(y * 0.21) * 0.06;
  }
  return 0.78 + noise * 0.10;
}

function makeSurfaceTexture(family: TexturedMaterialFamily, bump: boolean): Texture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = Math.max(0, Math.min(1, surfaceValue(family, x, y, size)));
      const channel = Math.round((bump ? value : 0.45 + value * 0.55) * 255);
      const offset = (y * size + x) * 4;
      data[offset] = channel;
      data[offset + 1] = channel;
      data[offset + 2] = channel;
      data[offset + 3] = 255;
    }
  }

  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(5.0, 5.0);
  if (!bump) {
    texture.colorSpace = SRGBColorSpace;
  }
  texture.needsUpdate = true;
  return texture;
}

function surfaceTextures(family: TexturedMaterialFamily): SurfaceTextureSet {
  const cached = surfaceTextureCache.get(family);
  if (cached) {
    return cached;
  }

  const bumpScaleByFamily: Record<TexturedMaterialFamily, number> = {
    brick: 0.035,
    stone: 0.025,
    wood: 0.018,
    metal: 0.007,
    duct: 0.006,
    appliance: 0.004,
    concrete: 0.022,
    site: 0.018,
    gypsum: 0.005,
    insulation: 0.03
  };
  const textures = {
    colorMap: makeSurfaceTexture(family, false),
    bumpMap: makeSurfaceTexture(family, true),
    bumpScale: bumpScaleByFamily[family]
  };
  surfaceTextureCache.set(family, textures);
  return textures;
}

function addPlanarUvCoordinates(geometry: BufferGeometry): void {
  const position = geometry.getAttribute("position");
  if (!position || geometry.getAttribute("uv")) {
    return;
  }

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }

  type UvAxis = "x" | "y" | "z";
  const ranges = ([
    { axis: "x", min: minX, range: Math.max(maxX - minX, 0.0001) },
    { axis: "y", min: minY, range: Math.max(maxY - minY, 0.0001) },
    { axis: "z", min: minZ, range: Math.max(maxZ - minZ, 0.0001) }
  ] satisfies Array<{ axis: UvAxis; min: number; range: number }>).sort((a, b) => b.range - a.range);
  const uAxis = ranges[0];
  const vAxis = ranges[1];
  const uvs: number[] = [];

  for (let i = 0; i < position.count; i += 1) {
    const valueByAxis = {
      x: position.getX(i),
      y: position.getY(i),
      z: position.getZ(i)
    };
    uvs.push((valueByAxis[uAxis.axis] - uAxis.min) / uAxis.range);
    uvs.push((valueByAxis[vAxis.axis] - vAxis.min) / vAxis.range);
  }

  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
}

function addProceduralSurfaceTextures(material: MeshStandardMaterial | MeshPhysicalMaterial, family: MaterialFamily): void {
  if (family === "glass" || family === "generic") {
    return;
  }

  const textures = surfaceTextures(family);
  material.map = textures.colorMap;
  material.bumpMap = textures.bumpMap;
  material.bumpScale = textures.bumpScale;
  material.needsUpdate = true;
}

function scaleBrickTextureToModule(
  material: MeshStandardMaterial | MeshPhysicalMaterial,
  metadata: ComponentMetadata | undefined,
  width: number,
  depth: number,
  height: number
): void {
  if (classifyMaterial(metadata) !== "brick") {
    return;
  }

  const horizontalModuleFt = 8 / 12;
  const verticalModuleFt = 2.625 / 12;
  const repeatX = Math.max(1, Math.max(width, depth) / horizontalModuleFt / proceduralBrickTextureModules.horizontal);
  const repeatY = Math.max(1, height / verticalModuleFt / proceduralBrickTextureModules.vertical);
  if (material.map) {
    material.map = material.map.clone();
    material.map.repeat.set(repeatX, repeatY);
    material.map.needsUpdate = true;
  }
  if (material.bumpMap) {
    material.bumpMap = material.bumpMap.clone();
    material.bumpMap.repeat.set(repeatX, repeatY);
    material.bumpMap.needsUpdate = true;
  }
  material.needsUpdate = true;
}

export function makeMaterial(color: string, metadata?: ComponentMetadata): MeshStandardMaterial | MeshPhysicalMaterial {
  const text = `${metadata?.material ?? ""} ${metadata?.name ?? ""}`.toLowerCase();
  if (/\bphotovoltaic|solar module\b/.test(text)) {
    return new MeshPhysicalMaterial({
      color: new Color(color),
      roughness: 0.18,
      metalness: 0.12,
      transmission: 0.08,
      transparent: true,
      opacity: 0.92,
      ior: 1.42,
      thickness: 0.12,
      emissive: new Color("#163a58"),
      emissiveIntensity: 0.18
    });
  }

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
  addProceduralSurfaceTextures(material, family);
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
  const material = makeMaterial(color, metadata);
  scaleBrickTextureToModule(material, metadata, width, depth, height);
  const mesh = new Mesh(geometry, material);
  mesh.position.set(center.x, center.z, center.y);
  mesh.rotation.y = rotationYRadians;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = metadata.name;
  mesh.userData = metadata;
  return { metadata, object: mesh, geometry };
}

export function makeInstancedBoxComponent(
  metadata: ComponentMetadata,
  color: string,
  width: number,
  depth: number,
  height: number,
  transforms: Matrix4[],
  shadows: { cast?: boolean; receive?: boolean } = {}
): ModelComponent {
  const geometry = new BoxGeometry(width, height, depth);
  geometry.computeVertexNormals();
  const mesh = new InstancedMesh(geometry, makeMaterial(color, metadata), transforms.length);
  transforms.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = shadows.cast ?? true;
  mesh.receiveShadow = shadows.receive ?? true;
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
  addPlanarUvCoordinates(geometry);
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
  addPlanarUvCoordinates(geometry);
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
  addPlanarUvCoordinates(geometry);
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = makeMaterial(color, metadata);
  scaleBrickTextureToModule(material, metadata, width, thickness, height);
  const mesh = new Mesh(geometry, material);
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

function isRenderableMaterialTarget(object: Object3D): object is RenderStyledObject {
  const candidate = object as RenderStyledObject;
  return Boolean((candidate.isMesh || candidate.isInstancedMesh) && candidate.material);
}

function overrideMaterial(style: RenderMaterialStyle, color: Color): Material {
  const common = { color, side: DoubleSide };
  if (style === "brushed-metal") {
    return new MeshPhysicalMaterial({
      ...common,
      metalness: 0.92,
      roughness: 0.3,
      clearcoat: 0.25,
      clearcoatRoughness: 0.22,
      anisotropy: 0.7
    });
  }
  if (style === "polished-metal") {
    return new MeshPhysicalMaterial({
      ...common,
      metalness: 1,
      roughness: 0.06,
      clearcoat: 1,
      clearcoatRoughness: 0.04
    });
  }
  if (style === "iridescent") {
    return new MeshPhysicalMaterial({
      ...common,
      metalness: 0.58,
      roughness: 0.18,
      clearcoat: 1,
      iridescence: 1,
      iridescenceIOR: 1.6,
      iridescenceThicknessRange: [120, 900]
    });
  }
  if (style === "pearl") {
    return new MeshPhysicalMaterial({
      ...common,
      metalness: 0.05,
      roughness: 0.24,
      clearcoat: 1,
      sheen: 1,
      sheenColor: color.clone().offsetHSL(0.08, 0.1, 0.2),
      iridescence: 0.4,
      iridescenceThicknessRange: [100, 420]
    });
  }
  if (style === "glass") {
    return new MeshPhysicalMaterial({
      ...common,
      metalness: 0,
      roughness: 0.08,
      transmission: 0.9,
      thickness: 0.8,
      ior: 1.46,
      transparent: true,
      opacity: 0.68,
      depthWrite: false
    });
  }
  if (style === "emissive") {
    return new MeshStandardMaterial({
      ...common,
      roughness: 0.3,
      emissive: color,
      emissiveIntensity: 1.8,
      toneMapped: false
    });
  }
  if (style === "xray") {
    return new MeshBasicMaterial({
      ...common,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: AdditiveBlending
    });
  }
  if (style === "hologram") {
    return new ShaderMaterial({
      side: DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        baseColor: { value: color },
        time: { value: 0 }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        void main() {
          vNormal = normalize(mat3(modelMatrix) * normal);
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 baseColor;
        uniform float time;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        void main() {
          vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
          float fresnel = pow(1.0 - abs(dot(normalize(vNormal), viewDirection)), 2.2);
          float scan = 0.5 + 0.5 * sin(vWorldPosition.z * 420.0 - time * 5.0);
          vec3 rainbow = 0.5 + 0.5 * cos(
            6.28318 * (fresnel + vec3(0.0, 0.33, 0.67) + time * 0.04)
          );
          vec3 glow = mix(baseColor, rainbow, 0.62) * (0.55 + fresnel + scan * 0.22);
          gl_FragColor = vec4(glow, 0.38 + fresnel * 0.52);
        }
      `
    });
  }
  if (style === "phong") {
    return new MeshPhongMaterial({ ...common, shininess: 80 });
  }
  if (style === "toon") {
    return new MeshToonMaterial(common);
  }
  if (style === "normal") {
    return new MeshNormalMaterial({ side: 2 });
  }
  if (style === "wireframe") {
    return new MeshBasicMaterial({ ...common, wireframe: true });
  }
  return new MeshStandardMaterial({ ...common, roughness: 0.55, metalness: 0.02 });
}

export function updateRenderMaterialAnimations(root: Object3D, nowMs: number): void {
  root.traverse((object) => {
    if (!isRenderableMaterialTarget(object) || !object.material) {
      return;
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      const shaderMaterial = material as ShaderMaterial & {
        uniforms?: { time?: { value: number } };
      };
      if (shaderMaterial.uniforms?.time) {
        shaderMaterial.uniforms.time.value = nowMs / 1000;
      }
    }
  });
}

function materialBaseColor(material: Material): Color {
  const source = material as Material & { color?: Color };
  return source.color ? source.color.clone() : new Color("#c7b28a");
}

function disposeOverrideMaterials(object: RenderStyledObject): void {
  if (object.userData.renderMaterialStyle === "standard" || !object.material) {
    return;
  }
  const currentMaterials = Array.isArray(object.material) ? object.material : [object.material];
  for (const material of currentMaterials) {
    if (!object.userData.originalRenderMaterials?.includes(material)) {
      material.dispose();
    }
  }
}

export function applyRenderMaterialStyle(root: Object3D, style: RenderMaterialStyle): void {
  root.traverse((object) => {
    if (!isRenderableMaterialTarget(object)) {
      return;
    }
    const materialProperty = object.material;
    const currentMaterials: Material[] = Array.isArray(materialProperty)
      ? materialProperty.filter((material): material is Material => Boolean(material))
      : materialProperty ? [materialProperty] : [];
    if (currentMaterials.length === 0) {
      return;
    }
    if (!object.userData.originalRenderMaterials) {
      object.userData.originalRenderMaterials = currentMaterials;
      object.userData.originalRenderMaterialsWereArray = Array.isArray(object.material);
    }
    if (style === "standard") {
      disposeOverrideMaterials(object);
      const originals = object.userData.originalRenderMaterials;
      if (!originals) {
        return;
      }
      object.material = object.userData.originalRenderMaterialsWereArray ? [...originals] : originals[0]!;
      object.userData.renderMaterialStyle = "standard";
      return;
    }
    disposeOverrideMaterials(object);
    const originals = object.userData.originalRenderMaterials ?? currentMaterials;
    const overrides = originals.map((material) => overrideMaterial(style, materialBaseColor(material)));
    object.material = object.userData.originalRenderMaterialsWereArray ? overrides : overrides[0]!;
    object.userData.renderMaterialStyle = style;
  });
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
