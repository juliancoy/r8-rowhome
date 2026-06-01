# Source Traceability

This project uses local source documents in `sources/` as the baseline for modeled assumptions.

Initial generated components cite source files in their TypeScript metadata and exported JSON:

- R-8 context and rowhouse form: `sources/code-article-32-section-9-204-r8-rowhouse-residential.html`
- Residential structure, foundation, basement, stair, fire-resistance, gypsum membrane, fireblocking, and party-wall assumptions: `sources/code-building-codes-part-x-international-residential-code-full.html`
- Spiral stair dimensional reference: `sources/stairs/icc-irc-spiral-stairways-code-change-re-12-06-16.pdf`
- Residential energy envelope, insulation, and air-sealing assumptions: `sources/code-building-codes-part-ix-b-residential-energy-code-full.html`
- Electrical system assumptions: `sources/code-building-codes-part-iii-national-electrical-code-full.html`
- Site, grading, and landscape assumptions: `sources/code-article-7-natural-resources-full.html`
- Streetscape and tree assumptions: `sources/dot-complete-streets-manual-2021-03.pdf`

The model is not a code compliance determination. Source extraction should be reviewed before any rule is treated as a hard validation error.
