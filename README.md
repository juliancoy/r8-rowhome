# R8 Rowhome

Browser-first procedural Baltimore R-8 rowhome model generator.

The app uses TypeScript, Vite, Three.js, and a WebGPU-first renderer with WebGL fallback. It generates a source-traced conceptual rowhome model, exposes bill-of-materials and validation metadata, and exports selected components to STL.

The output is not a permit set, construction document, or substitute for review by licensed Maryland professionals.

See [`legal_procedure.md`](legal_procedure.md) for the legal/buildability procedure and current construction boundary.

## Install

```sh
npm install
```

## Develop

```sh
npm run dev
```

## Verify

```sh
npm test
npm run build
```

## Engineering Process Docs

The engineering subprocess documentation lives in `docs/engineering/`:

- Architecture and program
- Structural gravity
- Envelope, fire, and energy
- Electrical
- HVAC
- Plumbing
- Site and streetscape
- Cost and bill of materials
- Validation and QA
- Rendering and browser performance
- Artifacts and releases
- Permit and professional review

Start with [`docs/engineering/README.md`](docs/engineering/README.md).

## Current Scope

- Default R-8 rowhome concept generator
- Two selectable construction systems: brick masonry + wood framing, or steel frame + concrete (`#steel-concrete` hash or the Options panel selector)
- Three.js component graph with source-traced metadata
- Validation warnings and basic dimension checks
- BOM and rough-order cost rollup
- Component STL export from the browser
- WebGPU renderer when supported, WebGL fallback otherwise

## Personnel, Permits, and Print Artifacts

```sh
npm run sow:generate        # personnel-driven statements of work (both construction systems)
npm run permit:package      # Baltimore DHCD permit application package and document register
npm run electrical:circuits # electrical service/circuit connectivity and panel-schedule verification
npm run hvac:fem            # duct topology with connectivity and nodal flow-conservation checks
npm run print:kit           # one-command STL export of the whole model at 1:48, both systems
```

The personnel database (`src/core/personnel.ts`) defines the roles, skills, Maryland
credentials, crew sizes, and phase staffing used by the statement of work; structure
roles alternate automatically between the masonry and steel-concrete systems.

The permit package organizes the DHCD application path and explicitly lists every
document that still requires a licensed Maryland professional or site-specific input —
generated artifacts are design inputs, not sealed documents.
