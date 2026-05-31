// Orchestration du price feed (F4) : pour chaque source vendor, scrape Firecrawl →
// extrait les figures → détecte une variation vs le snapshot de référence → produit
// une observation datée et sourcée. Repli sur le seed si Firecrawl est indisponible.

import type { Confidence } from "@/components/ui/StatusDot";
import { baselineForLayer, type PriceBaseline } from "./baseline";
import { TtlCache } from "./cache";
import { detectVariation, extractMoneyTokens } from "./extract";
import { LLM_FRESHNESS_TOKEN_USD, type LlmTokenUsd } from "./llm-token-seed";
import { scrapePricingMarkdown } from "./scraper";
import { LAYER_PRICING, pricingForLayer } from "./sources";

export type PriceFeedStatus = "verified" | "changed" | "unavailable";

export type PriceObservation = {
  layerId: number;
  label: string;
  url: string;
  /** Date du dernier relevé fiable (YYYY-MM-DD). */
  checkedAt: string;
  status: PriceFeedStatus;
  confidence: Confidence;
  figureCount: number;
  /** Échantillon de figures observées (brut), pour affichage. */
  sampleFigures: string[];
  note: string;
  /**
   * Prix tokens per-1M (entrée/sortie, USD) pour les couches LLM (S-074). Présent ⇒ l'UI affiche
   * « entrée $X/1M · sortie $Y/1M » au lieu de l'empreinte brute scrappée. Absent pour les vendeurs
   * d'infra (stockage/compute/DB), inchangés.
   */
  tokenPricing?: LlmTokenUsd;
};

// Couches dont la « figure » est un prix tokens (S-074) : leur empreinte brute (« $0.01 · $0.02 … »)
// est trompeuse → on affiche le per-1M entrée/sortie sourcé du seed. Couche 1 = Anthropic, couche 4 = Mistral.
const LLM_TOKEN_LAYER: Record<number, keyof typeof LLM_FRESHNESS_TOKEN_USD> = { 1: "anthropic", 4: "mistral" };

/**
 * Pour une couche LLM, substitue à l'empreinte brute le prix tokens per-1M sourcé (S-074). Les vendeurs
 * d'infra sont renvoyés inchangés. La fraîcheur (statut/date scrappés) reste celle de l'observation.
 */
function withLlmTokenPricing(obs: PriceObservation): PriceObservation {
  const vendor = LLM_TOKEN_LAYER[obs.layerId];
  if (vendor === undefined) return obs;
  return { ...obs, sampleFigures: [], tokenPricing: LLM_FRESHNESS_TOKEN_USD[vendor] };
}

export type FeedSource = { layerId: number; label: string; url: string };

/** Sources vendor à surveiller, dérivées du seed (couches dotées d'une URL). */
export function feedSources(): FeedSource[] {
  const out: FeedSource[] = [];
  for (const [key, pricing] of Object.entries(LAYER_PRICING)) {
    if (pricing.source !== null) {
      out.push({ layerId: Number(key), label: pricing.source.label, url: pricing.source.url });
    }
  }
  return out.sort((a, b) => a.layerId - b.layerId);
}

function isoDate(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/**
 * Construit l'observation d'une source à partir du markdown scrapé (ou `null` si indisponible) et de
 * son snapshot de référence. Fonction pure. Les couches LLM voient leur empreinte brute remplacée par
 * le prix tokens per-1M sourcé (S-074, `withLlmTokenPricing`).
 */
export function buildObservation(
  source: FeedSource,
  markdown: string | null,
  baseline: PriceBaseline,
  nowMs: number,
): PriceObservation {
  return withLlmTokenPricing(buildRawObservation(source, markdown, baseline, nowMs));
}

function buildRawObservation(
  source: FeedSource,
  markdown: string | null,
  baseline: PriceBaseline,
  nowMs: number,
): PriceObservation {
  const base = { layerId: source.layerId, label: source.label, url: source.url };

  if (markdown === null) {
    const seed = pricingForLayer(source.layerId);
    return {
      ...base,
      checkedAt: seed.source?.checkedAt ?? baseline.capturedAt,
      status: "unavailable",
      confidence: seed.confidence,
      figureCount: 0,
      sampleFigures: [],
      note: "Indisponible à l'instant, repli sur la dernière vérification enregistrée.",
    };
  }

  const figures = extractMoneyTokens(markdown);
  const checkedAt = isoDate(nowMs);

  if (figures.length === 0) {
    return {
      ...base,
      checkedAt,
      status: "verified",
      confidence: "medium",
      figureCount: 0,
      sampleFigures: [],
      note: "Tarification à l'usage (aucune figure fixe), page joignable, à vérifier manuellement.",
    };
  }

  const { changed } = detectVariation(baseline.fingerprint, figures);
  const sampleFigures = figures.slice(0, 4).map((t) => t.raw);

  if (changed) {
    return {
      ...base,
      checkedAt,
      status: "changed",
      confidence: "low",
      figureCount: figures.length,
      sampleFigures,
      note: `Figures différentes du snapshot du ${baseline.capturedAt}, revérifier la source avant décision.`,
    };
  }

  return {
    ...base,
    checkedAt,
    status: "verified",
    confidence: "high",
    figureCount: figures.length,
    sampleFigures,
    note:
      baseline.fingerprint === null
        ? "Page vérifiée à l'instant (référence établie)."
        : `Conforme au snapshot du ${baseline.capturedAt}.`,
  };
}

export type RefreshDeps = {
  apiKey: string | undefined;
  now?: () => number;
  fetchImpl?: typeof fetch;
  cache?: TtlCache<PriceObservation>;
};

// Cache partagé : 6 h. Volatile par instance (persistance durable = S-012).
const sharedCache = new TtlCache<PriceObservation>(6 * 60 * 60 * 1000);

/** Rafraîchit toutes les sources (en parallèle), cache + repli compris. */
export async function refreshAllPricing(deps: RefreshDeps): Promise<PriceObservation[]> {
  const nowFn = deps.now ?? ((): number => Date.now());
  const cache = deps.cache ?? sharedCache;
  const nowMs = nowFn();

  return Promise.all(
    feedSources().map(async (source) => {
      const key = String(source.layerId);
      const cached = cache.get(key, nowMs);
      if (cached !== null) return cached;

      const markdown = await scrapePricingMarkdown(source.url, {
        apiKey: deps.apiKey,
        fetchImpl: deps.fetchImpl,
      });
      const observation = buildObservation(source, markdown, baselineForLayer(source.layerId), nowMs);
      // On ne met pas en cache les indispos : on retente au prochain appel.
      if (observation.status !== "unavailable") cache.set(key, observation, nowMs);
      return observation;
    }),
  );
}
