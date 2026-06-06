# Rendering and Browser Performance Process

## Purpose

Verify that the generated model remains usable in the browser and that renderer choices are measured rather than assumed.

## Inputs

- `src/main.ts`
- `src/viewer/renderers.ts`
- `src/viewer/structuralOverlay.ts`
- `scripts/run-browser-smoke.py`
- `scripts/run-renderer-benchmark.py`

## Current Implementation

- WebGL2 is the default renderer.
- WebGPU is optional and can be toggled when available.
- Browser smoke validates key views and screenshots.
- Renderer benchmark records RAF timing, render timing, WebGPU adapter availability, scene stats, and direct-render errors.

## Acceptance Criteria

- The app renders a nonblank scene in production build.
- Structural-demand views show the demand legend.
- Review sheet renders four viewports.
- Renderer mode is visible and toggleable.
- WebGPU remains optional unless benchmarks show stable benefit on target hardware.

## Current Findings

- Headless Chrome can expose a WebGPU adapter.
- Direct WebGPU render-call benchmarking is fragile in this Three.js/browser combination.
- For the current scene, WebGL2 remains the more mature default.
- The model is draw-call and scene-management heavy, not GPU-throughput heavy.

## Professional Gaps

- No real-device benchmark matrix.
- No GPU timestamp query integration in app code.
- No performance budget enforced in CI.
- No draw-call reduction pipeline.

## Required Follow-Up

Benchmark on target hardware, then optimize static geometry merging, repeated-object instancing, texture reuse, and renderer lifecycle before making WebGPU the default.
