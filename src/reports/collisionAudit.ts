import { Box3, Vector3 } from "three";
import { defaultRowhomeConfig } from "../core/config";
import type { ModelComponent, RowhomeModel } from "../core/types";
import { generateRowhome } from "../generators/rowhome";

interface Bounds {
  min: Vector3;
  max: Vector3;
}

export interface CollisionAuditPair {
  firstId: string;
  secondId: string;
  classification: "expected-contact" | "expected-layering" | "expected-system-connection" | "suspect-critical";
  reason: string;
}

export interface CollisionAuditReport {
  generatedAt: string;
  status: "pass" | "suspect-collisions-found";
  purpose: string;
  componentCount: number;
  pairCount: number;
  intersectingPairCount: number;
  suspectCriticalCount: number;
  suspectCritical: CollisionAuditPair[];
  sampleExpected: CollisionAuditPair[];
}

function boundsFor(component: ModelComponent): Bounds {
  component.object.updateMatrixWorld(true);
  const box = new Box3().setFromObject(component.object);
  return { min: box.min.clone(), max: box.max.clone() };
}

function intersects(a: Bounds, b: Bounds, tolerance = 0.03): boolean {
  return (
    a.min.x < b.max.x - tolerance &&
    a.max.x > b.min.x + tolerance &&
    a.min.y < b.max.y - tolerance &&
    a.max.y > b.min.y + tolerance &&
    a.min.z < b.max.z - tolerance &&
    a.max.z > b.min.z + tolerance
  );
}

function classify(first: ModelComponent, second: ModelComponent): CollisionAuditPair["classification"] {
  const text = `${first.metadata.id} ${second.metadata.id} ${first.metadata.category} ${second.metadata.category} ${first.metadata.material} ${second.metadata.material}`.toLowerCase();
  if (/roof-solar-(panel|frame|rack|rear-rack)-/.test(text) && /roof-(insulation|drainage|garden)/.test(text)) return "suspect-critical";
  if (/rear-exit-door-\d+\b/.test(text) && /rear-wall/.test(text)) return "suspect-critical";
  if (/central-ac-condenser/.test(text) && /fire-escape/.test(text)) return "suspect-critical";
  if (/stair-(tread|riser|landing)/.test(text) && /floor-plate/.test(text)) return "suspect-critical";
  if (/wall|sheathing|weather|insulation|gypsum|facade|roof|membrane|flashing|curb|cricket|drainage/.test(text)) return "expected-layering";
  if (/duct|pipe|conduit|circuit|raceway|register|grille|plenum|riser|branch|solar|battery|panel|heating|cooling/.test(text)) return "expected-system-connection";
  return "expected-contact";
}

function reasonFor(classification: CollisionAuditPair["classification"]): string {
  if (classification === "suspect-critical") return "Critical object families should not occupy the same physical space.";
  if (classification === "expected-layering") return "Layered assemblies intentionally overlap or touch as finish/envelope/roof buildup.";
  if (classification === "expected-system-connection") return "MEP/system components intentionally intersect or touch at routed connections.";
  return "Model components are allowed to touch or overlap at bearing/contact conditions in this conceptual geometry audit.";
}

export function buildCollisionAuditReport(
  generatedAt = new Date().toISOString(),
  model: RowhomeModel = generateRowhome(defaultRowhomeConfig)
): CollisionAuditReport {
  const components = model.components.filter((component) => component.metadata.printable);
  const bounds = new Map(components.map((component) => [component.metadata.id, boundsFor(component)]));
  const intersecting: CollisionAuditPair[] = [];
  let pairCount = 0;

  for (let i = 0; i < components.length; i += 1) {
    for (let j = i + 1; j < components.length; j += 1) {
      pairCount += 1;
      const first = components[i];
      const second = components[j];
      if (!intersects(bounds.get(first.metadata.id)!, bounds.get(second.metadata.id)!)) {
        continue;
      }
      const classification = classify(first, second);
      intersecting.push({
        firstId: first.metadata.id,
        secondId: second.metadata.id,
        classification,
        reason: reasonFor(classification)
      });
    }
  }
  const suspectCritical = intersecting.filter((pair) => pair.classification === "suspect-critical");

  return {
    generatedAt,
    status: suspectCritical.length === 0 ? "pass" : "suspect-collisions-found",
    purpose: "All-printable-component AABB collision audit. It scans every printable component pair, classifies expected contacts/layering/system connections, and fails on suspect critical intersections.",
    componentCount: components.length,
    pairCount,
    intersectingPairCount: intersecting.length,
    suspectCriticalCount: suspectCritical.length,
    suspectCritical,
    sampleExpected: intersecting.filter((pair) => pair.classification !== "suspect-critical").slice(0, 50)
  };
}
