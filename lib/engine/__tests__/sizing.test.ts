import { describe, it, expect } from "vitest";
import {
  costMultimodalSizing,
  type MultimodalPriceEntry,
  type MultimodalPriceTable,
} from "@/lib/engine";
import type { MediaNeed, MMMode, MMTier, Modality, Profile, Sizing } from "@/lib/engine";

// S-016, tests table-driven du dimensionnement multimédia (spec §5.6).
// Vérifie : GPU compté une seule fois (anti double-comptage C4/C6), mode api hors GPU souverain,
// générer > mémoriser sur le GPU, monotonie (intensive ≥ medium ≥ light), stockage croissant,
// mediaNeeds vide → neutre, présence d'une source sur chaque prix utilisé. Prix INJECTÉS (DÉFCON 1).

// Table de TEST déjà normalisée en € (devise unique), la conversion native→€ est testée en S-017.
function entry(amount: number, unit: string): MultimodalPriceEntry {
  return {
    amount,
    currency: "EUR",
    unit,
    confidence: "medium",
    source: { label: "fixture de test", url: "https://example.test/pricing", checkedAt: "2026-05-26" },
  };
}

// Table de prix de TEST (valeurs fictives, sources factices), la table réelle sourcée arrive en S-017.
// Contrainte respectée : `gpuMonthly` est monotone croissant en palier (none ≤ shared ≤ small ≤ large).
function makePrices(): MultimodalPriceTable {
  return {
    gpuMonthly: {
      none: entry(0, "€/mois"),
      shared: entry(80, "€/mois"),
      "dedicated-small": entry(400, "€/mois"),
      "dedicated-large": entry(1200, "€/mois"),
    },
    storagePerGbMonth: entry(0.02, "€/Go/mois"),
    multimodalEmbeddings: entry(60, "€/mois"),
    api: {
      audio: { ingest: entry(0.01, "€/min"), generate: entry(0.05, "€/min") },
      video: { ingest: entry(0.1, "€/min"), generate: entry(2, "€/min") },
      images: { ingest: entry(0.002, "€/image"), generate: entry(0.04, "€/image") },
    },
  };
}

function baseProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    activity: "freelance",
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

/** Construit un besoin avec un seul volet actif (l'autre à `none`). */
function singleVolet(
  modality: Modality,
  mode: MMMode,
  volet: "ingest" | "generate",
  tier: MMTier,
  volume?: number,
): MediaNeed {
  const active = volume === undefined ? { tier } : { tier, volume };
  const idle = { tier: "none" as MMTier };
  return volet === "ingest"
    ? { modality, mode, ingest: active, generate: idle }
    : { modality, mode, ingest: idle, generate: active };
}

function sizeWith(needs: MediaNeed[] | undefined): Sizing {
  return costMultimodalSizing(baseProfile({ mediaNeeds: needs }), makePrices());
}

const MODALITIES: Modality[] = ["audio", "video", "images"];
const MODES: MMMode[] = ["sovereign", "api"];
const VOLETS = ["ingest", "generate"] as const;
const ASCENDING: MMTier[] = ["none", "light", "medium", "intensive"];

describe("costMultimodalSizing, cas neutre", () => {
  it("mediaNeeds absent → dimensionnement neutre", () => {
    const s = sizeWith(undefined);
    expect(s.gpu.tier).toBe("none");
    expect(s.gpu.monthlyCost).toBe(0);
    expect(s.storageGb).toBe(0);
    expect(s.embeddingsMultimodal).toBe(false);
    expect(s.workloads).toHaveLength(0);
  });

  it("mediaNeeds vide → dimensionnement neutre", () => {
    expect(sizeWith([])).toEqual(sizeWith(undefined));
  });

  it("besoin inactif (ingest none + generate none) filtré → neutre", () => {
    const idle: MediaNeed = { modality: "video", mode: "sovereign", ingest: { tier: "none" }, generate: { tier: "none" } };
    expect(sizeWith([idle])).toEqual(sizeWith(undefined));
  });
});

describe("costMultimodalSizing, GPU mutualisé compté une seule fois", () => {
  it("trois charges souveraines → UN seul pool dimensionné sur la charge totale (pas la somme de 3 GPU)", () => {
    const needs: MediaNeed[] = [
      singleVolet("audio", "sovereign", "ingest", "light"), // 600 × 0,05 = 30
      singleVolet("images", "sovereign", "ingest", "light"), // 1000 × 0,02 = 20
      singleVolet("video", "sovereign", "ingest", "light"), // 60 × 0,5 = 30
    ];
    // Chaque charge isolée tombe en `shared` (≤ 50). Cumulée = 80 > 50 → un seul `dedicated-small`.
    const s = sizeWith(needs);
    expect(s.gpu.tier).toBe("dedicated-small");
    expect(s.gpu.monthlyCost).toBe(400); // le prix d'UN palier, pas 3 × 80
    expect(s.gpu.monthlyCost).not.toBe(240); // ≠ somme de trois pools `shared`
    expect(s.workloads.every((w) => w.monthlyCost === 0)).toBe(true); // souverain → coût absorbé par le pool
  });

  it("le coût GPU correspond toujours exactement au prix du palier retenu", () => {
    const prices = makePrices();
    const s = costMultimodalSizing(
      baseProfile({ mediaNeeds: [singleVolet("video", "sovereign", "generate", "medium")] }),
      prices,
    );
    expect(s.gpu.monthlyCost).toBe(prices.gpuMonthly[s.gpu.tier].amount);
  });
});

describe("costMultimodalSizing, mode api ne consomme pas le GPU souverain", () => {
  it("charge API → GPU neutre, coût porté par la ligne", () => {
    const s = sizeWith([singleVolet("audio", "api", "ingest", "intensive")]); // 15000 min
    expect(s.gpu.tier).toBe("none");
    expect(s.gpu.monthlyCost).toBe(0);
    expect(s.workloads).toHaveLength(1);
    const w = s.workloads[0];
    expect(w?.mode).toBe("api");
    expect(w?.monthlyCost).toBe(150); // 15000 × 0,01
    expect(w?.contributesTo).toEqual(["C4", "C5", "C6"]);
  });

  it("mix souverain + api : le souverain dimensionne le GPU, l'api facture à l'usage", () => {
    const s = sizeWith([
      singleVolet("video", "sovereign", "generate", "medium"), // GPU
      singleVolet("audio", "api", "ingest", "medium"), // 3000 × 0,01 = 30 €
    ]);
    expect(s.gpu.tier).toBe("dedicated-large"); // 300 × 5 = 1500 > 800
    const apiLine = s.workloads.find((w) => w.mode === "api");
    const sovLine = s.workloads.find((w) => w.mode === "sovereign");
    expect(apiLine?.monthlyCost).toBe(30);
    expect(sovLine?.monthlyCost).toBe(0);
  });
});

describe("costMultimodalSizing, générer pèse plus que mémoriser (GPU)", () => {
  it("génération > ingestion à palier égal sur la charge souveraine", () => {
    const ingest = sizeWith([singleVolet("video", "sovereign", "ingest", "medium")]); // 300 × 0,5 = 150
    const generate = sizeWith([singleVolet("video", "sovereign", "generate", "medium")]); // 300 × 5 = 1500
    expect(generate.gpu.monthlyCost).toBeGreaterThan(ingest.gpu.monthlyCost);
    expect(ingest.gpu.tier).toBe("dedicated-small");
    expect(generate.gpu.tier).toBe("dedicated-large");
  });
});

describe("costMultimodalSizing, monotonie (table-driven)", () => {
  function metric(mode: MMMode, s: Sizing): number {
    return mode === "sovereign" ? s.gpu.monthlyCost : s.workloads.reduce((sum, w) => sum + w.monthlyCost, 0);
  }

  for (const modality of MODALITIES) {
    for (const mode of MODES) {
      for (const volet of VOLETS) {
        it(`coût non décroissant : ${modality} / ${mode} / ${volet} (light ≤ medium ≤ intensive)`, () => {
          let prevCost = -1;
          let prevStorage = -1;
          for (const tier of ASCENDING) {
            const s = sizeWith([singleVolet(modality, mode, volet, tier)]);
            const cost = metric(mode, s);
            expect(cost).toBeGreaterThanOrEqual(prevCost);
            expect(s.storageGb).toBeGreaterThanOrEqual(prevStorage);
            prevCost = cost;
            prevStorage = s.storageGb;
          }
        });
      }
    }
  }
});

describe("costMultimodalSizing, stockage", () => {
  it("croît avec le volume déclaré", () => {
    const small = sizeWith([singleVolet("video", "sovereign", "ingest", "light", 100)]); // 100 × 0,05 = 5 Go
    const large = sizeWith([singleVolet("video", "sovereign", "ingest", "light", 1000)]); // 1000 × 0,05 = 50 Go
    expect(small.storageGb).toBe(5);
    expect(large.storageGb).toBe(50);
    expect(large.storageGb).toBeGreaterThan(small.storageGb);
  });

  it("le volume override remplace la quantité dérivée du palier (coût API)", () => {
    const s = sizeWith([singleVolet("audio", "api", "ingest", "light", 1000)]); // override → 1000, pas 600
    expect(s.workloads[0]?.monthlyCost).toBe(10); // 1000 × 0,01
  });
});

describe("costMultimodalSizing, traçabilité & invariants", () => {
  it("embeddingsMultimodal vrai dès qu'un besoin médias est actif, faux sinon", () => {
    expect(sizeWith([singleVolet("images", "sovereign", "ingest", "light")]).embeddingsMultimodal).toBe(true);
    expect(sizeWith([]).embeddingsMultimodal).toBe(false);
  });

  it("un volet actif = une ligne de charge ; un volet none = aucune ligne", () => {
    const need: MediaNeed = { modality: "video", mode: "sovereign", ingest: { tier: "medium" }, generate: { tier: "none" } };
    const s = sizeWith([need]);
    expect(s.workloads).toHaveLength(1);
    expect(s.workloads[0]?.source).toBe("ingest");
  });

  it("ingest alimente C4/C5/C6 ; generate alimente C5/C6 (pas C4)", () => {
    const ingest = sizeWith([singleVolet("audio", "api", "ingest", "light")]);
    const generate = sizeWith([singleVolet("audio", "api", "generate", "light")]);
    expect(ingest.workloads[0]?.contributesTo).toContain("C4");
    expect(generate.workloads[0]?.contributesTo).not.toContain("C4");
    expect(generate.workloads[0]?.contributesTo).toEqual(["C5", "C6"]);
  });

  it("chaque prix utilisé porte une source datée + une confiance (DÉFCON 1, contrat S-017)", () => {
    const prices = makePrices();
    const s = costMultimodalSizing(
      baseProfile({
        mediaNeeds: [
          singleVolet("video", "sovereign", "generate", "medium"),
          singleVolet("audio", "api", "ingest", "medium"),
        ],
      }),
      prices,
    );
    // Pool GPU retenu
    const gpuEntry = prices.gpuMonthly[s.gpu.tier];
    expect(gpuEntry.source).not.toBeNull();
    expect(gpuEntry.confidence).toBeDefined();
    // Chaque ligne API facturée trace son prix unitaire sourcé
    for (const w of s.workloads.filter((x) => x.mode === "api")) {
      const apiEntry = prices.api[w.modality][w.source];
      expect(apiEntry.source).not.toBeNull();
      expect(apiEntry.confidence).toBeDefined();
    }
  });

  it("est déterministe", () => {
    const needs: MediaNeed[] = [
      singleVolet("video", "sovereign", "generate", "intensive"),
      singleVolet("audio", "api", "ingest", "medium"),
    ];
    expect(JSON.stringify(sizeWith(needs))).toBe(JSON.stringify(sizeWith(needs)));
  });
});
