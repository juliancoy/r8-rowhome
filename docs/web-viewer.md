# Web Viewer

The web viewer is a Vite app rooted at `index.html` and `src/main.ts`.

It uses Three.js with WebGPU when available and WebGL fallback otherwise. The current implementation provides a generated rowhome scene, orbit controls, selectable components, source metadata panels, validation messages, bill of materials, rough cost rollup, metadata JSON export, and STL export.

Run locally:

```sh
npm run dev
```

Open the Vite URL printed by the dev server.
