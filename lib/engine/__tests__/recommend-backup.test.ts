import { describe, it, expect } from "vitest";
import { recommend, type Profile } from "@/lib/engine";
import { NEUTRAL_MEDIA_PRICES, type MultimodalPriceTable } from "@/lib/engine/sizing";
import { BACKUP_PRICE_SEED } from "@/lib/pricing/backup-seed";

function baseProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    activity: "pme-startup",
    continent: "europe",
    country: "union-europeenne",
    zone: "ue",
    users: 5,
    contentTypes: ["text"],
    volume: "10to100",
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

// Prix médias avec un stockage chaud non nul (le backup réutilise ce tarif pour le chiffrage).
const MEDIA_WITH_STORAGE: MultimodalPriceTable = {
  ...NEUTRAL_MEDIA_PRICES,
  storagePerGbMonth: {
    amount: 0.0146,
    currency: "EUR",
    unit: "Go·mois",
    confidence: "high",
    source: { label: "Scaleway Object Storage", url: "https://www.scaleway.com/en/pricing/storage/", checkedAt: "2026-05-27" },
  },
};

function resilienceOf(r: ReturnType<typeof recommend>): number {
  const dim = r.scores.find((s) => s.key === "resilience");
  if (dim === undefined) throw new Error("dimension resilience introuvable");
  return dim.score;
}

function c6Cost(r: ReturnType<typeof recommend>): number {
  const c6 = r.layers.find((l) => l.id === 6);
  if (c6 === undefined) throw new Error("couche C6 introuvable");
  return c6.cost;
}

describe("recommend — intégration backup (S-028)", () => {
  it("remplit toujours Recommendation.backup (criticité none par défaut, coûts 0)", () => {
    const r = recommend(baseProfile());
    expect(r.backup.criticality).toBe("none");
    expect(r.backup.monthlyCost).toBe(0);
    expect(r.backup.setupCost).toBe(0);
  });

  it("profil sans backup : invariant totalCost = baseCost + moduleCost, même avec prix backup réels", () => {
    const r = recommend(baseProfile(), MEDIA_WITH_STORAGE, undefined, BACKUP_PRICE_SEED);
    expect(r.totalCost).toBe(r.baseCost + r.moduleCost);
    // none → aucun surcoût backup vs prix neutres
    expect(r.totalCost).toBe(recommend(baseProfile(), MEDIA_WITH_STORAGE).totalCost);
  });

  it("backup critique + prix réels : coût récurrent injecté dans C6 et totalCost augmente", () => {
    const withBackup = recommend(
      baseProfile({ backup: { criticality: "critical" } }),
      MEDIA_WITH_STORAGE,
      undefined,
      BACKUP_PRICE_SEED,
    );
    const without = recommend(baseProfile(), MEDIA_WITH_STORAGE, undefined, BACKUP_PRICE_SEED);
    expect(withBackup.backup.monthlyCost).toBeGreaterThan(0);
    expect(c6Cost(withBackup)).toBeGreaterThan(c6Cost(without));
    expect(withBackup.totalCost).toBeGreaterThan(without.totalCost);
  });

  it("la mise en route inclut le premier full de sauvegarde", () => {
    const withBackup = recommend(
      baseProfile({ backup: { criticality: "critical" } }),
      MEDIA_WITH_STORAGE,
      undefined,
      BACKUP_PRICE_SEED,
    );
    const without = recommend(baseProfile(), MEDIA_WITH_STORAGE, undefined, BACKUP_PRICE_SEED);
    expect(withBackup.setupCost).toBeGreaterThan(without.setupCost);
    expect(withBackup.backup.setupCost).toBeGreaterThan(0);
  });

  it("la dimension resilience reflète le plan (critical > none)", () => {
    const critical = resilienceOf(recommend(baseProfile({ backup: { criticality: "critical" } })));
    const none = resilienceOf(recommend(baseProfile()));
    expect(critical).toBeGreaterThan(none);
  });

  it("expose les sources de coût backup (DÉFCON 1)", () => {
    const r = recommend(
      baseProfile({ backup: { criticality: "high" } }),
      MEDIA_WITH_STORAGE,
      undefined,
      BACKUP_PRICE_SEED,
    );
    expect(r.backup.costSources.length).toBeGreaterThan(0);
    expect(r.costSources.some((s) => s.url.includes("scaleway"))).toBe(true);
  });
});
