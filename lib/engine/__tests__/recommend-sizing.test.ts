import { describe, it, expect } from "vitest";
import { costBand, recommend } from "@/lib/engine";
import type { MediaNeed, MultimodalPriceEntry, MultimodalPriceTable, Profile, Recommendation } from "@/lib/engine";

// S-018, intégration du dimensionnement multimédia dans recommend() : coûts DANS les couches
// (C4/C5/C6), GPU compté une seule fois, setupCost (backlog), verdict, costSources. Prix injectés.

function eur(amount: number): MultimodalPriceEntry {
  return {
    amount,
    currency: "EUR",
    unit: "u",
    confidence: "medium",
    source: { label: "fixture", url: `https://example.test/${amount}`, checkedAt: "2026-05-26" },
  };
}

// Table de TEST en € (valeurs rondes fictives), l'intégration avec les vrais prix est en S-017.
function makePrices(): MultimodalPriceTable {
  return {
    gpuMonthly: {
      none: eur(0),
      shared: eur(100),
      "dedicated-small": eur(500),
      "dedicated-large": eur(2000),
    },
    storagePerGbMonth: eur(1),
    multimodalEmbeddings: eur(50),
    api: {
      audio: { ingest: eur(0.01), generate: eur(0.02) },
      video: { ingest: eur(0.1), generate: eur(1) },
      images: { ingest: eur(0.005), generate: eur(0.05) },
    },
  };
}

function baseProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    activity: "pme-startup",
    continent: "europe",
    country: "union-europeenne",
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

const MEDIA: MediaNeed[] = [
  { modality: "video", mode: "sovereign", ingest: { tier: "none" }, generate: { tier: "medium" } }, // 300×5=1500 → dedicated-large
  { modality: "audio", mode: "api", ingest: { tier: "medium" }, generate: { tier: "none" }, backlog: 200 }, // 3000 min API + backlog 200
];

function layerCost(rec: Recommendation, id: number): number {
  return rec.layers.find((l) => l.id === id)?.cost ?? 0;
}

describe("recommend, défaut neutre (moteur pur, sans prix injectés)", () => {
  it("ne facture aucun coût multimédia et conserve l'invariant totalCost = baseCost + moduleCost", () => {
    const r = recommend(baseProfile({ mediaNeeds: MEDIA }));
    expect(r.totalCost).toBe(r.baseCost + r.moduleCost);
    expect(r.setupCost).toBe(0);
    expect(r.costSources).toEqual([]);
    // sizing calculé mais à coût nul (prix neutres)
    expect(r.sizing.gpu.monthlyCost).toBe(0);
    // verdict toujours rempli (descripteur i18n, S-058)
    expect(r.verdict.firmPriceTier.id).toBe("verdict.firmPriceTier");
    expect(r.layers).toHaveLength(7);
    expect(r.scores).toHaveLength(10);
  });
});

describe("recommend, prix injectés (coûts multimédias dans les couches)", () => {
  const profile = baseProfile({ mediaNeeds: MEDIA });
  const prices = makePrices();
  const neutral = recommend(profile);
  const priced = recommend(profile, prices);

  it("dimensionne C4/C5/C6 via le sizing ; le GPU est compté UNE FOIS dans C6 (pas dans C4)", () => {
    // C6 ← pool GPU (2000) + usage API (3000 × 0,01 = 30)
    expect(layerCost(priced, 6) - layerCost(neutral, 6)).toBe(2030);
    // C5 ← stockage (15 Go vidéo + 3 Go audio = 18 Go × 1 €)
    expect(layerCost(priced, 5) - layerCost(neutral, 5)).toBe(18);
    // C4 ← forfait embeddings (50) UNIQUEMENT, le GPU n'y est pas ré-imputé (anti double-comptage)
    expect(layerCost(priced, 4) - layerCost(neutral, 4)).toBe(50);
    expect(priced.sizing.gpu.tier).toBe("dedicated-large");
    expect(priced.sizing.gpu.monthlyCost).toBe(2000);
  });

  it("propage les coûts dans totalCost en conservant l'invariant", () => {
    expect(priced.totalCost).toBe(priced.baseCost + priced.moduleCost);
    // surcoût total = somme injectée dans les couches (2030 + 18 + 50)
    expect(priced.totalCost - neutral.totalCost).toBe(2098);
  });

  it("calcule le setupCost depuis le backlog (200 min audio × 0,01 €)", () => {
    expect(priced.setupCost).toBe(2);
  });

  it("remplit le verdict (descripteurs i18n : prix ferme, douleur par activité, étape suivante, bandes ±30 %)", () => {
    // Champs textuels = descripteurs Message (S-058) → on asserte l'id/les valeurs, pas la prose.
    expect(priced.verdict.firmPriceTier.id).toBe("verdict.firmPriceTier");
    // Le niveau d'offre (firmPriceTier) et le gain sont désormais paramétrés par le preset.
    expect(typeof priced.verdict.firmPriceTier.values?.preset).toBe("string");
    expect(priced.verdict.variableCostBand).toEqual(costBand(priced.totalCost));
    expect(priced.verdict.setupCostBand).toEqual(costBand(priced.setupCost));
    expect(priced.verdict.pain.id).toBe("verdict.pain");
    expect(typeof priced.verdict.pain.values?.activity).toBe("string");
    expect(priced.verdict.gain.id).toBe("verdict.gain");
    expect(priced.verdict.gain.values?.preset).toBe(priced.preset);
    expect(priced.verdict.nextStep.id).toMatch(/^verdict\.nextStep\.(withSetup|default|regime|setupRegime)$/);
  });

  it("trace les sources des coûts mobilisés (dédupliquées, URL + date)", () => {
    expect(priced.costSources.length).toBeGreaterThan(0);
    for (const s of priced.costSources) {
      expect(s.url).toMatch(/^https:\/\//);
      expect(s.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    const urls = priced.costSources.map((s) => s.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("reste déterministe", () => {
    expect(JSON.stringify(recommend(profile, prices))).toBe(JSON.stringify(recommend(profile, prices)));
  });
});

// Correctif « verdict trop pauvre » : risk/gain/firmPriceTier/nextStep + constraints DOIVENT varier
// selon le profil (preset, sensibilité, régimes, souveraineté), pas rester identiques.
describe("verdict — différenciation selon le profil", () => {
  const light = recommend(
    baseProfile({
      activity: "freelance",
      regulations: ["none"],
      sensitivity: "public",
      budget: "lt50",
      audit: false,
      bitemporal: false,
    }),
  );
  const hard = recommend(
    baseProfile({
      activity: "cabinet-regule",
      regulations: ["rgpd", "secret-pro"],
      sensitivity: "secret",
      audit: true,
      bitemporal: true,
      techLevel: "devops",
      budget: "gt2k",
      volume: "gt1000",
      users: 1200,
    }),
  );

  it("le gain et le niveau d'offre suivent le preset (différents entre deux profils opposés)", () => {
    expect(light.verdict.gain.values?.preset).toBe(light.preset);
    expect(hard.verdict.gain.values?.preset).toBe(hard.preset);
    expect(light.preset).not.toBe(hard.preset);
    expect(light.verdict.firmPriceTier.values?.preset).not.toBe(hard.verdict.firmPriceTier.values?.preset);
  });

  it("le risque saillant reflète la sensibilité/les régimes (profil secret → risque « secret »)", () => {
    // Profil secret + secret-pro, cohérent (devops/HARD) → pas d'incohérence détectée → risque structurel « secret ».
    expect(hard.verdict.risk.id).toBe("verdict.risk.secret");
    // Profil public sans régime ni incohérence → risque générique de souveraineté (pas le risque « secret »).
    expect(light.verdict.risk.id).not.toBe("verdict.risk.secret");
  });

  it("les contraintes surfacent preset + régimes + sensibilité + géo", () => {
    const hardIds = hard.verdict.constraints.map((c) => c.id);
    expect(hardIds).toContain("verdict.constraint.preset");
    expect(hardIds).toContain("verdict.constraint.zone");
    // Deux régimes cochés (rgpd + secret-pro) → deux contraintes de régime.
    expect(hard.verdict.constraints.filter((c) => c.id === "verdict.constraint.regime")).toHaveLength(2);
    // Sensibilité « secret » → contrainte de sensibilité présente (absente pour le profil public).
    expect(hardIds).toContain("verdict.constraint.sensitivity");
    expect(light.verdict.constraints.map((c) => c.id)).not.toContain("verdict.constraint.sensitivity");
  });

  it("l'étape suivante distingue la présence d'un régime de conformité", () => {
    // Profil régulé (sans backlog média) → étape « regime » ; profil public sans régime → « default ».
    expect(hard.verdict.nextStep.id).toBe("verdict.nextStep.regime");
    expect(light.verdict.nextStep.id).toBe("verdict.nextStep.default");
  });
});
