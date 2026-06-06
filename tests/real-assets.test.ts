import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultRowhomeConfig } from "../src/core/config";
import { generateRowhome } from "../src/generators/rowhome";
import { sketchfabOccupantAttribution, sketchfabOccupantModelUrl } from "../src/viewer/occupantWalkthrough";

const kenneyAssetSlugs = [
  "bathroomSink",
  "bathroomMirror",
  "bathroomCabinet",
  "shower",
  "toilet",
  "kitchenSink",
  "kitchenStoveElectric",
  "kitchenCabinet",
  "kitchenCabinetDrawer",
  "loungeSofa",
  "tableCoffee",
  "televisionModern",
  "bedDouble",
  "bedSingle",
  "desk",
  "chairDesk",
  "computerScreen",
  "computerKeyboard",
  "lampRoundFloor"
] as const;

describe("downloaded real asset inventory", () => {
  it("keeps downloaded Kenney CC0 GLB assets and license available locally", () => {
    const assetRoot = join(process.cwd(), "public/models/cc0/kenney/furniture-kit");

    expect(existsSync(join(assetRoot, "License.txt"))).toBe(true);
    for (const slug of kenneyAssetSlugs) {
      const assetPath = join(assetRoot, `${slug}.glb`);
      expect(existsSync(assetPath), slug).toBe(true);
      expect(statSync(assetPath).size, slug).toBeGreaterThan(1_000);
    }
  });

  it("wires downloaded assets to daily-use house components", () => {
    const model = generateRowhome(defaultRowhomeConfig);
    const byId = new Map(model.components.map((component) => [component.metadata.id, component]));
    const mappedComponents = [
      "bath-1-toilet",
      "bath-1-lavatory",
      "bath-1-shower",
      "bath-1-mirror",
      "bath-1-cabinet",
      "living-room-couch",
      "living-room-coffee-table",
      "living-room-tv",
      "primary-bed",
      "second-bedroom-bed",
      "office-desk",
      "office-chair",
      "office-computer-screen",
      "kitchen-base-cabinets",
      "kitchen-island",
      "electric-range",
      "kitchen-sink",
      "floor-lamp-base"
    ];

    for (const id of mappedComponents) {
      const product = byId.get(id)?.metadata.realProductModel;
      expect(product?.brand, id).toBe("Kenney");
      expect(product?.license, id).toContain("CC0");
      expect(product?.url, id).toMatch(/^\/models\/cc0\/kenney\/furniture-kit\/.+\.glb$/);
    }
  });

  it("keeps the downloaded Sketchfab walking person asset and attribution available locally", () => {
    const assetRoot = join(process.cwd(), "public/models/sketchfab/nathan-animated-walking-man");
    const scenePath = join(assetRoot, "scene.gltf");
    const metadataPath = join(assetRoot, "sketchfab-metadata.json");
    const readme = readFileSync(join(process.cwd(), "public/models/README.md"), "utf-8");
    const metadata = JSON.parse(readFileSync(metadataPath, "utf-8")) as {
      name: string;
      author: string;
      viewerUrl: string;
      license: { slug: string; url: string };
      optimizedTextures: Array<{
        path: string;
        originalDimensions: [number, number];
        optimizedDimensions: [number, number];
        originalBytes: number;
        optimizedBytes: number;
      }>;
    };

    expect(sketchfabOccupantModelUrl).toBe("/models/sketchfab/nathan-animated-walking-man/scene.gltf");
    expect(existsSync(scenePath)).toBe(true);
    expect(existsSync(join(assetRoot, "scene.bin"))).toBe(true);
    expect(existsSync(join(assetRoot, "license.txt"))).toBe(true);
    expect(statSync(scenePath).size).toBeGreaterThan(1_000);
    expect(statSync(join(assetRoot, "textures/rp_nathan_animated_003_mat_baseColor.jpeg")).size).toBeLessThan(2_000_000);
    expect(metadata.name).toBe(sketchfabOccupantAttribution.title);
    expect(metadata.author).toBe(sketchfabOccupantAttribution.author);
    expect(metadata.license.slug).toBe("by");
    expect(metadata.license.url).toContain("creativecommons.org/licenses/by/4.0");
    expect(metadata.optimizedTextures[0]).toMatchObject({
      path: "textures/rp_nathan_animated_003_mat_baseColor.jpeg",
      originalDimensions: [8192, 8192],
      optimizedDimensions: [2048, 2048]
    });
    expect(metadata.optimizedTextures[0].optimizedBytes).toBeLessThan(metadata.optimizedTextures[0].originalBytes);
    expect(readme).toContain(sketchfabOccupantAttribution.title);
    expect(readme).toContain(sketchfabOccupantAttribution.source);
  });
});
