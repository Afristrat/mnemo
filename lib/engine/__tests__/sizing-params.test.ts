import { describe, it, expect } from "vitest";
import {
  BASELINE_SIZING_PARAMS,
  costMultimodalSizing,
  deriveSizingParams,
  isValidFactor,
  type MultimodalPriceEntry,
  type MultimodalPriceTable,
} from "@/lib/engine";
import type { MediaNeed, Profile } from "@/lib/engine";
import { seedCatalog, type Catalog, type ComponentSizingParams, type SlotId } from "@/lib/catalog";

// S-056 (option A) : les heuristiques de dimensionnement deviennent des PARAMÈTRES injectables ; un
// composant sourcé du catalogue (C6 GPU, C5 stockage) peut les moduler, garde-fou de bornes (aberrant
// → repli baseline). Le LLM ne calcule jamais ; le moteur reste pur + déterministe.

function entry(amount: number): MultimodalPriceEntry {
  return {
    amount,
    currency: "EUR",
    unit: "€/mois",
    confidence: "medium",
    source: { label: "fixture", url: "https://example.test/p", checkedAt: "2026-05-28" },
  };
}

const PRICES: MultimodalPriceTable = {
  gpuMonthly: {
    none: entry(0),
    shared: entry(80),
    "dedicated-small": entry(400),
    "dedicated-large": entry(1200),
  },
  storagePerGbMonth: entry(0.02),
  multimodalEmbeddings: entry(60),
  api: {
    audio: { ingest: entry(0.01), generate: entry(0.05) },
    video: { ingest: entry(0.1), generate: entry(2) },
    images: { ingest: entry(0.002), generate: entry(0.04) },
  },
};

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

// Catalogue seed (sans facteurs) avec un facteur injecté sur un slot — simule un candidat sourcé live.
function catalogWith(slot: SlotId, sizingParams: ComponentSizingParams): Catalog {
  const cat = seedCatalog("MEDIUM", baseProfile());
  const target = cat.slots[slot];
  return {
    ...cat,
    slots: { ...cat.slots, [slot]: { ...target, recommended: { ...target.recommended, sizingParams } } },
  };
}

// Vidéo en génération souveraine (palier medium) : charge baseline = 300 × 5 = 1500 → dedicated-large.
const VIDEO_GEN: MediaNeed = {
  modality: "video",
  mode: "sovereign",
  ingest: { tier: "none" },
  generate: { tier: "medium" },
};

describe("isValidFactor (garde-fou de bornes)", () => {
  it("accepte un facteur fini dans [0.25, 4], rejette le reste", () => {
    expect(isValidFactor(0.5)).toBe(true);
    expect(isValidFactor(1)).toBe(true);
    expect(isValidFactor(4)).toBe(true);
    expect(isValidFactor(0.25)).toBe(true);
    expect(isValidFactor(0.1)).toBe(false);
    expect(isValidFactor(5)).toBe(false);
    expect(isValidFactor(Number.NaN)).toBe(false);
    expect(isValidFactor(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidFactor(undefined)).toBe(false);
  });
});

describe("deriveSizingParams", () => {
  it("pas de catalogue → baseline, aucun facteur appliqué", () => {
    const d = deriveSizingParams(undefined);
    expect(d.params).toBe(BASELINE_SIZING_PARAMS);
    expect(d.applied).toHaveLength(0);
  });

  it("catalogue seed (sans facteur) → baseline inchangée", () => {
    const d = deriveSizingParams(seedCatalog("MEDIUM", baseProfile()));
    expect(d.params.gpuLoadPerUnit).toEqual(BASELINE_SIZING_PARAMS.gpuLoadPerUnit);
    expect(d.applied).toHaveLength(0);
  });

  it("gpuLoadFactor valide (C6) → charge GPU mise à l'échelle + source tracée", () => {
    const d = deriveSizingParams(catalogWith("c6", { gpuLoadFactor: 0.5 }));
    expect(d.params.gpuLoadPerUnit.video.generate).toBe(BASELINE_SIZING_PARAMS.gpuLoadPerUnit.video.generate * 0.5);
    expect(d.applied).toHaveLength(1);
    expect(d.applied[0]?.kind).toBe("gpuLoad");
    expect(d.applied[0]?.factor).toBe(0.5);
    expect(d.applied[0]?.source.url.length).toBeGreaterThan(0);
  });

  it("storageFactor valide (C5) → empreinte stockage mise à l'échelle", () => {
    const d = deriveSizingParams(catalogWith("c5", { storageFactor: 0.5 }));
    expect(d.params.storageGbPerUnit.video).toBe(BASELINE_SIZING_PARAMS.storageGbPerUnit.video * 0.5);
    expect(d.applied[0]?.kind).toBe("storage");
  });

  it("facteur ABERRANT (hors bornes) → ignoré, repli baseline (DÉFCON 1)", () => {
    const d = deriveSizingParams(catalogWith("c6", { gpuLoadFactor: 100 }));
    expect(d.params.gpuLoadPerUnit).toEqual(BASELINE_SIZING_PARAMS.gpuLoadPerUnit);
    expect(d.applied).toHaveLength(0);
  });

  it("facteur = 1 (neutre) → pas d'effet, aucune source ajoutée", () => {
    const d = deriveSizingParams(catalogWith("c6", { gpuLoadFactor: 1 }));
    expect(d.applied).toHaveLength(0);
  });
});

describe("effet d'un composant plus efficient sur le dimensionnement (le gain est reflété)", () => {
  it("gpuLoadFactor 0.5 → palier GPU plus petit → coût GPU inférieur", () => {
    const profile = baseProfile({ mediaNeeds: [VIDEO_GEN] });
    const baseSizing = costMultimodalSizing(profile, PRICES); // baseline
    const efficient = deriveSizingParams(catalogWith("c6", { gpuLoadFactor: 0.5 }));
    const sizing = costMultimodalSizing(profile, PRICES, efficient.params);

    expect(baseSizing.gpu.tier).toBe("dedicated-large"); // 1500 > 800
    expect(sizing.gpu.tier).toBe("dedicated-small"); // 750 ≤ 800
    expect(sizing.gpu.monthlyCost).toBeLessThan(baseSizing.gpu.monthlyCost);
  });

  it("storageFactor 0.5 → stockage médias divisé par deux", () => {
    const profile = baseProfile({
      mediaNeeds: [{ modality: "video", mode: "sovereign", ingest: { tier: "none" }, generate: { tier: "medium", volume: 1000 } }],
    });
    const baseSizing = costMultimodalSizing(profile, PRICES);
    const compressed = deriveSizingParams(catalogWith("c5", { storageFactor: 0.5 }));
    const sizing = costMultimodalSizing(profile, PRICES, compressed.params);
    expect(sizing.storageGb).toBe(Math.round(baseSizing.storageGb * 0.5));
  });

  it("snapshot rejouable : mêmes entrées → même sortie (déterminisme préservé)", () => {
    const catalog = catalogWith("c6", { gpuLoadFactor: 0.75 });
    const a = deriveSizingParams(catalog);
    const b = deriveSizingParams(catalog);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
