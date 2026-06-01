import { describe, it, expect } from "vitest";
import { msg } from "@/lib/engine/message";
import type { ScoreDimension } from "@/lib/engine";
import { deriveHealthSignals } from "@/lib/monitoring/signals";

// S-081 : dérivation des signaux de santé depuis la reco (santé de CONCEPTION). Vérifie le mapping
// resilience/compliance (scores 0–10 → 0–100), l'adhérence budgétaire, et que les dimensions non
// dérivables restent NON mesurées (DÉFCON 1).

function dim(key: ScoreDimension["key"], score: number): ScoreDimension {
  return { key, label: msg(`scores.${key}.label`), score, why: msg(`scores.${key}.why`) };
}

describe("deriveHealthSignals (S-081)", () => {
  it("mappe resilience et conformité (0–10 → 0–100)", () => {
    const s = deriveHealthSignals({ scores: [dim("resilience", 8), dim("conf", 6)], totalCost: 10, budget: "gt2k" });
    expect(s.resilience).toBe(80);
    expect(s.compliance).toBe(60);
  });

  it("budget = 100 si le coût tient dans le plafond", () => {
    const s = deriveHealthSignals({ scores: [], totalCost: 150, budget: "50to200" });
    expect(s.budget).toBe(100);
  });

  it("budget décroît au prorata en cas de dépassement", () => {
    // plafond lt50 = 50 ; coût 100 → 50/100 = 50
    const s = deriveHealthSignals({ scores: [], totalCost: 100, budget: "lt50" });
    expect(s.budget).toBe(50);
  });

  it("gt2k = adhérence neutre (pas de plafond)", () => {
    const s = deriveHealthSignals({ scores: [], totalCost: 99999, budget: "gt2k" });
    expect(s.budget).toBe(100);
  });

  it("dimensions non dérivables (availability/freshness/drift) NON mesurées", () => {
    const s = deriveHealthSignals({ scores: [dim("resilience", 5)], totalCost: 10, budget: "gt2k" });
    expect(s.availability).toBeUndefined();
    expect(s.freshness).toBeUndefined();
    expect(s.drift).toBeUndefined();
  });

  it("score moteur absent → dimension non renseignée (jamais inventée)", () => {
    const s = deriveHealthSignals({ scores: [], totalCost: 10, budget: "gt2k" });
    expect(s.resilience).toBeUndefined();
    expect(s.compliance).toBeUndefined();
    expect(s.budget).toBe(100); // budget toujours dérivable du coût + palier
  });
});
