import { describe, it, expect } from "vitest";
import { computeRadarPoints, toPolygonPoints } from "@/lib/charts/radar";

describe("computeRadarPoints", () => {
  it("place le premier axe en haut du cercle", () => {
    const pts = computeRadarPoints([10, 10, 10, 10], { max: 10, radius: 100, cx: 100, cy: 100 });
    expect(pts).toHaveLength(4);
    expect(pts[0].x).toBeCloseTo(100, 1);
    expect(pts[0].y).toBeCloseTo(0, 1);
  });

  it("réduit le rayon proportionnellement à la valeur", () => {
    const pts = computeRadarPoints([5], { max: 10, radius: 100, cx: 100, cy: 100 });
    expect(pts[0].y).toBeCloseTo(50, 1);
  });

  it("borne les valeurs hors plage", () => {
    const pts = computeRadarPoints([20], { max: 10, radius: 100, cx: 100, cy: 100 });
    expect(pts[0].y).toBeCloseTo(0, 1);
  });

  it("gère un tableau vide", () => {
    expect(computeRadarPoints([], { max: 10, radius: 100, cx: 100, cy: 100 })).toHaveLength(0);
  });
});

describe("toPolygonPoints", () => {
  it("sérialise les points pour l'attribut SVG", () => {
    expect(
      toPolygonPoints([
        { x: 1.234, y: 5.678 },
        { x: 9, y: 10 },
      ]),
    ).toBe("1.23,5.68 9.00,10.00");
  });
});
