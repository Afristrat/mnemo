import { describe, it, expect } from "vitest";
import { costLlmUsage, estimateLlmUsage, NEUTRAL_LLM_PRICES, recommend, type LlmTokenPrices, type Profile } from "@/lib/engine";
import { getLlmTokenPrices } from "@/lib/pricing/llm-token-seed";

function prof(over: Partial<Profile> = {}): Profile {
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
    sensitivity: "internal",
    audit: false,
    bitemporal: false,
    techLevel: "hybrid",
    budget: "200to500",
    reqPerDay: "lt1k",
    latency: "fast",
    voices: "solo",
    modules: { bisect: 0, reversal: 0, prereg: 0, mel: 0, conflict: 0 },
    ...over,
  };
}

// Table de prix de test (€/1M) — découplée du seed pour des assertions stables.
const PRICES: LlmTokenPrices = {
  defaultApi: { model: "Test API", inputPerMillionEur: 1, outputPerMillionEur: 10, sovereignty: "sovereign", source: { label: "t", url: "https://x", checkedAt: "2026-05-31" } },
  options: [],
};

describe("estimateLlmUsage (S-074)", () => {
  it("le volume de tokens croît avec le débit de requêtes", () => {
    const low = estimateLlmUsage(prof({ reqPerDay: "lt100" }));
    const high = estimateLlmUsage(prof({ reqPerDay: "gt10k" }));
    expect(high.monthlyTokensIn).toBeGreaterThan(low.monthlyTokensIn);
    expect(high.monthlyTokensOut).toBeGreaterThan(low.monthlyTokensOut);
  });
});

describe("costLlmUsage (S-074)", () => {
  it("prix neutres → coût 0 (invariant)", () => {
    expect(costLlmUsage(prof(), "MEDIUM", NEUTRAL_LLM_PRICES).monthlyCost).toBe(0);
  });

  it("mode API : coût = tokens × prix/1M du modèle par défaut, source portée", () => {
    const u = costLlmUsage(prof({ reqPerDay: "lt1k" }), "MEDIUM", PRICES);
    expect(u.selfHosted).toBe(false);
    expect(u.pricedModel).toBe("Test API");
    // 500 req/j × 30 = 15000 req/mois ; in 15000×2500=37,5M ; out 15000×600=9M
    // coût = 37,5×1 + 9×10 = 37,5 + 90 = 127,5 → arrondi 128
    expect(u.monthlyCost).toBe(Math.round((37_500_000 / 1e6) * 1 + (9_000_000 / 1e6) * 10));
    expect(u.source?.url).toBe("https://x");
  });

  it("auto-hébergé (preset HARD) → coût 0 (déjà compté dans le compute), volume exposé", () => {
    const u = costLlmUsage(prof(), "HARD", PRICES);
    expect(u.selfHosted).toBe(true);
    expect(u.monthlyCost).toBe(0);
    expect(u.monthlyTokensIn).toBeGreaterThan(0);
    expect(u.source).toBeNull();
  });

  it("préférence souveraineté → auto-hébergé (coût à l'usage 0)", () => {
    expect(costLlmUsage(prof({ preferSovereign: true }), "MEDIUM", PRICES).monthlyCost).toBe(0);
  });
});

describe("intégration recommend (S-074)", () => {
  it("prix LLM neutres (défaut) → totalCost inchangé vs sans (invariant)", () => {
    const p = prof();
    expect(recommend(p).llmUsage.monthlyCost).toBe(0);
    expect(recommend(p).totalCost).toBe(recommend(p, undefined, undefined, undefined, undefined, undefined, NEUTRAL_LLM_PRICES).totalCost);
  });

  it("prix LLM injectés (seed) sur profil API → coût LLM > 0 ajouté au total + llmUsage rempli + source", () => {
    const p = prof({ reqPerDay: "lt10k" }); // gros débit, MEDIUM (API)
    const base = recommend(p);
    const withLlm = recommend(p, undefined, undefined, undefined, undefined, undefined, getLlmTokenPrices());
    expect(withLlm.llmUsage.monthlyCost).toBeGreaterThan(0);
    expect(withLlm.totalCost).toBe(base.totalCost + withLlm.llmUsage.monthlyCost);
    expect(withLlm.costSources.some((s) => s.url.includes("deepseek"))).toBe(true);
  });
});
