import type { ComponentMetadata, RealProductModel } from "../core/types";

const kenneyFurnitureBaseUrl = "/models/cc0/kenney/furniture-kit";

export function kenneyFurnitureModel(slug: string, productName: string): RealProductModel {
  return {
    url: `${kenneyFurnitureBaseUrl}/${slug}.glb`,
    productUrl: "https://kenney.nl/assets/furniture-kit",
    brand: "Kenney",
    productName,
    source: "Kenney Furniture Kit GLB asset",
    license: "Creative Commons CC0 1.0 Universal",
    usageNote: "CC0 asset used as a realistic low-poly runtime replacement for the schematic placeholder.",
    replacePlaceholder: true
  };
}

export function attachRealAsset(
  metadata: ComponentMetadata,
  modelSlug: string,
  productName: string
): ComponentMetadata {
  metadata.realProductModel = kenneyFurnitureModel(modelSlug, productName);
  metadata.notes = [
    ...(metadata.notes ?? []),
    `Runtime replacement asset: Kenney Furniture Kit ${productName} (${modelSlug}.glb), CC0.`
  ];
  return metadata;
}
