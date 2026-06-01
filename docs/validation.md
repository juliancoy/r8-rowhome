# Validation

The current validation layer reports source-traced warnings and basic configuration errors.

Initial checks:

- Building width must not exceed configured lot width.
- Building depth must not exceed configured lot depth.
- Generated models always include a professional-review warning.
- Gas-fitted components are reported as errors because the mission requires all-electric homes.

Run tests:

```sh
npm test
```

Future work should add strict-mode validation for source-derived constraints as the constraint model matures.
