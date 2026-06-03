import {
  BoxGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  type Material
} from "three";
import type { StructuralDemandSurface, StructuralModel } from "../core/types";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function structuralDemandColor(intensity: number): Color {
  const value = clamp01(intensity);
  const stops = [
    { at: 0, color: new Color("#1f78d1") },
    { at: 0.5, color: new Color("#f2d45a") },
    { at: 1, color: new Color("#d7191c") }
  ];
  const lower = value <= 0.5 ? stops[0] : stops[1];
  const upper = value <= 0.5 ? stops[1] : stops[2];
  const span = upper.at - lower.at;
  return lower.color.clone().lerp(upper.color, span > 0 ? (value - lower.at) / span : 0);
}

function materialForSurface(surface: StructuralDemandSurface): Material {
  return new MeshBasicMaterial({
    color: structuralDemandColor(surface.intensity),
    transparent: true,
    opacity: surface.kind === "wall-line" ? 0.34 : 0.9,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide
  });
}

export function buildStructuralDemandOverlay(structural: StructuralModel | undefined): Group {
  const group = new Group();
  group.name = "Conceptual structural gravity demand overlay";
  group.visible = false;

  if (!structural) {
    return group;
  }

  for (const surface of [...structural.demandSurfaces].sort((a, b) => a.intensity - b.intensity)) {
    const bounds = surface.bounds;
    const width = Math.max(0.06, bounds.xMaxFt - bounds.xMinFt);
    const depth = Math.max(0.06, bounds.yMaxFt - bounds.yMinFt);
    const height = Math.max(0.06, bounds.zMaxFt - bounds.zMinFt);
    const geometry = new BoxGeometry(width, height, depth);
    const mesh = new Mesh(geometry, materialForSurface(surface));
    mesh.position.set(
      (bounds.xMinFt + bounds.xMaxFt) / 2,
      (bounds.zMinFt + bounds.zMaxFt) / 2,
      (bounds.yMinFt + bounds.yMaxFt) / 2
    );
    mesh.name = surface.label;
    mesh.userData = {
      id: surface.id,
      name: surface.label,
      structuralDemand: surface
    };
    mesh.renderOrder = 5;
    group.add(mesh);
  }

  return group;
}
