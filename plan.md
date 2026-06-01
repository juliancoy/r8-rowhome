# Implementation Plan

## Mission

Design and build a procedural Baltimore R-8 rowhome model system. The system will use a browser-first TypeScript stack to generate geometry, render the model in WebGPU, export individual components to STL for 3D printing, and present source-traced model metadata in a web interface. The model must be informed by authoritative Baltimore City and Maryland practice documents in `sources/`, with explicit traceability from model assumptions to source documents.

This project produces a design and visualization model, not sealed construction documents. Any real-world construction use requires review by licensed Maryland professionals and approval by Baltimore City authorities.

## Technology Direction

Use TypeScript instead of C++ for the implementation.

Recommended stack:

- TypeScript and Vite for the application, build, and development server.
- Three.js for scene management, cameras, controls, geometry helpers, picking, materials, and STL export.
- Three.js WebGPU renderer as the preferred renderer, with WebGL fallback if needed for browser compatibility.
- Three.js `BufferGeometry` as the procedural geometry representation.
- Three.js `STLExporter` for component-level STL export.
- JSON as the first model interchange format so geometry, BOM data, cost estimates, validation messages, and source references stay inspectable.
- glTF/GLB as a future export target if broader 3D asset interchange becomes important.
- Vitest for geometry, validation, exporter, and source-traceability tests.
- React and Zustand only if the UI state grows enough to justify them; start with plain TypeScript modules and a small view layer.

C++ and Vulkan are not the primary stack for this project. They would only be reconsidered if the project later needs a heavy native geometry kernel, large-scale mesh processing, native simulation, or a separate desktop pipeline.

## Source Baseline

Use `sources/` as the local authority set for code-informed implementation:

- Baltimore R-8 and residential zoning: `code-article-32-section-9-204-r8-rowhouse-residential.html`, `code-article-32-title-9-residential-districts-full.html`
- Development review and site requirements: `code-article-32-title-4-development-reviews-full.html`
- Building code and residential code amendments: `code-building-fire-related-codes-index.html`, `code-building-codes-part-x-international-residential-code-full.html`, plus related building, electrical, plumbing, mechanical, and energy code parts
- Electrical practice baseline: `code-building-codes-part-iii-national-electrical-code-full.html`
- Stormwater, grading, erosion, and sediment control: `code-article-7-natural-resources-full.html`, `mde-maryland-stormwater-design-manual-volume-1-2009.pdf`, `mde-maryland-stormwater-design-manual-volume-2-2009.pdf`, `mde-2011-md-standards-specifications-soil-erosion-sediment-control.pdf`
- Historic district and facade constraints where applicable: `code-article-6-historical-architectural-preservation-full.html`, `map-historic-districts.pdf`
- Right-of-way and streetscape context: `dot-complete-streets-manual-2021-03.pdf`
- Critical Area constraints where applicable: `planning-critical-area-management-program-manual-2024.pdf`
- Permit and review workflows: DHCD ePermits/ePlans PDFs in `sources/`

## Phase 1: Project Skeleton

Create the core repository structure:

- `src/core/`: units, dimensions, transforms, validation types
- `src/geometry/`: Three.js geometry builders, component wrappers, mesh utilities
- `src/generators/`: lot, building shell, facade, floors, stairs, roof, electrical, landscape, fixtures
- `src/viewer/`: Three.js WebGPU/WebGL viewer, camera controls, picking, layer toggles
- `src/export/`: STL, JSON, BOM, and cost export
- `src/ui/`: inspector panels, bill of materials UI, cost UI, validation UI
- `data/`: source-derived constraints, material catalog, cost catalog, model presets
- `tests/`: unit, geometry, export, and integration tests

Deliverables:

- Vite TypeScript app
- Minimal procedural generator that creates one placeholder rowhome model
- Minimal Three.js WebGPU viewer that loads and displays generated geometry
- Initial STL export path for one component

Acceptance criteria:

- `npm install`, `npm run build`, and `npm test` succeed from a clean checkout
- A placeholder model renders locally
- One STL export opens in a standard slicer or mesh viewer

## Phase 2: Source-Derived Constraint Model

Convert the applicable code and practice constraints into structured project data. Keep the extracted rules conservative and cite file names and sections where practical.

Implement:

- Lot parameters: width, depth, setbacks/yards, height, occupancy/use assumptions
- R-8 residential assumptions and rowhouse-specific model defaults
- Building envelope constraints
- Stair, egress, fire separation, opening, guard/handrail, and roof access assumptions
- Electrical model assumptions for all-electric homes, including 120 V branch circuits and accessible 240 V kitchen appliance service
- Site model assumptions for grading, drainage, tree/planting, sidewalk, and rear yard

Deliverables:

- `data/constraints/*.json`
- `docs/source-traceability.md`
- Validation library that reports violations and warnings

Acceptance criteria:

- Every modeled regulatory assumption has a source reference or is marked as a design assumption
- Invalid dimensions produce actionable validation errors
- The model can be generated with a `--strict` validation mode

## Phase 3: Procedural Geometry Core

Build reusable TypeScript geometry primitives and Three.js mesh operations.

Implement:

- Unit-safe dimension types
- Component builder around Three.js `BufferGeometry`, normals, UVs, material IDs, object IDs, and source references
- Parametric solids: boxes, slabs, prisms, cylinders, extrusions, pitched/flat roof forms
- Composition strategy suitable for deterministic export
- Component registry for individually exportable parts
- Metadata attachment for BOM, cost, source references, and print settings

Deliverables:

- Core mesh API
- Component graph API
- STL export per component and per full model using Three.js exporter
- JSON model export for viewer reloads and automated tests

Acceptance criteria:

- Generated meshes are manifold where required for printing
- Component IDs remain stable across generations with the same input
- STL export preserves scale in real-world units

## Phase 4: Rowhome Architectural Model

Generate the primary rowhome structure.

Implement:

- Lot and site plane
- Foundation/basement or slab option
- Party walls, front/rear walls, floor plates, joists or structural placeholders
- Roof structure, parapet/cornice options, roof drainage placeholders
- Facade generator with stoop, door, windows, masonry bands, lintels, sills, cornice, and rowhouse rhythm
- Interior floors with kitchen, circulation, bedrooms/rooms as configurable zones
- Stairwell with code-informed dimensions and rail/guard representation
- Rear egress/fire escape or alternative egress model as a configurable, source-traced design option

Deliverables:

- `RowhomeGenerator`
- `FacadeGenerator`
- `StairGenerator`
- `RoofGenerator`
- Model preset for a default Baltimore R-8 rowhome

Acceptance criteria:

- The default model fits inside the configured R-8 lot/envelope assumptions
- All major architectural components are separately selectable and exportable
- Validation reports dimensions, assumptions, and source references

## Phase 5: Building Systems

Model simplified but inspectable building systems.

Implement:

- All-electric service assumptions
- Main panel placeholder and branch-circuit routing
- 120 V receptacle and lighting device placement model
- Accessible 240 V kitchen appliance circuit and outlet model
- Electric oven/range geometry
- HVAC/electric heat pump placeholders, with outdoor equipment placement as a configurable option
- Plumbing placeholders for kitchen and bathrooms if included
- No gas piping or gas appliance components

Deliverables:

- `ElectricalGenerator`
- `KitchenGenerator`
- `SystemsBOM`

Acceptance criteria:

- The generated model has no gas components
- Electrical components are visible, labeled in metadata, and included in the BOM
- 120 V and 240 V systems are distinguishable in the viewer

## Phase 6: Site, Landscape, and Context

Generate the land around the building.

Implement:

- Front sidewalk/stoop interface
- Rear yard or service area
- Grading and drainage direction indicators
- Optional street tree and planting zone
- Stormwater/erosion-control annotations as model metadata, not detailed civil engineering design
- Optional neighboring rowhome massing for context

Deliverables:

- `SiteGenerator`
- `LandscapeGenerator`
- Site BOM entries and material quantities

Acceptance criteria:

- Site geometry does not collide with the building shell
- Tree and planting elements can be toggled in the viewer
- Drainage and grading assumptions are listed in model metadata

## Phase 7: WebGPU Rendering Pipeline

Connect generated geometry to renderable buffers and the browser viewer.

Implement:

- Three.js WebGPU renderer setup, with WebGL fallback if needed
- Shared JSON model format for web consumption
- Fly camera, orbit/pan/zoom, object picking, layer toggles, and section/cutaway controls
- Inspector panel for dimensions, materials, source references, BOM, and estimated costs
- Visual distinction for structure, facade, systems, landscape, and code-warning overlays

Deliverables:

- Web viewer loading the default generated model
- BOM/cost/material panels
- Render smoke tests and screenshot checks

Acceptance criteria:

- User can fly around and inspect the rowhome in the browser
- Viewer can toggle STL-exportable components
- BOM and material-cost data match generator metadata

## Phase 8: BOM, Materials, and Cost Model

Add quantity takeoff and cost estimation.

Implement:

- Material catalog with units, density/quantity rules, and editable unit cost
- Quantity extraction from generated geometry and component metadata
- BOM grouped by structure, facade, electrical, interior, site, and landscape
- Cost rollups with assumptions and exclusions
- Export to CSV/JSON

Deliverables:

- `data/materials/catalog.json`
- `data/costs/default-costs.json`
- BOM and cost export commands
- Web BOM and cost panels

Acceptance criteria:

- Every visible component has a material assignment or explicit exclusion
- Costs are labeled as estimates
- BOM export is deterministic for identical inputs

## Phase 9: Verification

Build confidence through automated and visual checks.

Implement tests for:

- Unit conversion and dimension constraints
- Mesh manifoldness and normal consistency
- STL export scale and component splitting
- Generator validation for lot/envelope/stair/electrical assumptions
- Web model loading and object picking
- Screenshot checks for nonblank rendering and readable UI

Acceptance criteria:

- Test suite runs locally with one command
- Default model passes validation without errors
- Any warnings are documented as design assumptions

## Phase 10: Documentation and Workflow

Document how to use, verify, and extend the system.

Create:

- `README.md` with build, run, generate, export, and view commands
- `docs/model-assumptions.md`
- `docs/source-traceability.md`
- `docs/validation.md`
- `docs/web-viewer.md`
- Example presets for narrow, typical, and larger R-8 rowhome lots

Acceptance criteria:

- A new developer can generate the default model and open it in the web viewer from documented commands
- A reviewer can trace major dimensions and modeled systems to source documents or declared assumptions

## Initial Milestone Order

1. Build the Vite/TypeScript skeleton, geometry core, and STL export.
2. Encode source-derived constraints and validation.
3. Generate the default architectural shell, facade, stairs, and roof.
4. Add electrical/kitchen systems and no-gas validation.
5. Add site/landscape context.
6. Wire Three.js WebGPU viewer, BOM, costs, and source inspector.
7. Harden with tests, examples, and documentation.

## Key Risks

- Code interpretation risk: mitigated by source traceability and conservative assumptions.
- Real-world construction risk: mitigated by labeling output as a model and requiring licensed professional review for construction.
- Geometry complexity risk: mitigated by component generators and deterministic Three.js geometry APIs.
- Rendering/export divergence: mitigated by using one shared component representation for Three.js rendering, STL, JSON, BOM, and validation.
- Cost accuracy risk: mitigated by editable unit-cost data and explicit estimate labeling.
