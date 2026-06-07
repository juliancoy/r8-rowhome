import { Box3, Vector3 } from "three";
import type { ModelComponent } from "../core/types";

export interface PlayerNavigationOptions {
  radiusFt: number;
  eyeHeightFt: number;
  headClearanceFt: number;
}

export const nathanNavigationOptions: PlayerNavigationOptions = {
  radiusFt: 0.72,
  eyeHeightFt: 5.2,
  headClearanceFt: 0.3
};

export interface NavigationBounds {
  id: string;
  bounds: Box3;
}

function isNavigationBlockingComponent(component: ModelComponent): boolean {
  return /^(party-wall-|rear-wall|front-facade|front-wall-|basement-(party-wall|front-foundation|rear-foundation)|first-floor-partition|second-floor-(front|rear)-partition|third-floor-partition)/.test(component.metadata.id);
}

export function navigationBoundsForComponents(components: ModelComponent[]): NavigationBounds[] {
  return components
    .filter(isNavigationBlockingComponent)
    .map((component) => {
      component.object.updateMatrixWorld(true);
      return {
        id: component.metadata.id,
        bounds: new Box3().setFromObject(component.object)
      };
    });
}

export function playerBoundsAt(position: Vector3, options: PlayerNavigationOptions = nathanNavigationOptions): Box3 {
  return new Box3(
    new Vector3(position.x - options.radiusFt, position.y - options.eyeHeightFt, position.z - options.radiusFt),
    new Vector3(position.x + options.radiusFt, position.y + options.headClearanceFt, position.z + options.radiusFt)
  );
}

export function collidesWithNavigation(position: Vector3, blockers: NavigationBounds[], options: PlayerNavigationOptions = nathanNavigationOptions): boolean {
  const playerBounds = playerBoundsAt(position, options);
  return blockers.some((blocker) => playerBounds.intersectsBox(blocker.bounds));
}

function overlapDistance(aMin: number, aMax: number, bMin: number, bMax: number): number {
  return Math.min(aMax, bMax) - Math.max(aMin, bMin);
}

function depenetratePosition(position: Vector3, blockers: NavigationBounds[], options: PlayerNavigationOptions): Vector3 {
  const resolved = position.clone();

  for (let iteration = 0; iteration < 8; iteration += 1) {
    let moved = false;
    const playerBounds = playerBoundsAt(resolved, options);

    for (const blocker of blockers) {
      if (!playerBounds.intersectsBox(blocker.bounds)) {
        continue;
      }

      const xOverlap = overlapDistance(playerBounds.min.x, playerBounds.max.x, blocker.bounds.min.x, blocker.bounds.max.x);
      const yOverlap = overlapDistance(playerBounds.min.y, playerBounds.max.y, blocker.bounds.min.y, blocker.bounds.max.y);
      const zOverlap = overlapDistance(playerBounds.min.z, playerBounds.max.z, blocker.bounds.min.z, blocker.bounds.max.z);
      if (xOverlap <= 0 || yOverlap <= 0 || zOverlap <= 0) {
        continue;
      }

      const xDirection = resolved.x < blocker.bounds.getCenter(new Vector3()).x ? -1 : 1;
      const zDirection = resolved.z < blocker.bounds.getCenter(new Vector3()).z ? -1 : 1;
      if (xOverlap <= zOverlap && xOverlap <= yOverlap) {
        resolved.x += (xOverlap + 0.02) * xDirection;
      } else if (zOverlap <= yOverlap) {
        resolved.z += (zOverlap + 0.02) * zDirection;
      } else {
        resolved.y += yOverlap + 0.02;
      }
      moved = true;
      break;
    }

    if (!moved) {
      break;
    }
  }

  return resolved;
}

function resolveNavigationStep(
  currentPosition: Vector3,
  desiredPosition: Vector3,
  blockers: NavigationBounds[],
  options: PlayerNavigationOptions
): Vector3 {
  const current = collidesWithNavigation(currentPosition, blockers, options)
    ? depenetratePosition(currentPosition, blockers, options)
    : currentPosition.clone();

  if (!collidesWithNavigation(desiredPosition, blockers, options)) {
    return desiredPosition.clone();
  }

  const candidates = [
    new Vector3(desiredPosition.x, current.y, current.z),
    new Vector3(current.x, desiredPosition.y, current.z),
    new Vector3(current.x, current.y, desiredPosition.z),
    new Vector3(desiredPosition.x, current.y, desiredPosition.z),
    current
  ];

  return candidates.find((candidate) => !collidesWithNavigation(candidate, blockers, options))?.clone() ?? current;
}

export function resolveNavigationMove(
  currentPosition: Vector3,
  desiredPosition: Vector3,
  blockers: NavigationBounds[],
  options: PlayerNavigationOptions = nathanNavigationOptions
): Vector3 {
  const delta = desiredPosition.clone().sub(currentPosition);
  const stepLength = Math.max(options.radiusFt * 0.5, 0.1);
  const steps = Math.max(1, Math.ceil(delta.length() / stepLength));
  let resolved = currentPosition.clone();

  for (let step = 1; step <= steps; step += 1) {
    const target = currentPosition.clone().add(delta.clone().multiplyScalar(step / steps));
    const next = resolveNavigationStep(resolved, target, blockers, options);
    if (next.distanceToSquared(resolved) < 0.000001 && target.distanceToSquared(resolved) > 0.000001) {
      break;
    }
    resolved = next;
  }

  return resolved;
}
