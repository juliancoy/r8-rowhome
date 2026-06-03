# Pragmatic Path for Structural Simulation

The goal is gravity and structural engineering simulation, not game-style rigid body physics.

For this project, a physics engine such as Rapier, Cannon, or Ammo is the wrong primary tool. Those engines are useful for collision, falling objects, and interactive motion. Structural simulation needs loads, supports, stiffness, members, materials, sections, deflections, reactions, internal forces, and eventually code/design checks.

## Current Assessment

- The viewer is already built around TypeScript, Vite, and Three.js.
- The rendered rowhome is a generated architectural mesh/component model.
- The Three.js geometry should remain the visualization layer.
- Structural analysis should use a separate structural model that maps back to the visible components.

## TypeScript and JavaScript Options

- FEAScript is a JavaScript finite element library that can run in the browser or server-side JavaScript. It is worth evaluating for general FEM experiments, but it is not an out-of-box building structural solver.
- Edubeam is the closest TypeScript-native reference. It is an open-source browser app for 2D beams, trusses, and frames. It is useful to study, but it is not a full 3D rowhome structural simulator.
- Older packages such as femjs and direct-fea exist, but they appear too small or stale to use as a serious foundation.

## Better Solver Candidates

- Frame3DD is a practical first external solver candidate. It is open-source ANSI C for static and dynamic structural analysis of 2D and 3D frames and trusses. It computes deflections, reactions, internal member forces, natural frequencies, and mode shapes.
- OpenSees is a more advanced structural and geotechnical simulation framework. It is better suited for nonlinear and dynamic research-grade analysis, but has a much steeper modeling and integration burden.

## Recommended Direction

Start with a structural model layer in TypeScript, then either solve a narrow linear problem in TypeScript or call an external solver.

1. Define structural primitives:
   - nodes
   - members
   - supports
   - materials
   - section properties
   - load cases
   - load combinations

2. Map architectural components to structural members:
   - party walls
   - floor plates
   - roof deck
   - beams/joists
   - stair openings
   - foundations/basement walls

3. Add self-weight and gravity loads:
   - component dead load
   - floor live load assumptions
   - roof load assumptions
   - tributary load distribution

4. Solve first for linear static behavior:
   - support reactions
   - member axial/shear/moment forces
   - nodal displacements
   - deflected shape
   - simple pass/fail warnings for excessive displacement or missing supports

5. Visualize results in the existing Three.js viewer:
   - deformed structural skeleton
   - reaction arrows
   - gravity load arrows
   - force diagrams
   - warning overlays
   - result tables in the side panel

6. Keep professional limitations explicit:
   - conceptual analysis only
   - not a permit set
   - not a substitute for a licensed structural engineer
   - assumptions must be source-traced and visible

## Implementation Strategy

The lowest-risk first milestone is a TypeScript structural schema plus a small gravity-load report. This can be verified with tests before adding a full solver.

After that, choose between:

- TypeScript direct stiffness solver for a limited, auditable 2D or simple 3D frame/truss scope.
- Frame3DD integration for more capable 3D frame/truss analysis.
- OpenSees integration only if nonlinear materials, seismic/dynamic analysis, or research-grade structural behavior becomes a real requirement.

## Recommendation

Use TypeScript for model definition, assumptions, validation, visualization, and reports.

Use a proven structural solver for serious analysis once the model representation is mature enough.

## WebGPU Acceleration

Do not make a custom WebGPU structural solver part of the initial plan.

WebGPU is useful for browser GPU compute and visualization, but it does not solve the hardest structural engineering problems:

- creating a valid structural idealization from architectural geometry
- determining load paths and tributary areas
- representing supports, releases, openings, composite assemblies, and foundations
- assembling stiffness and mass matrices correctly
- handling constraints, singular systems, and unstable models
- validating numerical results against known engineering examples
- keeping assumptions auditable and visible

The initial implementation should use CPU-based TypeScript code and/or a proven structural solver. A small TypeScript direct-stiffness solver may be reasonable for a limited 2D or simple 3D frame/truss scope. More capable 3D analysis should use Frame3DD, OpenSees, or another proven solver behind a TypeScript interface.

WebGPU may become useful later for:

- rendering deformed shapes
- drawing force, stress, or utilization heatmaps
- animating vibration modes
- accelerating a narrow numerical kernel after the solver model is already correct

The guiding rule is:

Own the schema, assumptions, validation, and visualization in TypeScript. Do not own the high-performance solver unless the project has a proven need and enough validation coverage to support it.
