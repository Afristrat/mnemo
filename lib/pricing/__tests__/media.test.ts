import { describe, it, expect, vi } from "vitest";
import { costMultimodalSizing } from "@/lib/engine";
import type { MultimodalPriceEntry, MultimodalPriceTable, Profile } from "@/lib/engine";
import { MEDIA_PRICE_SEED, SEED_USD_TO_EUR } from "@/lib/pricing/media-seed";
import {
  fetchUsdToEur,
  getMediaPrices,
  getMediaPricesEur,
  mediaPriceSources,
  normalizeMediaPricesToEur,
} from "@/lib/pricing/media-feed";
// refreshMediaPriceFreshness vit désormais dans le module server-only media-freshness.ts (S-078).
import { refreshMediaPriceFreshness } from "@/lib/pricing/media-freshness";

// S-017, pricing médias sourcé (DÉFCON 1). Vérifie : devises natives + sources sur chaque coût,
// normalisation FX en €, repli du taux de change, intégration au dimensionnement S-016.

function allEntries(t: MultimodalPriceTable): MultimodalPriceEntry[] {
  return [
    ...Object.values(t.gpuMonthly),
    t.storagePerGbMonth,
    t.multimodalEmbeddings,
    ...Object.values(t.api).flatMap((m) => [m.ingest, m.generate]),
  ];
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

function fxResponse(eur: number): Response {
  return { ok: true, json: async () => ({ date: "2026-05-26", rates: { EUR: eur } }) } as unknown as Response;
}

describe("seed médias, DÉFCON 1 (sources sur chaque coût)", () => {
  it("chaque prix non nul porte une source datée (URL + checkedAt) et une confiance", () => {
    for (const e of allEntries(MEDIA_PRICE_SEED)) {
      expect(["high", "medium", "low"]).toContain(e.confidence);
      if (e.amount > 0) {
        expect(e.source).not.toBeNull();
        expect(e.source?.url).toMatch(/^https:\/\//);
        expect(e.source?.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("toute entrée à faible confiance est explicitement libellée « estimation / à confirmer »", () => {
    for (const e of allEntries(MEDIA_PRICE_SEED)) {
      if (e.confidence === "low") {
        expect(e.note ?? "").toMatch(/estimation|à confirmer/i);
      }
    }
  });

  it("conserve les devises natives (souverain € ; API tierces $)", () => {
    expect(MEDIA_PRICE_SEED.gpuMonthly["dedicated-large"].currency).toBe("EUR");
    expect(MEDIA_PRICE_SEED.storagePerGbMonth.currency).toBe("EUR");
    expect(MEDIA_PRICE_SEED.api.audio.ingest.currency).toBe("USD");
    expect(MEDIA_PRICE_SEED.api.images.generate.currency).toBe("USD");
  });

  it("getMediaPrices() renvoie le seed natif", () => {
    expect(getMediaPrices()).toBe(MEDIA_PRICE_SEED);
  });
});

describe("normalisation FX → €", () => {
  it("convertit les montants USD au taux fourni et laisse les € inchangés", () => {
    const eur = normalizeMediaPricesToEur(MEDIA_PRICE_SEED, 0.9);
    // USD → €
    expect(eur.api.audio.ingest.currency).toBe("EUR");
    expect(eur.api.audio.ingest.amount).toBeCloseTo(0.006 * 0.9, 6);
    expect(eur.api.images.generate.amount).toBeCloseTo(0.042 * 0.9, 6);
    // € inchangé
    expect(eur.gpuMonthly["dedicated-large"].amount).toBe(MEDIA_PRICE_SEED.gpuMonthly["dedicated-large"].amount);
    expect(eur.storagePerGbMonth.amount).toBe(MEDIA_PRICE_SEED.storagePerGbMonth.amount);
  });

  it("toutes les entrées normalisées sont en € et conservent leur source", () => {
    const eur = normalizeMediaPricesToEur(MEDIA_PRICE_SEED, SEED_USD_TO_EUR);
    for (const e of allEntries(eur)) {
      expect(e.currency).toBe("EUR");
      if (e.amount > 0) expect(e.source).not.toBeNull();
    }
  });

  it("le pool GPU € reste monotone croissant en palier (requis par le dimensionnement)", () => {
    const g = getMediaPricesEur().gpuMonthly;
    expect(g.none.amount).toBeLessThanOrEqual(g.shared.amount);
    expect(g.shared.amount).toBeLessThanOrEqual(g["dedicated-small"].amount);
    expect(g["dedicated-small"].amount).toBeLessThanOrEqual(g["dedicated-large"].amount);
  });
});

describe("taux de change (live + repli)", () => {
  it("utilise le taux live quand le feed répond", async () => {
    const fetchImpl = vi.fn(async () => fxResponse(0.91));
    const fx = await fetchUsdToEur({ fetchImpl });
    expect(fx.rate).toBe(0.91);
    expect(fx.live).toBe(true);
  });

  it("se replie sur le taux BCE daté du seed en cas d'échec réseau", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network");
    });
    const fx = await fetchUsdToEur({ fetchImpl });
    expect(fx.rate).toBe(SEED_USD_TO_EUR);
    expect(fx.live).toBe(false);
    expect(fx.source.url).toContain("ecb.europa.eu");
  });

  it("se replie si la valeur de taux est aberrante", async () => {
    const bad = vi.fn(async () => ({ ok: true, json: async () => ({ rates: { EUR: 0 } }) }) as unknown as Response);
    const fx = await fetchUsdToEur({ fetchImpl: bad });
    expect(fx.rate).toBe(SEED_USD_TO_EUR);
    expect(fx.live).toBe(false);
  });
});

describe("intégration au dimensionnement (S-016)", () => {
  it("alimente costMultimodalSizing : GPU souverain sourcé + coût API converti en €", () => {
    const prices = getMediaPricesEur(); // repli BCE daté
    const profile = baseProfile({
      mediaNeeds: [
        { modality: "video", mode: "sovereign", ingest: { tier: "none" }, generate: { tier: "medium" } },
        { modality: "audio", mode: "api", ingest: { tier: "medium" }, generate: { tier: "none" } },
      ],
    });
    const sizing = costMultimodalSizing(profile, prices);
    // Génération vidéo souveraine medium → 300 × 5 = 1500 > 800 → dedicated-large
    expect(sizing.gpu.tier).toBe("dedicated-large");
    expect(sizing.gpu.monthlyCost).toBe(MEDIA_PRICE_SEED.gpuMonthly["dedicated-large"].amount);
    // Transcription API audio medium → 3000 min × (0,006 $ × taux €)
    const apiLine = sizing.workloads.find((w) => w.mode === "api");
    const expected = Math.round(3000 * 0.006 * SEED_USD_TO_EUR);
    expect(apiLine?.monthlyCost).toBe(expected);
  });
});

describe("fraîcheur des sources (feed Firecrawl, repli seed)", () => {
  it("liste des pages source distinctes (dédupliquées)", () => {
    const urls = mediaPriceSources().map((s) => s.url);
    expect(urls.length).toBeGreaterThan(0);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("repli (unavailable) quand le scrape échoue, sans jamais lever", async () => {
    // S-070 : le backend (Crawl4AI) ne requiert pas de clé ; le repli vient d'un échec d'extraction.
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500 }) as unknown as Response);
    const fresh = await refreshMediaPriceFreshness({ apiKey: undefined, fetchImpl, now: () => 0 });
    expect(fresh.length).toBe(mediaPriceSources().length);
    expect(fresh.every((f) => f.status === "unavailable")).toBe(true);
  });
});
