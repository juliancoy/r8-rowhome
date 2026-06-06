# Real-World Model Assets

Local assets:

- `ikea-lagan-30587626-refrigerator.glb`
  - Product: IKEA LAGAN top-freezer refrigerator, Article 305.876.26.
  - Product page: https://www.ikea.com/us/en/p/lagan-top-freezer-refrigerator-white-30587626/
  - Use: owner planning/reference in this local project.
  - Note: verify IKEA asset terms before redistribution or commercial reuse.

- `ikea-fejka-80568890-fiddle-leaf-fig.glb`
  - Product: IKEA FEJKA artificial potted plant, Article 805.688.90.
  - Use: realistic purchasable interior plant replacement.
  - Note: verify IKEA asset terms before redistribution or commercial reuse.

- `cc0/tree_01_art.glb`
  - Product/source: Polygonal Mind MomusPark `Tree_01_Art`.
  - Source: https://github.com/ToxSam/cc0-models-Polygonal-Mind/tree/main/projects/MomusPark
  - License: CC0.
  - Use: realistic visual replacement for the procedural street tree.

- `cc0/kenney/furniture-kit/*.glb`
  - Product/source: Kenney Furniture Kit.
  - Source: https://kenney.nl/assets/furniture-kit
  - License: Creative Commons CC0 1.0 Universal.
  - Downloaded assets include bathroom fixtures, kitchen fixtures/appliances, living room furniture, beds, office furniture, lamps, laundry appliances, and stair reference models.
  - Use: low-poly runtime replacements for schematic placeholders in this local concept model.

- `sketchfab/nathan-animated-walking-man/scene.gltf`
  - Product/source: Nathan Animated 003 - Walking 3D Man by Renderpeople.
  - Source: https://sketchfab.com/3d-models/nathan-animated-003-walking-3d-man-143a2b1ea5eb4385ae90a73657aca3bc
  - License: Creative Commons Attribution 4.0.
  - Repeatable download: `npm run assets:sketchfab`.
  - Downloaded through the Sketchfab API using the local `SKETCHFAB_TOKEN`; the token is not stored in this directory.
  - The bundled base-color texture was downsampled from the downloaded 8192px JPEG to 2048px for browser performance.
  - Use: animated person asset for the browser occupant walkthrough, with the procedural avatar as a runtime fallback.

Purchasable candidates not downloaded:

- Rheem ProTerra Hybrid Heat Pump Electric Water Heater model
  - Source: https://3dmodels.org/ru/3d-models/rheem-proterra-hybrid-heat-pump-electric-water-heater/
  - Reason: paid model. Buy/download through the vendor, then place the licensed GLB in this directory and wire it to `electric-water-heater`.

- Manufacturer/BIMobject appliance and equipment models
  - Refrigerator search: https://www.bimobject.com/en-us/search?query=refrigerator
  - Water-heater search: https://www.bimobject.com/en-us/search?query=water%20heater
  - Reason: source-specific account/license terms apply.

Optional API-key candidates:

- Sketchfab Download API
  - Useful for automated download of specifically licensed CC0/CC-BY glTF assets.
  - Requires a Sketchfab account and API token.
  - Only use assets whose license permits project redistribution.

- BIMobject/manufacturer portals
  - Useful for product-specific BIM/Revit/SKetchup content.
  - Usually requires account login and per-manufacturer license review rather than a single universal API key.
