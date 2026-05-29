import { describe, it, expect } from "vitest";
import type { ComputePriceTable, Profile } from "@/lib/engine";
import { deriveResidencyPlan, deriveResidencyTopology, hostingClassForProfile } from "@/lib/engine";
import type { ResidencyPriceTable } from "@/lib/pricing/residency-seed";

// S-044, moteur résidence/DR pur (spec n°2 §3-§7). Prix INJECTÉS (DÉFCON 1), défaut neutre.
// Vérifie : dérivation profil→plan, conformité des transferts, conflit résidence×DR exposé,
// monotonie coût (none<warm<hot<actif-actif), invariant neutre, geoSov.

function prof(overrides: Partial<Profile> = {}): Profile {
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

const SRC = { label: "test", url: "https://egress.test", checkedAt: "2026-05-29" };
const egressPrices: ResidencyPriceTable = {
  egressVectors: [
    {
      provider: "Test",
      hostingClass: "sovereign-eu",
      sovereign: true,
      interRegionEgress: { amount: 0.01, currency: "EUR", unit: "Go", confidence: "high", source: SRC },
    },
  ],
  interSiteSecurityPerMonth: { amount: 0, currency: "EUR", unit: "mois", confidence: "low", source: null },
};
const computePrices: ComputePriceTable = {
  glue: { name: "glue", vcpu: 2, ramGb: 4, pricePerHourEur: 0.01, source: { label: "c", url: "https://compute.test", checkedAt: "2026-05-29" } },
  node: { name: "node", vcpu: 8, ramGb: 16, pricePerHourEur: 0.05, source: { label: "c", url: "https://compute.test", checkedAt: "2026-05-29" } },
};

describe("dérivation profil → topologie/plan (spec §4)", () => {
  it("défaut (zone ue, pas de residency, backup none) → primaire eu, DR none, plan neutre", () => {
    const plan = deriveResidencyPlan(prof());
    expect(plan.primaryRegion).toBe("eu");
    expect(plan.drTier).toBe("none");
    expect(plan.regions).toHaveLength(1);
    expect(plan.monthlyCost).toBe(0);
    expect(plan.setupCost).toBe(0);
    expect(plan.transfers).toHaveLength(0);
  });

  it("zone ue → région eu (mapping) ; données régulées → résidence stricte par défaut", () => {
    expect(deriveResidencyTopology(prof()).noTransfer).toBe(false); // internal + rgpd seul
    expect(deriveResidencyTopology(prof({ sensitivity: "secret" })).noTransfer).toBe(true);
    expect(deriveResidencyTopology(prof({ regulations: ["cndp"] })).noTransfer).toBe(true);
  });

  it("DR par défaut dérive de la criticité backup, relevé d'un cran si HA implicite", () => {
    expect(deriveResidencyTopology(prof({ backup: { criticality: "critical" } })).drTier).toBe("hot");
    expect(deriveResidencyTopology(prof({ backup: { criticality: "high" } })).drTier).toBe("warm");
    expect(deriveResidencyTopology(prof({ backup: { criticality: "none" } })).drTier).toBe("none");
    // latence fast + > 50 users → relève d'un cran (warm → hot)
    expect(deriveResidencyTopology(prof({ backup: { criticality: "high" }, users: 60 })).drTier).toBe("hot");
  });
});

describe("hostingClassForProfile (dérivation zone → vecteur d'egress, S-048)", () => {
  it("zones souveraines UE/Maroc → sovereign-eu ; US/autre → hyperscaler", () => {
    expect(hostingClassForProfile(prof({ zone: "ue" }))).toBe("sovereign-eu");
    expect(hostingClassForProfile(prof({ zone: "maroc" }))).toBe("sovereign-eu");
    expect(hostingClassForProfile(prof({ zone: "us" }))).toBe("hyperscaler");
    expect(hostingClassForProfile(prof({ zone: "other" }))).toBe("hyperscaler");
  });
});

describe("conformité des transferts (spec §5, DÉFCON 1)", () => {
  it("réplica cross-région (UE→US) sans résidence stricte → transfert restricted", () => {
    const plan = deriveResidencyPlan(prof({ residency: { allowedRegions: ["us"], drTier: "warm" } }));
    const f = plan.transfers.find((t) => t.to === "us");
    expect(f?.status).toBe("restricted");
    expect(f?.note).toMatch(/avis juridique/i); // disclaimer toujours présent
  });

  it("résidence stricte → réplica intra-juridiction, aucun flux transfrontière", () => {
    const plan = deriveResidencyPlan(prof({ sensitivity: "secret", residency: { drTier: "warm" } }));
    expect(plan.transfers).toHaveLength(0);
  });
});

describe("conflit résidence × DR (exposé, jamais résolu en douce — spec §5)", () => {
  it("Maroc + résidence stricte + DR → conflit détecté avec leviers", () => {
    const plan = deriveResidencyPlan(prof({ zone: "maroc", sensitivity: "secret", residency: { drTier: "hot" } }));
    expect(plan.conflict.hasConflict).toBe(true);
    expect(plan.conflict.levers.length).toBeGreaterThan(0);
  });

  it("UE (multi-région) + résidence stricte + DR → pas de conflit", () => {
    const plan = deriveResidencyPlan(prof({ sensitivity: "secret", residency: { drTier: "hot" } }));
    expect(plan.conflict.hasConflict).toBe(false);
  });
});

describe("monotonie du coût (none < warm < hot < actif-actif — spec §6)", () => {
  const base = (residency: Profile["residency"]): number =>
    deriveResidencyPlan(prof({ volume: "gt1000", residency }), egressPrices, computePrices, "MEDIUM").monthlyCost;

  it("le coût croît avec le niveau de DR", () => {
    const none = base({ drTier: "none" });
    const warm = base({ drTier: "warm" });
    const hot = base({ drTier: "hot" });
    const active = base({ activeActive: true });
    expect(none).toBe(0);
    expect(warm).toBeGreaterThan(none);
    expect(hot).toBeGreaterThan(warm);
    expect(active).toBeGreaterThan(hot);
  });
});

describe("invariant neutre + sources (DÉFCON 1)", () => {
  it("none + mono-région → coûts 0 même avec des prix non nuls injectés", () => {
    const plan = deriveResidencyPlan(prof({ residency: { drTier: "none" } }), egressPrices, computePrices, "MEDIUM");
    expect(plan.monthlyCost).toBe(0);
    expect(plan.setupCost).toBe(0);
    expect(plan.regions).toHaveLength(1);
  });

  it("un plan avec réplica porte des sources de coût (egress + compute)", () => {
    const plan = deriveResidencyPlan(prof({ volume: "gt1000", residency: { drTier: "hot" } }), egressPrices, computePrices, "MEDIUM");
    expect(plan.costSources.length).toBeGreaterThan(0);
    expect(plan.costSources.some((s) => s.url === "https://egress.test")).toBe(true);
  });
});

describe("geoSovScore (alimente la 10ᵉ dimension, S-045)", () => {
  it("est borné [0,10] ; la résidence stricte conforme score plus haut qu'un transfert restreint", () => {
    const strict = deriveResidencyPlan(prof({ sensitivity: "secret", residency: { drTier: "warm" } }));
    const restricted = deriveResidencyPlan(prof({ residency: { allowedRegions: ["us"], drTier: "warm" } }));
    for (const s of [strict.geoSovScore, restricted.geoSovScore]) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(10);
    }
    expect(strict.geoSovScore).toBeGreaterThan(restricted.geoSovScore);
  });
});
