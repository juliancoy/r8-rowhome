import type { ModelComponent, RowhomeConfig } from "../core/types";
import { sources } from "../core/sources";
import { box, metadata } from "./builder";

export function addRoofSolarArray(
  components: ModelComponent[],
  config: RowhomeConfig,
  buildingHeight: number
): void {
  const panelWidth = 3.05;
  const panelDepth = 5.45;
  const panelThickness = 0.16;
  const columnSpacing = 3.45;
  const rowSpacing = 6.05;
  const startX = 6.75;
  const startY = 9.0;
  const panelZ = buildingHeight + 0.52;
  const rackZ = buildingHeight + 0.38;
  const notes = [
    "Conceptual flat-roof photovoltaic array; final capacity, setbacks, fire access paths, ballast, wind uplift, and roof attachment require licensed design.",
    "Array is placed on the right-side roof plate to keep clear of the stairwell opening, parapet zone, plumbing vent, and roof drain."
  ];

  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      const index = row * 3 + column + 1;
      const x = startX + column * columnSpacing;
      const y = startY + row * rowSpacing;
      box(
        components,
        metadata(
          `roof-solar-frame-${index}`,
          `Roof solar module frame ${index}`,
          "roof",
          "anodized aluminum photovoltaic module frame",
          sources.electricalCode,
          90,
          true,
          notes
        ),
        "#d1dbe5",
        panelWidth + 0.18,
        panelDepth + 0.18,
        0.08,
        { x, y, z: panelZ - 0.04 }
      );
      box(
        components,
        metadata(
          `roof-solar-panel-${index}`,
          `Roof solar module ${index}`,
          "roof",
          "glass photovoltaic solar module on low-profile flat-roof rack",
          sources.electricalCode,
          925,
          true,
          notes
        ),
        "#4c95cf",
        panelWidth,
        panelDepth,
        panelThickness,
        { x, y, z: panelZ }
      );
      box(
        components,
        metadata(
          `roof-solar-rack-${index}`,
          `Ballasted solar rack ${index}`,
          "roof",
          "aluminum ballasted photovoltaic racking",
          sources.electricalCode,
          220,
          true,
          notes
        ),
        "#68727a",
        panelWidth + 0.25,
        0.26,
        0.2,
        { x, y: y - panelDepth / 2 + 0.42, z: rackZ }
      );
      box(
        components,
        metadata(
          `roof-solar-rear-rack-${index}`,
          `Rear ballasted solar rack ${index}`,
          "roof",
          "aluminum ballasted photovoltaic racking",
          sources.electricalCode,
          220,
          true,
          notes
        ),
        "#68727a",
        panelWidth + 0.25,
        0.26,
        0.2,
        { x, y: y + panelDepth / 2 - 0.42, z: rackZ }
      );
    }
  }

  box(
    components,
    metadata(
      "roof-solar-combiner",
      "Roof PV combiner box",
      "electrical",
      "weatherproof photovoltaic combiner and rapid-shutdown equipment",
      sources.electricalCode,
      1450,
      true,
      [
        "Located near the array edge with conceptual rooftop DC raceway routing.",
        "Connected to roof-solar-dc-raceway and roof-solar-panel-1 through roof-solar-panel-9.",
        "Rapid shutdown, labeling, working clearances, and interconnection details require electrical design."
      ]
    ),
    "#39434b",
    1.2,
    0.6,
    0.9,
    { x: startX + 2 * columnSpacing + 2.0, y: startY + rowSpacing, z: buildingHeight + 0.85 }
  );

  box(
    components,
    metadata(
      "roof-solar-dc-raceway",
      "Roof PV DC raceway",
      "electrical",
      "weatherproof rooftop photovoltaic DC conduit",
      sources.electricalCode,
      680,
      true,
      [
        "Conceptual rooftop raceway from PV array to combiner; routing must be coordinated with roof drainage and service access.",
        "Connected to roof-solar-combiner and the roof-solar-panel array."
      ]
    ),
    "#555d63",
    0.18,
    rowSpacing * 2 + 1.2,
    0.18,
    { x: startX + 2 * columnSpacing + 1.0, y: startY + rowSpacing, z: buildingHeight + 0.7 }
  );
}
