// Feed des prix d'infra multimédia (S-017, refonte Strate).
//
// Le seed (`media-seed.ts`) porte les prix en DEVISES NATIVES. Ce module :
//  1. récupère un taux de change USD→EUR **live** (Frankfurter, adossé aux taux de référence BCE,
//     gratuit, sans clé), avec **repli** sur le taux BCE daté du seed (`SEED_USD_TO_EUR`) ;
//  2. **normalise** la table en € (devise unique) pour le moteur (`costMultimodalSizing`, S-016) ;
//  3. signale la **fraîcheur** des pages source via le client Firecrawl existant (repli seed).
//
// Toutes les fonctions sont pures ou à effets injectables (`fetchImpl`) — testabilité, jamais de
// throw côté réseau (repli systématique). La clé Firecrawl reste serveur (jamais exposée au client).

import type { GpuTier, MultimodalPriceEntry, MultimodalPriceTable } from "@/lib/engine";
import { scrapePricingMarkdown } from "./firecrawl";
import { MEDIA_PRICE_SEED, SEED_FX_SOURCE, SEED_USD_TO_EUR } from "./media-seed";

const FRANKFURTER_URL = "https://api.frankfurter.app/latest?from=USD&to=EUR";

export type FxRate = {
  /** Multiplicateur USD → EUR (1 USD = `rate` EUR). */
  rate: number;
  source: { label: string; url: string; checkedAt: string };
  /** `true` si le taux vient du feed live, `false` si repli sur le seed. */
  live: boolean;
};

function isoDate(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

function fxFallback(): FxRate {
  return { rate: SEED_USD_TO_EUR, source: { ...SEED_FX_SOURCE }, live: false };
}

export type FxDeps = { fetchImpl?: typeof fetch; now?: () => number; timeoutMs?: number };

type FrankfurterResponse = { date?: string; rates?: { EUR?: number } };

/**
 * Récupère le taux USD→EUR live (Frankfurter / BCE). Ne lève jamais : tout échec (clé absente,
 * réseau, JSON invalide, valeur aberrante) → repli sur le taux BCE daté du seed.
 */
export async function fetchUsdToEur(deps: FxDeps = {}): Promise<FxRate> {
  const doFetch = deps.fetchImpl ?? fetch;
  const nowMs = (deps.now ?? ((): number => Date.now()))();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), deps.timeoutMs ?? 10_000);

  try {
    const response = await doFetch(FRANKFURTER_URL, { signal: controller.signal });
    if (!response.ok) return fxFallback();

    const payload: FrankfurterResponse = await response.json();
    const rate = payload.rates?.EUR;
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return fxFallback();

    const checkedAt = typeof payload.date === "string" && payload.date.length > 0 ? payload.date : isoDate(nowMs);
    return {
      rate,
      source: { label: "Frankfurter (taux BCE) — USD→EUR", url: "https://www.frankfurter.app", checkedAt },
      live: true,
    };
  } catch {
    return fxFallback();
  } finally {
    clearTimeout(timeout);
  }
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

/** Convertit une entrée en € (inchangée si déjà en €), au taux fourni. Pure. */
function toEur(entry: MultimodalPriceEntry, usdToEur: number): MultimodalPriceEntry {
  if (entry.currency === "EUR") return entry;
  return { ...entry, amount: round6(entry.amount * usdToEur), currency: "EUR" };
}

/**
 * Normalise une table de prix (devises natives) en € au taux `usdToEur` fourni. Pure et
 * déterministe. Le résultat est consommable par `costMultimodalSizing` (devise unique).
 */
export function normalizeMediaPricesToEur(
  table: MultimodalPriceTable,
  usdToEur: number,
): MultimodalPriceTable {
  const c = (e: MultimodalPriceEntry): MultimodalPriceEntry => toEur(e, usdToEur);
  const gpuMonthly: Record<GpuTier, MultimodalPriceEntry> = {
    none: c(table.gpuMonthly.none),
    shared: c(table.gpuMonthly.shared),
    "dedicated-small": c(table.gpuMonthly["dedicated-small"]),
    "dedicated-large": c(table.gpuMonthly["dedicated-large"]),
  };
  return {
    gpuMonthly,
    storagePerGbMonth: c(table.storagePerGbMonth),
    multimodalEmbeddings: c(table.multimodalEmbeddings),
    api: {
      audio: { ingest: c(table.api.audio.ingest), generate: c(table.api.audio.generate) },
      video: { ingest: c(table.api.video.ingest), generate: c(table.api.video.generate) },
      images: { ingest: c(table.api.images.ingest), generate: c(table.api.images.generate) },
    },
  };
}

/** Table des prix médias en **devises natives** (source de vérité, fidèle aux sources). */
export function getMediaPrices(): MultimodalPriceTable {
  return MEDIA_PRICE_SEED;
}

/**
 * Table des prix médias **normalisée en €** pour le moteur. Taux par défaut = repli BCE daté du
 * seed ; passer un taux live (`fetchUsdToEur().rate`) pour la fraîcheur. Synchrone et pure.
 */
export function getMediaPricesEur(usdToEur: number = SEED_USD_TO_EUR): MultimodalPriceTable {
  return normalizeMediaPricesToEur(MEDIA_PRICE_SEED, usdToEur);
}

/** Table € + métadonnée de change : récupère le taux live (repli seed) puis normalise. */
export async function getMediaPricesEurLive(
  deps: FxDeps = {},
): Promise<{ table: MultimodalPriceTable; fx: FxRate }> {
  const fx = await fetchUsdToEur(deps);
  return { table: getMediaPricesEur(fx.rate), fx };
}

function allEntries(table: MultimodalPriceTable): MultimodalPriceEntry[] {
  return [
    ...Object.values(table.gpuMonthly),
    table.storagePerGbMonth,
    table.multimodalEmbeddings,
    ...Object.values(table.api).flatMap((m) => [m.ingest, m.generate]),
  ];
}

/** Pages source distinctes du seed (pour le contrôle de fraîcheur). */
export function mediaPriceSources(table: MultimodalPriceTable = MEDIA_PRICE_SEED): { label: string; url: string }[] {
  const seen = new Set<string>();
  const out: { label: string; url: string }[] = [];
  for (const entry of allEntries(table)) {
    if (entry.source !== null && !seen.has(entry.source.url)) {
      seen.add(entry.source.url);
      out.push({ label: entry.source.label, url: entry.source.url });
    }
  }
  return out;
}

export type MediaPriceFreshness = {
  label: string;
  url: string;
  status: "verified" | "unavailable";
  checkedAt: string;
};

/**
 * Contrôle la fraîcheur des pages source via Firecrawl (page joignable = `verified`, sinon
 * `unavailable`). Ne ré-extrait PAS les prix dérivés (conversion/hypothèses) : toute revue de
 * valeur est manuelle. Repli (clé absente / réseau) → `unavailable`, jamais de throw.
 */
export async function refreshMediaPriceFreshness(deps: {
  apiKey: string | undefined;
  fetchImpl?: typeof fetch;
  now?: () => number;
}): Promise<MediaPriceFreshness[]> {
  const nowMs = (deps.now ?? ((): number => Date.now()))();
  const checkedAt = isoDate(nowMs);
  return Promise.all(
    mediaPriceSources().map(async (s) => {
      const markdown = await scrapePricingMarkdown(s.url, { apiKey: deps.apiKey, fetchImpl: deps.fetchImpl });
      return { label: s.label, url: s.url, status: markdown === null ? "unavailable" : "verified", checkedAt };
    }),
  );
}
