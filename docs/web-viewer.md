# Web Viewer

The web viewer is in `web/` and loads `web/sample-model.json`.

It uses WebGPU when available. The first implementation provides a simple render path, object metadata panels, validation messages, bill of materials, and keyboard/mouse camera controls.

Run locally:

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080/web/`.

