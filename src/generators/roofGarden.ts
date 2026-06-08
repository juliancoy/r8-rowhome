import type { ModelComponent, RowhomeConfig } from "../core/types";
import { sources } from "../core/sources";
import { box, metadata } from "./builder";

export function addRoofGarden(
  components: ModelComponent[],
  config: RowhomeConfig,
  buildingHeight: number
): void {
  const notes = [
    "Conceptual raised roof garden placed clear of the stairwell roof opening and photovoltaic array.",
    "Planters are kept separate from solar panels, parapets, roof drain, plumbing vent, and stairwell/service zones.",
    "Final roof garden design requires structural live/dead-load checks, waterproofing, root barrier, drainage, guard/safety, wind uplift, irrigation, and maintenance design."
  ];
  const planterSpecs = [
    { id: "front", x: 7.35, y: 29.0, crop: "herb and pollinator planting" },
    { id: "middle", x: 7.35, y: 36.0, crop: "leafy vegetable planting" },
    { id: "rear", x: 7.35, y: 43.0, crop: "native sedum and pollinator planting" }
  ] as const;

  box(
    components,
    metadata(
      "roof-garden-drainage-mat",
      "Roof garden drainage and root-barrier mat",
      "roof",
      "protected roof garden drainage mat and root barrier",
      sources.residentialCode,
      2400,
      true,
      notes
    ),
    "#273d32",
    3.4,
    20.5,
    0.12,
    { x: 7.35, y: 36.0, z: buildingHeight + 0.62 }
  );

  box(
    components,
    metadata(
      "roof-garden-paver-walkway",
      "Roof garden paver walkway",
      "roof",
      "removable concrete roof pavers on protection mat",
      sources.residentialCode,
      1800,
      true,
      [
        ...notes,
        "Walkway provides maintenance access between the raised planters and the photovoltaic array without crossing over solar modules."
      ]
    ),
    "#9a9a8b",
    1.05,
    20.5,
    0.18,
    { x: 5.75, y: 36.0, z: buildingHeight + 0.72 }
  );

  for (const [index, planter] of planterSpecs.entries()) {
    const planterNumber = index + 1;
    box(
      components,
      metadata(
        `roof-garden-planter-${planter.id}`,
        `Roof garden raised planter ${planterNumber}`,
        "roof",
        "lightweight raised roof-garden planter box",
        sources.residentialCode,
        1500,
        true,
        [...notes, `planting:${planter.crop}`]
      ),
      "#6f4a2f",
      2.45,
      4.6,
      1.05,
      { x: planter.x, y: planter.y, z: buildingHeight + 1.18 }
    );
    box(
      components,
      metadata(
        `roof-garden-soil-${planter.id}`,
        `Roof garden growing medium ${planterNumber}`,
        "roof",
        "lightweight engineered roof-garden growing medium",
        sources.residentialCode,
        950,
        true,
        [...notes, "Growing medium depth and saturated weight must be checked by structural design."]
      ),
      "#3f2d20",
      2.15,
      4.25,
      0.42,
      { x: planter.x, y: planter.y, z: buildingHeight + 1.68 }
    );
    box(
      components,
      metadata(
        `roof-garden-planting-${planter.id}`,
        `Roof garden planting ${planterNumber}`,
        "roof",
        planter.crop,
        sources.residentialCode,
        360,
        true,
        [...notes, "Planting palette must be selected for wind exposure, roof microclimate, irrigation, and maintenance access."]
      ),
      index === 1 ? "#4f8f4f" : "#5f9b65",
      2.0,
      3.9,
      0.65,
      { x: planter.x, y: planter.y, z: buildingHeight + 2.2 }
    );
  }

  box(
    components,
    metadata(
      "roof-garden-drip-irrigation",
      "Roof garden drip irrigation line",
      "systems",
      "low-flow drip irrigation tubing for raised roof planters",
      sources.plumbingCode,
      420,
      true,
      [
        ...notes,
        "Irrigation requires backflow protection, freeze protection, shutoff, drainage, and maintenance access."
      ]
    ),
    "#2f6f7a",
    0.08,
    18.0,
    0.08,
    { x: 6.15, y: 36.0, z: buildingHeight + 2.1 }
  );

  box(
    components,
    metadata(
      "roof-garden-load-review-zone",
      "Roof garden structural load review zone",
      "roof",
      "non-printable roof garden structural and waterproofing review marker",
      sources.residentialCode,
      0,
      false,
      notes
    ),
    "#72c47a",
    4.35,
    20.5,
    0.05,
    { x: 7.35, y: 36.0, z: buildingHeight + 0.55 }
  );
}
