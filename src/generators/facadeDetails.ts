import type { ModelComponent } from "../core/types";
import { sources } from "../core/sources";
import { box, metadata } from "./builder";

export function addBaltimoreRowhouseEntryAssembly(
  components: ModelComponent[],
  x: number,
  facadeYAt: (x: number, offset?: number) => number,
  facadeAngleAt: (x: number) => number
): void {
  const angle = facadeAngleAt(x);
  const y = (offset: number) => facadeYAt(x, offset);
  const notes = [
    "Modeled from Baltimore Heritage rowhouse door anatomy: lintel, transom, threshold, doorjamb, knob, rails, stiles, and panels.",
    "Schematic proportions; final historic compatibility and product dimensions require review."
  ];

  for (const [id, railZ, railHeight] of [["top", 6.9, 0.22], ["lock", 3.95, 0.28], ["bottom", 0.82, 0.28]] as const) {
    box(
      components,
      metadata(`front-door-${id}-rail`, `Front door ${id} rail`, "facade", "painted wood door rail", sources.baltimoreRowhouseAnatomy, 140, true, notes),
      "#1b2228",
      3.12,
      0.1,
      railHeight,
      { x, y: y(0.65), z: railZ },
      angle
    );
  }

  for (const [id, stileX] of [["hanging", x - 1.45], ["lock", x + 1.45], ["center", x]] as const) {
    box(
      components,
      metadata(`front-door-${id}-stile`, `Front door ${id} stile`, "facade", "painted wood door stile", sources.baltimoreRowhouseAnatomy, 180, true, notes),
      "#1b2228",
      id === "center" ? 0.16 : 0.22,
      0.1,
      6.35,
      { x: stileX, y: facadeYAt(stileX, 0.66), z: 3.72 },
      facadeAngleAt(stileX)
    );
  }

  for (const [id, panelX, panelZ] of [
    ["upper-left", x - 0.72, 5.55],
    ["upper-right", x + 0.72, 5.55],
    ["lower-left", x - 0.72, 2.25],
    ["lower-right", x + 0.72, 2.25]
  ] as const) {
    box(
      components,
      metadata(`front-door-${id}-panel`, `Front door ${id} recessed panel`, "facade", "recessed painted wood door panel", sources.baltimoreRowhouseAnatomy, 160, true, notes),
      "#24313a",
      1.05,
      0.08,
      2.0,
      { x: panelX, y: facadeYAt(panelX, 0.70), z: panelZ },
      facadeAngleAt(panelX)
    );
  }

  for (const [id, jambX] of [["left", x - 1.75], ["right", x + 1.75]] as const) {
    box(
      components,
      metadata(`front-door-${id}-jamb`, `Front door ${id} jamb`, "facade", "painted wood doorjamb", sources.baltimoreRowhouseAnatomy, 220, true, notes),
      "#e4ddcc",
      0.18,
      0.18,
      7.35,
      { x: jambX, y: facadeYAt(jambX, 0.78), z: 3.86 },
      facadeAngleAt(jambX)
    );
  }

  box(
    components,
    metadata("front-door-head-jamb", "Front door head jamb", "facade", "painted wood doorjamb", sources.baltimoreRowhouseAnatomy, 180, true, notes),
    "#e4ddcc",
    3.7,
    0.18,
    0.18,
    { x, y: y(0.78), z: 7.48 },
    angle
  );
  box(
    components,
    metadata("front-door-threshold", "Front door raised threshold", "facade", "stone or marble threshold", sources.baltimoreRowhouseAnatomy, 480, true, notes),
    "#d6d0bf",
    3.55,
    0.62,
    0.18,
    { x, y: y(1.02), z: 0.18 },
    angle
  );
  box(
    components,
    metadata("front-door-knob", "Front door knob", "facade", "brass doorknob", sources.baltimoreRowhouseAnatomy, 95, true, notes),
    "#b8913b",
    0.18,
    0.12,
    0.18,
    { x: x + 1.08, y: facadeYAt(x + 1.08, 0.88), z: 3.95 },
    facadeAngleAt(x + 1.08)
  );
  for (const [i, paneX] of [x - 0.96, x - 0.32, x + 0.32, x + 0.96].entries()) {
    box(
      components,
      metadata(`transom-pane-${i + 1}`, `Entry transom pane ${i + 1}`, "facade", "transom glazing pane", sources.baltimoreRowhouseAnatomy, 120, true, notes),
      "#98d3ee",
      0.48,
      0.12,
      0.62,
      { x: paneX, y: facadeYAt(paneX, 0.72), z: 7.85 },
      facadeAngleAt(paneX)
    );
  }
  for (const [i, muntinX] of [x - 0.64, x, x + 0.64].entries()) {
    box(
      components,
      metadata(`transom-vertical-muntin-${i + 1}`, `Entry transom vertical muntin ${i + 1}`, "facade", "painted wood transom muntin", sources.baltimoreRowhouseAnatomy, 55, true, notes),
      "#e4ddcc",
      0.08,
      0.14,
      0.78,
      { x: muntinX, y: facadeYAt(muntinX, 0.82), z: 7.85 },
      facadeAngleAt(muntinX)
    );
  }
}

export function addBaltimoreRowhouseWindowAssembly(
  components: ModelComponent[],
  idPrefix: string,
  x: number,
  story: number,
  z: number,
  facadeYAt: (x: number, offset?: number) => number,
  facadeAngleAt: (x: number) => number
): void {
  const angle = facadeAngleAt(x);
  const insertY = (planeX: number) => facadeYAt(planeX, -0.04);
  const trimY = (planeX: number, offset = 0.82) => facadeYAt(planeX, offset);
  const notes = [
    "Modeled from Baltimore Heritage rowhouse window anatomy: brick mold, casing, lights, muntins, sash, jamb, and sill.",
    "Glass and sash are centered in the rough opening; exterior trim projects proud of the wall."
  ];
  const baseId = `${idPrefix}-${story + 1}`;

  for (const [id, frameX] of [["left", x - 1.75], ["right", x + 1.75]] as const) {
    box(
      components,
      metadata(`${baseId}-${id}-brick-mold`, `${baseId} ${id} brick mold`, "facade", "painted wood brick mold", sources.baltimoreRowhouseAnatomy, 110, true, notes),
      "#e4ddcc",
      0.18,
      0.18,
      4.9,
      { x: frameX, y: trimY(frameX), z },
      facadeAngleAt(frameX)
    );
    box(
      components,
      metadata(`${baseId}-${id}-jamb`, `${baseId} ${id} window jamb`, "facade", "painted wood window jamb", sources.baltimoreRowhouseAnatomy, 95, true, notes),
      "#c9bea8",
      0.12,
      0.16,
      4.45,
      { x: frameX + (id === "left" ? 0.18 : -0.18), y: insertY(frameX), z },
      facadeAngleAt(frameX)
    );
  }

  for (const [id, frameZ] of [["head", z + 2.35], ["meeting-rail", z], ["bottom-sash", z - 2.05]] as const) {
    box(
      components,
      metadata(`${baseId}-${id}`, `${baseId} ${id.replace("-", " ")}`, "facade", "painted wood sash rail", sources.baltimoreRowhouseAnatomy, 115, true, notes),
      "#e4ddcc",
      3.45,
      0.16,
      id === "meeting-rail" ? 0.14 : 0.18,
      { x, y: insertY(x), z: frameZ },
      angle
    );
  }

  for (const paneX of [x - 0.78, x + 0.78]) {
    box(
      components,
      metadata(`${baseId}-${paneX < x ? "left" : "right"}-vertical-muntin`, `${baseId} ${paneX < x ? "left" : "right"} vertical muntin`, "facade", "painted wood window muntin", sources.baltimoreRowhouseAnatomy, 65, true, notes),
      "#e4ddcc",
      0.08,
      0.14,
      4.1,
      { x: paneX, y: insertY(paneX), z },
      facadeAngleAt(paneX)
    );
  }
  for (const [i, muntinZ] of [z - 1.18, z + 1.18].entries()) {
    box(
      components,
      metadata(`${baseId}-horizontal-muntin-${i + 1}`, `${baseId} horizontal muntin ${i + 1}`, "facade", "painted wood window muntin", sources.baltimoreRowhouseAnatomy, 70, true, notes),
      "#e4ddcc",
      3.2,
      0.14,
      0.08,
      { x, y: insertY(x), z: muntinZ },
      angle
    );
  }
  box(
    components,
    metadata(`${baseId}-top-casing`, `${baseId} top casing`, "facade", "painted wood window casing", sources.baltimoreRowhouseAnatomy, 135, true, notes),
    "#e4ddcc",
    3.85,
    0.18,
    0.16,
    { x, y: trimY(x, 0.9), z: z + 2.58 },
    angle
  );
}
