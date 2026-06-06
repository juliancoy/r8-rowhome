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
- Three.js component graph with source-traced metadata
- Validation warnings and basic dimension checks
- BOM and rough-order cost rollup
- Component STL export from the browser
- WebGPU renderer when supported, WebGL fallback otherwise
