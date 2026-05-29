import { describe, it, expect } from "vitest";
import {
  decidePreset,
  computeScores,
  profileCostFactors,
  costBand,
  recommend,
  PRESET_PROFILES,
  PRESETS,
  type Profile,
  type ScoreKey,
} from "@/lib/engine";

function baseProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    activity: "freelance",
    zone: "ue",
    users: 1,
    contentTypes: ["text"],
    volume: "1to10",
    growth: "medium",
    regulations: ["rgpd"],
    sensitivity: "internal",
    audit: false,
    bitemporal: false,
    techLevel: "hybrid",
    budget: "50to200",
    reqPerDay: "lt100",
    latency: "fast",
    voices: "solo",
    modules: { bisect: 0, reversal: 0, prereg: 0, mel: 0, conflict: 0 },
    ...overrides,
  };
}

function scoreOf(profile: Profile, key: ScoreKey): number {
  const dim = recommend(profile).scores.find((s) => s.key === key);
  if (dim === undefined) throw new Error(`dimension ${key} introuvable`);
  return dim.score;
}

describe("decidePreset", () => {
  it("HARD si données secrètes", () => {
    expect(decidePreset(baseProfile({ sensitivity: "secret" })).preset).toBe("HARD");
  });

  it("HARD si cabinet régulé", () => {
    expect(decidePreset(baseProfile({ activity: "cabinet-regule" })).preset).toBe("HARD");
  });

  it("HARD si audit ET bitemporel obligatoires", () => {
    expect(decidePreset(baseProfile({ audit: true, bitemporal: true })).preset).toBe("HARD");
  });

  it("LIGHT si solo confidentiel, petit budget, faible volume, sans audit", () => {
    const p = baseProfile({
      sensitivity: "confidential",
      users: 1,
      budget: "lt50",
      volume: "lt1",
      audit: false,
      bitemporal: false,
    });
    expect(decidePreset(p).preset).toBe("LIGHT");
  });

  it("MEDIUM par défaut (sensibilité interne non éligible LIGHT)", () => {
    expect(decidePreset(baseProfile({ sensitivity: "internal" })).preset).toBe("MEDIUM");
  });
});

describe("computeScores", () => {
  it("conformité = 10 en HARD", () => {
    const dims = computeScores("HARD", baseProfile(), 100);
    expect(dims.find((d) => d.key === "conf")?.score).toBe(10);
  });

  it("conformité dégradée si audit requis en LIGHT", () => {
    const dims = computeScores("LIGHT", baseProfile({ audit: true }), 50);
    // base 6 +1 (rgpd) = 7 ; LIGHT + audit requis => max(3, 7-3) = 4
    expect(dims.find((d) => d.key === "conf")?.score).toBe(4);
  });

  it("auditabilité = 10 si bitemporel requis hors LIGHT", () => {
    const dims = computeScores("MEDIUM", baseProfile({ bitemporal: true }), 100);
    expect(dims.find((d) => d.key === "audit")?.score).toBe(10);
  });

  it("retourne toujours les 10 dimensions", () => {
    expect(computeScores("MEDIUM", baseProfile(), 100)).toHaveLength(10);
  });
});

describe("computeScores — résilience (9ᵉ dimension, S-027)", () => {
  // DR neutralisé par défaut (residency drTier none) pour ISOLER l'axe backup. Depuis S-045, la
  // dimension `resilience` intègre aussi le DR régional (testé séparément ci-dessous).
  function resilienceOf(profile: Profile): number {
    const p: Profile = { ...profile, residency: profile.residency ?? { drTier: "none" } };
    const dim = computeScores("MEDIUM", p, 100).find((d) => d.key === "resilience");
    if (dim === undefined) throw new Error("dimension resilience introuvable");
    return dim.score;
  }

  it("le DR régional renforce la résilience (extension S-045)", () => {
    const noDr = resilienceOf(baseProfile({ backup: { criticality: "standard" }, residency: { drTier: "none" } }));
    const hotDr = resilienceOf(baseProfile({ backup: { criticality: "standard" }, residency: { drTier: "hot" } }));
    expect(hotDr).toBeGreaterThan(noDr);
  });

  it("croît strictement avec la criticité (none < standard < high < critical)", () => {
    const none = resilienceOf(baseProfile()); // pas de backup => criticité none
    const standard = resilienceOf(baseProfile({ backup: { criticality: "standard" } }));
    const high = resilienceOf(baseProfile({ backup: { criticality: "high" } }));
    const critical = resilienceOf(baseProfile({ backup: { criticality: "critical" } }));
    expect(none).toBeLessThan(standard);
    expect(standard).toBeLessThan(high);
    expect(high).toBeLessThan(critical);
  });

  it("absence de backup => score plancher + libellé d'alerte (pas de sauvegarde)", () => {
    const dim = computeScores("MEDIUM", baseProfile(), 100).find((d) => d.key === "resilience");
    expect(dim?.score).toBe(1);
    expect(dim?.why).toMatch(/Aucune sauvegarde/i);
  });

  it("pénalise un RPO incohérent avec la criticité déclarée (override expert laxiste)", () => {
    const coherent = resilienceOf(baseProfile({ backup: { criticality: "critical" } }));
    const incoherent = resilienceOf(baseProfile({ backup: { criticality: "critical", rpoMinutes: 1440 } }));
    expect(incoherent).toBeLessThan(coherent);
  });

  it("la surcharge conformité (secret) renforce la résilience (crypto-shred + immutable)", () => {
    const base = resilienceOf(baseProfile({ backup: { criticality: "standard" } }));
    const secret = resilienceOf(
      baseProfile({ sensitivity: "secret", backup: { criticality: "standard" } }),
    );
    expect(secret).toBeGreaterThanOrEqual(base);
  });
});

describe("profileCostFactors", () => {
  it("cumule volume + débit + utilisateurs au-delà de 10", () => {
    const p = baseProfile({ volume: "gt1000", reqPerDay: "gt10k", users: 20 });
    // 200 (volume) + 250 (req) + round((20-10)*1.5)=15 = 465
    expect(profileCostFactors(p)).toBe(465);
  });

  it("aucun surcoût utilisateurs si <= 10", () => {
    expect(profileCostFactors(baseProfile({ volume: "lt1", reqPerDay: "lt100", users: 10 }))).toBe(0);
  });
});

describe("recommend", () => {
  it("produit une recommandation structurellement valide pour chaque profil-type", () => {
    for (const preset of PRESET_PROFILES) {
      const r = recommend(preset.profile);
      expect(r.layers).toHaveLength(7);
      expect(r.scores).toHaveLength(10);
      expect(PRESETS).toContain(r.preset);
      expect(r.totalCost).toBeGreaterThan(0);
      expect(r.scoreAvg).toBeGreaterThanOrEqual(0);
      expect(r.scoreAvg).toBeLessThanOrEqual(10);
      expect(r.totalCost).toBe(r.baseCost + r.moduleCost);
    }
  });

  // S-051 : RÉCONCILIATION étiquette ↔ règles. Le modèle scoré est calibré pour que chaque
  // profil-type calcule EXACTEMENT son `expected` (lève l'incohérence historique, ex. Coach MEDIUM).
  it("le preset calculé correspond à l'étiquette expected de CHAQUE profil-type (réconciliation)", () => {
    for (const preset of PRESET_PROFILES) {
      expect(decidePreset(preset.profile).preset).toBe(preset.expected);
    }
  });

  it("le module conflict (max) augmente la conformité et le coût", () => {
    const off = baseProfile();
    const on = baseProfile({ modules: { bisect: 0, reversal: 0, prereg: 0, mel: 0, conflict: 4 } });
    expect(scoreOf(on, "conf")).toBeGreaterThan(scoreOf(off, "conf"));
    expect(recommend(on).totalCost).toBeGreaterThan(recommend(off).totalCost);
    expect(recommend(on).activeModules).toHaveLength(1);
  });

  it("est déterministe", () => {
    const p = baseProfile({ contentTypes: ["text", "audio"], voices: "multi" });
    expect(JSON.stringify(recommend(p))).toBe(JSON.stringify(recommend(p)));
  });
});

describe("costBand", () => {
  it("encadre le coût à ±30 % par défaut", () => {
    expect(costBand(100)).toEqual({ low: 70, high: 130 });
  });

  it("accepte un spread personnalisé", () => {
    expect(costBand(200, 0.5)).toEqual({ low: 100, high: 300 });
  });
});
