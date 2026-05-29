import { describe, it, expect } from "vitest";
import { recommend, buildEnsemble, type ComputePriceTable, type Profile, type ResidencyPriceTable } from "@/lib/engine";

// S-046, intégration résidence/DR dans recommend (+ ensemble). Prix INJECTÉS, défaut neutre.
// Vérifie : Recommendation.residency rempli, coût réplication+repli DANS C6, invariant neutre,
// geosov dans les scores, ensemble threadé.

function baseProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    activity: "pme-startup",
    zone: "ue",
    users: 5,
    contentTypes: ["text"],
    volume: "100to1000",
    growth: "medium",
    regulations: ["rgpd"],
    sensitivity: "confidential",
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

const residencyPrices: ResidencyPriceTable = {
  egressVectors: [
    {
      provider: "Test",
      hostingClass: "sovereign-eu",
      sovereign: true,
      interRegionEgress: {
        amount: 0.01,
        currency: "EUR",
        unit: "Go",
        confidence: "high",
        source: { label: "egress", url: "https://egress.test", checkedAt: "2026-05-29" },
      },
    },
  ],
  interSiteSecurity: {
    selfHostedGatewayPerMonth: { amount: 0, currency: "EUR", unit: "mois", confidence: "low", source: null },
    managedPerUserPerMonth: { amount: 0, currency: "EUR", unit: "utilisateur·mois", confidence: "low", source: null },
  },
};
const computePrices: ComputePriceTable = {
  glue: { name: "glue", vcpu: 2, ramGb: 4, pricePerHourEur: 0.01, source: { label: "c", url: "https://compute.test", checkedAt: "2026-05-29" } },
  node: { name: "node", vcpu: 8, ramGb: 16, pricePerHourEur: 0.05, source: { label: "c", url: "https://compute.test", checkedAt: "2026-05-29" } },
};

function c6Cost(r: ReturnType<typeof recommend>): number {
  const c6 = r.layers.find((l) => l.id === 6);
  if (c6 === undefined) throw new Error("couche C6 introuvable");
  return c6.cost;
}

describe("recommend — intégration résidence/DR (S-046)", () => {
  it("remplit toujours Recommendation.residency (mono-région + DR none par défaut, coûts 0)", () => {
    const r = recommend(baseProfile());
    expect(r.residency.primaryRegion).toBe("eu");
    expect(r.residency.drTier).toBe("none");
    expect(r.residency.monthlyCost).toBe(0);
  });

  it("profil sans DR : invariant totalCost = baseCost + moduleCost, même avec prix résidence réels", () => {
    const r = recommend(baseProfile(), undefined, undefined, undefined, computePrices, residencyPrices);
    expect(r.totalCost).toBe(r.baseCost + r.moduleCost);
  });

  it("DR critique + prix réels : coût résidence injecté dans C6 et totalCost augmente", () => {
    const withDr = recommend(
      baseProfile({ backup: { criticality: "critical" } }),
      undefined,
      undefined,
      undefined,
      computePrices,
      residencyPrices,
    );
    const without = recommend(baseProfile(), undefined, undefined, undefined, computePrices, residencyPrices);
    expect(withDr.residency.drTier).toBe("hot");
    expect(withDr.residency.monthlyCost).toBeGreaterThan(0);
    expect(c6Cost(withDr)).toBeGreaterThan(c6Cost(without));
    expect(withDr.totalCost).toBeGreaterThan(without.totalCost);
    expect(withDr.setupCost).toBeGreaterThan(without.setupCost);
  });

  it("les scores incluent la 10ᵉ dimension geosov, alimentée par le plan résidence", () => {
    const r = recommend(baseProfile());
    const geosov = r.scores.find((s) => s.key === "geosov");
    expect(geosov).toBeDefined();
    expect(r.scores).toHaveLength(10);
  });

  it("expose les sources de coût résidence (DÉFCON 1) quand un réplica est dimensionné", () => {
    const r = recommend(
      baseProfile({ backup: { criticality: "critical" } }),
      undefined,
      undefined,
      undefined,
      computePrices,
      residencyPrices,
    );
    expect(r.residency.costSources.length).toBeGreaterThan(0);
    expect(r.costSources.some((s) => s.url === "https://egress.test")).toBe(true);
  });

  it("l'ensemble threade les prix résidence (baseline.residency rempli)", () => {
    const e = buildEnsemble(baseProfile({ backup: { criticality: "critical" } }), undefined, undefined, undefined, computePrices, residencyPrices);
    expect(e.baseline.residency.drTier).toBe("hot");
    expect(e.baseline.residency.monthlyCost).toBeGreaterThan(0);
  });
});
