import { Group, PointLight } from "three";
import type { RowhomeModel } from "../core/types";

const overheadLightPattern = /^overhead-light-/;
const windowDaylightPattern = /^front-window-(?:left|right)-\d+$/;

export function buildHouseLighting(model: RowhomeModel): Group {
  const lights = new Group();
  lights.name = "House lighting";

  for (const component of model.components) {
    if (overheadLightPattern.test(component.metadata.id)) {
      const light = new PointLight("#ffdca0", 2.1, 18, 2);
      light.name = `${component.metadata.id}-point-light`;
      light.position.copy(component.object.position).add({ x: 0, y: -0.45, z: 0 });
      light.castShadow = true;
      lights.add(light);
    }

    if (component.metadata.id === "floor-lamp-bulb") {
      const light = new PointLight("#ffc878", 2.8, 15, 2);
      light.name = "floor-lamp-point-light";
      light.position.copy(component.object.position);
      light.castShadow = true;
      lights.add(light);
    }

    if (windowDaylightPattern.test(component.metadata.id) || component.metadata.id === "transom-window") {
      const light = new PointLight("#b9ddff", 0.55, 12, 2);
      light.name = `${component.metadata.id}-daylight`;
      light.position.copy(component.object.position).add({ x: 0, y: 0, z: 1.1 });
      lights.add(light);
    }
  }

  return lights;
}
