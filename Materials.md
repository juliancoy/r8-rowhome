# Materials

This document records the material selections represented in the procedural R-8 rowhome model, why they were chosen, and which local source documents support the assumptions. The model is schematic and source-traced, not a substitute for permit drawings, product submittals, rated assembly listings, or professional review.

## Source Baseline

- R-8 rowhouse context and zoning form: `sources/code-article-32-section-9-204-r8-rowhouse-residential.html`
- Baltimore residential code amendments and residential construction baseline: `sources/code-building-codes-part-x-international-residential-code-full.html`
- Residential energy envelope assumptions: `sources/code-building-codes-part-ix-b-residential-energy-code-full.html`
- Electrical material assumptions: `sources/code-building-codes-part-iii-national-electrical-code-full.html`
- Streetscape and landscape context: `sources/dot-complete-streets-manual-2021-03.pdf`
- Site and natural-resource assumptions: `sources/code-article-7-natural-resources-full.html`
- Baltimore rowhouse facade vocabulary: `sources/materials/facade/baltimore-heritage-anatomy-of-a-rowhouse.html`
- Curved masonry facade practice: `sources/materials/facade/bia-curved-brick-walls.pdf`

## Facade Material Options

The facade options are implemented as selectable cladding assemblies. Each option carries a material name, cladding depth, backup-wall material, approximate cost basis, and notes in `src/core/facadeMaterials.ts`.

| Option | Modeled material | Cladding depth | Backup assembly | Why selected | Source basis |
| --- | --- | ---: | --- | --- | --- |
| Brick veneer | Brick veneer and masonry | 0.36 ft | Wood stud backup wall with sheathing and weather-resistive barrier | Default Baltimore rowhouse expression with durable masonry street presence. | R-8 rowhouse context; Baltimore rowhouse anatomy; residential code baseline |
| Painted brick | Painted brick masonry | 0.36 ft | Load-bearing masonry wall with interior furring and gypsum | Represents common existing-rowhouse masonry where finish changes are more likely than full facade replacement. | Residential code baseline; rowhouse anatomy |
| Formstone | Cast stone/formstone veneer | 0.22 ft | Masonry backup wall with lath, mortar bed, and interior gypsum finish | Captures a recognizable Baltimore retrofit facade language while flagging preservation suitability. | Rowhouse anatomy; historic/preservation review sources in `sources/` |
| Fiber cement lap siding | Fiber cement siding | 0.08 ft | Wood stud backup wall with structural sheathing, rainscreen gap, and WRB | Included as a lower-cost light-cladding option, though less typical for attached rowhouse fronts. | Residential code baseline; R-8 context |
| Stucco over masonry | Stucco finish system | 0.12 ft | Masonry or cementitious backer with lath, base coat, and finish coat | Included for a moderate-cost finish system where water management details are critical. | Residential code baseline |
| Metal panel | Architectural metal panel | 0.10 ft | Wood stud backup wall with sheathing, WRB, and ventilated metal-panel subframing | Included as a contemporary alternate with higher cost and more specialized detailing. | Residential code baseline; R-8 context |

The model also includes facade elements that typify better-looking Baltimore rowhomes: stone belt courses, stone sills, lintels, entry surround, pilasters, cornice, stoop rails, transom glazing, planters, bay-front option, and a bowed-front option. These reference the rowhouse anatomy source and, for curved masonry behavior, the BIA curved-brick document.

## Wall Assemblies

Exterior and party walls are not modeled as zero-thickness planes. They are explicit layered parts so the viewer, STL export, and bill of materials can distinguish structural depth from finish layers.

- Party walls: `8 in brick or CMU masonry party wall`, with added Type X gypsum fire membrane and mineral wool fire/acoustic insulation. Chosen because attached rowhomes require robust fire separation and sound control between units. Source: `sources/code-building-codes-part-x-international-residential-code-full.html`.
- Rear wall: `8 in brick or CMU masonry rear wall`. Chosen to keep the rear structural enclosure consistent with durable rowhouse masonry practice. Source: residential code baseline.
- Front wall backup: selected per facade option, with separate structural backup, sheathing, weather-resistive barrier/flashing plane, interior gypsum, cavity insulation, and cladding. Chosen so alternate facades have real depth and realistic material layers rather than cosmetic skins. Sources: residential code baseline and energy code baseline.
- Interior partitions: `2x4 wood stud partition framing` with separate `1/2 in gypsum wallboard` faces. Chosen as a conventional residential interior partition assembly with explicit depth and finish materials. Source: residential code baseline.

## Fire-Resistance Materials

The model includes fire-protection materials as separate components rather than notes only.

- `5/8 in Type X gypsum board fire membrane` at party walls.
- `5/8 in Type X gypsum ceiling board` at protected floor/ceiling locations.
- `fireblocking at concealed floor line` at party-wall/floor intersections.
- `mineral wool fire/acoustic insulation` inside party-wall zones.

These are schematic fire-resistance layers selected to represent professional-practice intent: rated separation, continuity at concealed spaces, and protection of floor/ceiling surfaces. Final assemblies, tested ratings, fastener schedules, joints, penetrations, and continuity must be verified against the applicable residential code and approved details. Source: `sources/code-building-codes-part-x-international-residential-code-full.html`.

## Thermal And Air-Sealing Materials

The model includes explicit insulation and air-control materials because the rowhome should represent modern best-practice envelope thinking, not just visible finishes.

- Front and rear exterior wall insulation: `dense-pack cellulose or mineral wool exterior wall insulation`.
- Roof insulation and air barrier: `high-R roof insulation with continuous air barrier`.
- Rim joist insulation: `closed-cell spray foam rim joist insulation and air seal`.
- Basement foundation insulation: `continuous below-grade rigid insulation`.

These materials were chosen because rowhomes have significant heat-loss risk at roof, exterior wall, rim joist, and basement/foundation locations. The source baseline is the local residential energy code file: `sources/code-building-codes-part-ix-b-residential-energy-code-full.html`.

## Basement And Foundation Materials

The basement is modeled as an 8 ft below-grade level with durable foundation and moisture-control materials.

- `reinforced concrete slab on vapor barrier`
- `reinforced concrete foundation wall`
- `below-grade waterproofing and drainage mat`
- `continuous below-grade rigid insulation`
- `perforated foundation drain pipe and gravel`
- `electric sump pump`

These choices represent common below-grade residential practice: concrete for earth retention and durability, vapor/water control for moisture management, drainage to relieve hydrostatic pressure, and insulation for the conditioned envelope. Sources: residential code baseline and energy code baseline.

## Structure, Floors, Roof, And Stairs

- Floor plates: `engineered wood framing`, selected as a schematic modern residential framing system with predictable geometry and cost metadata. Source: residential code baseline.
- Flat roof deck: modeled with engineered framing plus roof insulation and parapet/coping. Chosen for rowhouse form compatibility. Sources: R-8 context and residential code baseline.
- Stairs: alternating-run stairs use `wood alternating-run stair tread`, painted risers, wood landings, guard rails, and handrails. The spiral option uses a `steel spiral stair center pole`, `steel and wood spiral stair tread`, and steel landing located in the front curved facade zone. Chosen to compare conventional compact rowhouse stair behavior with a compact alternate implementation. Sources: residential code baseline and `sources/stairs/icc-irc-spiral-stairways-code-change-re-12-06-16.pdf`. Spiral stair code acceptability must be reviewed for egress role and final dimensions.

## Windows, Doors, And Openings

- Windows and transoms: `window assembly` and `transom glazing`, modeled with transparent material in the viewer.
- Entry door: `insulated exterior door`.
- Rear exits and fire escape: `insulated steel rear egress door`, painted steel frames, metal thresholds, galvanized steel grating platforms, guards, stair treads, stringers, and grade landing. These make the rear means of egress and exterior escape route inspectable in the model; final egress compliance, attachment, guard geometry, corrosion protection, and fire-department requirements need professional review. Source: residential code baseline.
- Lintels and sills: `stone lintel` and `stone sill`.

These selections reflect typical rowhouse facade composition and make openings visible in the model while preserving source traceability. Sources: residential code baseline and rowhouse anatomy source.

## Mechanical, Electrical, And Plumbing-Adjacent Materials

The model follows the mission requirement for an all-electric house with no gas-fitted equipment.

- Service and distribution: `galvanized service mast with weatherhead`, `ringless meter socket enclosure`, `service-rated emergency disconnect switch`, `copper service entrance conductors in raceway`, and an accessible first-floor `200 A main-breaker load center panelboard` with visible working-clearance marker.
- Breaker panel internals: plug-on molded-case branch breakers, 2-pole range breaker, tin-plated copper neutral bus bar, and equipment-grounding bus bar.
- Branch circuits: `12 AWG copper NM-B cable with equipment grounding conductor`, ceiling junction boxes, wall switch boxes, listed device boxes, cable drops, and switched luminaire connections.
- Range circuit: `6 AWG copper range cable with equipment grounding conductor` and accessible `50 A 240 V range receptacle in listed device box`.
- Interior lighting: hardwired switched LED ceiling luminaires for room/stair lighting and a portable LED floor lamp in the living room. These are modeled as visible electrical fixtures and as runtime point lights in the viewer.
- Heating/cooling: `air-source heat pump condenser`, `electric air handler with supply and return plenums`, and `insulated refrigerant lines and control wire`.
- Ventilation: hollow galvanized steel rectangular supply, return, branch, riser, bathroom exhaust, and kitchen range hood ducts. Each duct is modeled as sheet-metal walls around an interior void and carries flow-node, design-CFM, design-velocity, and hydraulic-area metadata for downstream thermofluid/FEM or CFD preprocessing.
- Hot water: `electric heat pump water heater`.
- Plumbing: hollow potable-water service and distribution piping, represented as approved water-service pipe, Type L copper tube, and PEX/copper fixture branches; hollow PVC DWV, vent, storm leader, and condensate drain piping; standard shutoff, pressure-reducing, backflow-prevention, manifold, toilet, lavatory, shower, sink, and faucet fixtures. Each pipe carries connected flow-node names, nominal diameter, internal area, design GPM, DFU, slope, and hollow-pipe metadata so it can be exported for command-line fluid-analysis preprocessing without running that workflow in the normal website renderer.

These are selected to make the electrical, ventilation, and plumbing systems inspectable in the viewer while staying consistent with the all-electric mission. Sources: `sources/code-building-codes-part-iii-national-electrical-code-full.html`, `sources/code-building-codes-part-vi-international-plumbing-code-full.html`, and residential/mechanical code baseline files in `sources/`.

## Interior Materials And Fixtures

Interior objects are schematic and are included to make the generated unit understandable as a rowhome, not just a shell.

- Kitchen: cabinetry, countertop, electric range/oven, refrigerator, sink and faucet.
- Living areas: upholstered sofa, wood coffee table, wall-mounted television.
- Bedrooms: bed frame and mattress, wood headboard.

These are design-program materials rather than code-critical envelope materials. They are included to support spatial review, furniture clearance, and bill-of-materials visibility. Source basis: `plan.md` and the residential model assumptions.

## Site And Landscape Materials

- Lot plane: `site surface`.
- Rear yard: `pervious yard surface`.
- Stoop and equipment pads: `concrete`.
- Street tree: `urban tree` and `urban tree canopy`.

These selections distinguish building materials from site materials and keep stormwater/landscape assumptions visible. Sources: `sources/code-article-7-natural-resources-full.html` and `sources/dot-complete-streets-manual-2021-03.pdf`.

## Review Notes

- Material names and depths are implementation assumptions for procedural visualization and rough cost estimates.
- Source references identify the local authority set used by the model; they do not certify code compliance.
- Professional design review is still required for rated assemblies, structural sizing, energy-code compliance, waterproofing details, historic-district appropriateness, electrical design, mechanical sizing, and permit submissions.
