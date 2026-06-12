import type { ConstructionSystem, RowhomeConfig } from "./types";
import { sources } from "./sources";

export interface ConstructionSystemElement {
  material: string;
  color: string;
  costUsd: number;
}

export interface ConstructionSystemOption {
  id: ConstructionSystem;
  label: string;
  notes: string;
  source: string;
  partyWall: ConstructionSystemElement;
  rearWall: ConstructionSystemElement;
  floor: ConstructionSystemElement;
  roof: ConstructionSystemElement;
  interiorPartitionFraming: string;
  /** Whether masonry brick wythe takeoff applies to party and rear walls. */
  usesBrickTakeoff: boolean;
  /** Whether the system always includes the interior steel post-and-beam frame. */
  includesSteelFrame: boolean;
  structural: {
    wallMaterialId: string;
    floorMaterialId: string;
    framingMaterialId: string;
    wallDensityPcf: number;
    floorDeadLoadPsf: number;
    roofDeadLoadPsf: number;
  };
  trades: string[];
}

export const constructionSystemOptions: ConstructionSystemOption[] = [
  {
    id: "masonry-wood",
    label: "Brick masonry + wood framing",
    notes:
      "Traditional Baltimore rowhouse construction: masonry party and rear walls with engineered wood floor and roof framing.",
    source: sources.residentialCode,
    partyWall: { material: "8 in brick or CMU masonry party wall", color: "#9f422f", costUsd: 8800 },
    rearWall: { material: "8 in brick or CMU masonry rear wall", color: "#7e382d", costUsd: 9600 },
    floor: { material: "engineered wood framing", color: "#b89563", costUsd: 9200 },
    roof: { material: "engineered wood framing", color: "#746b5a", costUsd: 7800 },
    interiorPartitionFraming: "2x4 wood stud partition framing",
    usesBrickTakeoff: true,
    includesSteelFrame: false,
    structural: {
      wallMaterialId: "masonry",
      floorMaterialId: "wood-framing",
      framingMaterialId: "wood-framing",
      wallDensityPcf: 120,
      floorDeadLoadPsf: 15,
      roofDeadLoadPsf: 18
    },
    trades: ["masonry", "rough-carpentry", "finish-carpentry"]
  },
  {
    id: "steel-concrete",
    label: "Steel frame + concrete",
    notes:
      "Alternative system: cast-in-place reinforced concrete party and rear walls, concrete slabs on steel metal deck, and an interior steel post-and-beam frame.",
    source: sources.residentialCode,
    partyWall: { material: "8 in cast-in-place reinforced concrete party wall", color: "#8d9499", costUsd: 12400 },
    rearWall: { material: "8 in cast-in-place reinforced concrete rear wall", color: "#84898d", costUsd: 13200 },
    floor: { material: "concrete slab on steel metal deck", color: "#9aa0a4", costUsd: 14800 },
    roof: { material: "concrete roof slab on steel metal deck", color: "#7d8488", costUsd: 12600 },
    interiorPartitionFraming: "20 ga cold-formed steel stud partition framing",
    usesBrickTakeoff: false,
    includesSteelFrame: true,
    structural: {
      wallMaterialId: "reinforced-concrete",
      floorMaterialId: "concrete-metal-deck",
      framingMaterialId: "structural-steel",
      wallDensityPcf: 145,
      floorDeadLoadPsf: 48,
      roofDeadLoadPsf: 42
    },
    trades: ["cast-in-place-concrete", "reinforcing-steel", "structural-steel-erection", "metal-deck-installation", "cold-formed-framing"]
  }
];

export function selectedConstructionSystem(config: RowhomeConfig): ConstructionSystemOption {
  return (
    constructionSystemOptions.find((option) => option.id === config.constructionSystem) ?? constructionSystemOptions[0]
  );
}
