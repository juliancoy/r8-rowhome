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

## Professional Validation Boundary

Passing tests means the generated model satisfies the project's current conceptual invariants. It does not mean the rowhome is code-compliant, permit-ready, structurally adequate, mechanically sized, electrically designed, plumbed for inspection, or constructible.

`legal_procedure.md` is the controlling project document for the buildability boundary. The app validation must continue to flag `not_buildable_from_model` until professional and permit blockers are resolved.

Discipline-specific validation expectations are documented in `docs/engineering/`:

- `docs/engineering/structural-gravity.md`
- `docs/engineering/electrical.md`
- `docs/engineering/hvac.md`
- `docs/engineering/plumbing.md`
- `docs/engineering/envelope-fire-energy.md`
- `docs/engineering/site-and-streetscape.md`

Any future validation that claims compliance must include structured source extraction, deterministic tests, and professional review status.
