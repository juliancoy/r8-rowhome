# R8 Rowhome

Procedural Baltimore R-8 rowhome model generator.

This project generates a code-informed rowhome visualization model from C++ geometry generators. It exports render JSON for the browser viewer and STL files for component-level inspection or 3D printing experiments.

The output is not a permit set, construction document, or substitute for review by licensed Maryland professionals.

## Build

```sh
cmake -S . -B build
cmake --build build
ctest --test-dir build --output-on-failure
```

## Generate Model

```sh
./build/r8-rowhome --json web/sample-model.json --stl-dir build/stl
```

The command writes:

- `web/sample-model.json`: viewer model
- `build/stl/*.stl`: one STL per generated component

## View

Serve the repository root with any static file server, then open `web/`.

```sh
python3 -m http.server 8080
```

Then visit `http://localhost:8080/web/`.

