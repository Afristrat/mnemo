import { describe, it, expect } from "vitest";
import { compareRealVsEstimated, DEFAULT_TOLERANCE_PCT } from "@/lib/network/real-cost";
import { buildRealCostRows } from "@/lib/network/real-cost-persist";

// S-082 (F13) : comparaison coût réel vs estimé. Écart factuel + statut par tolérance ±30 %.

describe("compareRealVsEstimated (S-082)", () => {
  it("statut within/over/under selon la tolérance ±30 %", () => {
    const c = compareRealVsEstimated([
      { poste: "A", estimated: 100, real: 110 }, // +10 % → within
      { poste: "B", estimated: 100, real: 140 }, // +40 % → over
      { poste: "C", estimated: 100, real: 50 }, // −50 % → under
    ]);
    expect(c.posts[0].status).toBe("within");
    expect(c.posts[1].status).toBe("over");
    expect(c.posts[2].status).toBe("under");
    expect(c.posts[1].deltaPct).toBe(40);
    expect(c.posts[2].deltaAbs).toBe(-50);
  });

  it("agrège le total et flag le dépassement global", () => {
    const c = compareRealVsEstimated([
      { poste: "A", estimated: 100, real: 200 },
      { poste: "B", estimated: 100, real: 100 },
    ]);
    expect(c.totalEstimated).toBe(200);
    expect(c.totalReal).toBe(300);
    expect(c.totalDeltaPct).toBe(50);
    expect(c.withinTolerance).toBe(false);
    expect(c.tolerancePct).toBe(DEFAULT_TOLERANCE_PCT);
  });

  it("dans la tolérance globale → withinTolerance true", () => {
    const c = compareRealVsEstimated([{ poste: "A", estimated: 100, real: 120 }]);
    expect(c.withinTolerance).toBe(true);
  });

  it("estimé nul : 0 si réel nul, 100 % si réel positif (pas de division par zéro)", () => {
    expect(compareRealVsEstimated([{ poste: "A", estimated: 0, real: 0 }]).posts[0].deltaPct).toBe(0);
    expect(compareRealVsEstimated([{ poste: "A", estimated: 0, real: 10 }]).posts[0].deltaPct).toBe(100);
  });
});

describe("buildRealCostRows (S-082)", () => {
  it("construit une ligne par poste (audit), circle/created null par défaut", () => {
    const comparison = compareRealVsEstimated([{ poste: "Stockage", estimated: 100, real: 130 }]);
    const rows = buildRealCostRows({ comparison, checkedAt: "2026-06-01" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ poste: "Stockage", estimated: 100, real_cost: 130, status: "within", circle_id: null });
    expect(rows[0].checked_at).toBe("2026-06-01");
  });
});
