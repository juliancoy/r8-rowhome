import { describe, expect, it } from "vitest";
import { buildPrintKitExport } from "../src/export/printKit";

describe("3D print kit export", () => {
  const masonryExport = buildPrintKitExport("masonry-wood");

  it("exports every printable component into a named kit at 1:48 scale", () => {
    expect(masonryExport.scale).toBe("1:48");
    expect(masonryExport.millimetersPerFoot).toBeCloseTo(6.35, 3);
    expect(masonryExport.printedComponentCount).toBeGreaterThan(900);
    const kitTotal = masonryExport.kits.reduce((sum, kit) => sum + kit.componentCount, 0);
    expect(kitTotal).toBe(masonryExport.printedComponentCount);
    const kitIds = masonryExport.kits.map((kit) => kit.kitId);
    for (const required of ["site-base", "shell-envelope", "structure-egress", "mep-overlays"]) {
      expect(kitIds).toContain(required);
    }
  });

  it("produces valid ASCII STL text for every kit", () => {
    for (const kit of masonryExport.kits) {
      expect(kit.stlText.startsWith("solid"), kit.kitId).toBe(true);
      expect(kit.stlText.trimEnd().endsWith("endsolid exported"), kit.kitId).toBe(true);
      expect(kit.stlText).toContain("facet normal");
      expect(kit.stlText).toContain("vertex");
    }
  });

  it("scales geometry into millimeters", () => {
    const shell = masonryExport.kits.find((kit) => kit.kitId === "shell-envelope");
    expect(shell).toBeDefined();
    if (!shell) return;
    const vertexPattern = /vertex ([\d.eE+-]+) ([\d.eE+-]+) ([\d.eE+-]+)/g;
    let maxCoordinate = 0;
    let match: RegExpExecArray | null;
    let inspected = 0;
    while ((match = vertexPattern.exec(shell.stlText)) !== null && inspected < 20000) {
      inspected += 1;
      for (const value of [match[1], match[2], match[3]]) {
        maxCoordinate = Math.max(maxCoordinate, Math.abs(Number(value)));
      }
    }
    // The 48 ft deep lot at 1:48 spans about 305 mm; raw feet would stay under 100.
    expect(maxCoordinate).toBeGreaterThan(150);
    expect(maxCoordinate).toBeLessThan(2000);
  });

  it("excludes non-printable marker components", () => {
    expect(masonryExport.excludedComponentCount).toBeGreaterThan(0);
  });

  it("exports the steel-concrete variant with its own kit set", () => {
    const steelExport = buildPrintKitExport("steel-concrete");
    expect(steelExport.printedComponentCount).toBeGreaterThan(900);
    expect(steelExport.kits.every((kit) => kit.filename.includes("steel-concrete"))).toBe(true);
    const structure = steelExport.kits.find((kit) => kit.kitId === "structure-egress");
    expect(structure).toBeDefined();
    expect(steelExport.manifest.every((entry) => entry.recommendedHandling.length > 0)).toBe(true);
  });
});
