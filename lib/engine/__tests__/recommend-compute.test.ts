import { describe, it, expect } from "vitest";
import { recommend, type Profile } from "@/lib/engine";
import { NEUTRAL_MEDIA_PRICES } from "@/lib/engine/sizing";
import { COMPUTE_PRICE_SEED } from "@/lib/pricing/compute-seed";

function baseProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    activity: "pme-startup",
    zone: "ue",
    users: 5,
    contentTypes: ["text"],
    volume: "10to100",
    growth: "medium",
    regulations: ["rgpd"],
    sensitivity: "internal",
    audit: false,
    bitemporal: false,
    techLevel: "hybrid",
    budget: "200to500",
    reqPerDay: "lt1k",
    latency: "fast",
    voices: "solo",
    modules: { bisect: 0, reversal: 0, prereg: 0, mel: 0, conflict: 0 },
    ...overrides,
  };
}

const LIGHT = baseProfile({ sensitivity: "confidential", budget: "lt50", volume: "lt1" });
const HARD = baseProfile({ sensitivity: "secret" });

function c6(r: ReturnType<typeof recommend>): number {
  const layer = r.layers.find((l) => l.id === 6);
  if (layer === undefined) throw new Error("couche C6 introuvable");
  return layer.cost;
}

// Prix compute injectés sans toucher au reste (backupPrices undefined → neutre).
function withCompute(p: Profile): ReturnType<typeof recommend> {
  return recommend(p, NEUTRAL_MEDIA_PRICES, undefined, undefined, COMPUTE_PRICE_SEED);
}

describe("recommend — intégration compute souverain (S-041)", () => {
  it("compute neutre (défaut) conserve le forfait C6 historique", () => {
    const r = recommend(baseProfile());
    expect(r.compute.monthlyCost).toBe(0);
    expect(c6(r)).toBe(100); // forfait MEDIUM historique (30/100/400)
  });

  it("compute injecté REMPLACE le forfait C6 par le coût dimensionné + sourcé", () => {
    const r = withCompute(baseProfile());
    expect(r.compute.monthlyCost).toBeGreaterThan(0);
    expect(c6(r)).toBe(r.compute.monthlyCost);
    expect(c6(r)).not.toBe(100); // ≠ forfait
  });

  it("le compute dimensionné croît avec le preset (HARD ≥ LIGHT)", () => {
    expect(withCompute(HARD).compute.monthlyCost).toBeGreaterThanOrEqual(withCompute(LIGHT).compute.monthlyCost);
  });

  it("expose les sources compute (DÉFCON 1)", () => {
    const r = withCompute(baseProfile());
    expect(r.costSources.some((s) => s.url.includes("scaleway") && /Virtual Instances/i.test(s.label))).toBe(true);
  });

  it("le profil sans prix compute garde l'invariant totalCost = baseCost + moduleCost", () => {
    const r = recommend(baseProfile());
    expect(r.totalCost).toBe(r.baseCost + r.moduleCost);
  });
});
