# Validation

The current validation layer reports source-traced warnings and basic configuration errors.

Initial checks:

- Building width must not exceed configured lot width.
- Building depth must not exceed configured lot depth.
- Generated models always include a professional-review warning.

Use strict mode to make validation errors affect the CLI exit code:

```sh
./build/r8-rowhome --strict
```

