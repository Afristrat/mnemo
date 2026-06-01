// Veille des régimes : assemblage serveur (SearXNG/Crawl4AI + LiteLLM) + fusion seed∪live + cache TTL
// (S-077, tranche 3 ; jumeau de `lib/legal/live-feed`). `regime-discovery.ts` est PUR (I/O injectée) ;
// ce module branche l'I/O RÉELLE (recherche web `searchWeb` + LLM `callLLM`) et FUSIONNE le résultat
// avec le seed daté (`regime-seed`). Doctrine conservatrice sur le DROIT (S-062) : le seed reste la
// RÉFÉRENCE ; la veille n'AJOUTE que des régimes non présents dans le seed (confiance `low`, à confirmer).
// Les clés restent SERVEUR ; `now`/I/O/cache injectables (tests sans réseau).

import { callLLM, type LlmMessage, type LlmResult } from "@/lib/llm";
import { searchWeb, type WebSearchResult } from "@/lib/pricing/scraper";
import { TtlCache } from "@/lib/pricing/cache";
import { discoverRegimesForCountries, type RegimeDiscoverDeps } from "./regime-discovery";
import { regimesSeedForCountries, type RegimeSuggestion } from "./regime-seed";

/** TTL : un régime évolue lentement (mois/années) ; on rafraîchit au plus une fois / 6 h. */
const REGIME_TTL_MS = 6 * 60 * 60 * 1000;

/** Provenance globale du jeu de régimes (comme le catalogue) : seed pur / live pur / mélange. */
export type RegimeFeedSource = "seed" | "live" | "mixed";

export type RegimeFeed = {
  regimes: RegimeSuggestion[];
  source: RegimeFeedSource;
  /** Date de génération (ISO court). */
  generatedAt: string;
};

export type RegimeFeedDeps = {
  /** Clé Firecrawl/scraper (serveur uniquement) — la recherche web replie sur `[]` si absente. */
  apiKey?: string;
  fetchImpl?: typeof fetch;
  /** LLM injectable (défaut : proxy LiteLLM `callLLM`). */
  llm?: (messages: LlmMessage[]) => Promise<LlmResult>;
  /** Prompt système de veille régimes éditable (S-053) ; repli sur le gabarit par défaut si absent. */
  systemPrompt?: string;
  now?: () => Date;
  cache?: TtlCache<RegimeFeed>;
};

function realDeps(deps: RegimeFeedDeps): RegimeDiscoverDeps {
  const search = (query: string, limit: number): Promise<WebSearchResult[]> =>
    searchWeb(query, limit, { apiKey: deps.apiKey, fetchImpl: deps.fetchImpl });
  const llm = deps.llm ?? ((messages: LlmMessage[]): Promise<LlmResult> => callLLM(messages));
  return { search, llm, now: deps.now, systemPrompt: deps.systemPrompt };
}

function regimeKey(r: RegimeSuggestion): string {
  return `${r.country.toLowerCase()}::${r.name.toLowerCase()}`;
}

/** Pays normalisés (non vides, dédupliqués, ordre préservé) pour requête + clé de cache. */
function normalizeCountries(countries: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of countries) {
    const v = c.trim();
    if (v === "" || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

/**
 * Fusion PURE seed∪live. Le seed est la RÉFÉRENCE (doctrine conservatrice du droit, S-062) ; la veille
 * n'AJOUTE que les régimes non présents dans le seed (par clé pays+nom). `source` reflète d'où vient le
 * jeu : `seed` (veille KO/vide), `live` (aucun seed), `mixed` (les deux). Pure, total.
 */
export function mergeRegimes(
  seed: RegimeSuggestion[],
  live: RegimeSuggestion[],
): { regimes: RegimeSuggestion[]; source: RegimeFeedSource } {
  const seedKeys = new Set(seed.map(regimeKey));
  const freshLive = live.filter((r) => !seedKeys.has(regimeKey(r)));
  const regimes = [...seed, ...freshLive];
  const source: RegimeFeedSource = live.length > 0 ? (seed.length > 0 ? "mixed" : "live") : "seed";
  return { regimes, source };
}

/**
 * Régimes applicables aux pays (cible + résidences clients) : fusion seed∪live. Ne lève jamais
 * (veille KO → seed seul). Pas de cache (cf. variante cachée plus bas).
 */
export async function getRegimesForCountries(
  countries: readonly string[],
  deps: RegimeFeedDeps = {},
): Promise<RegimeFeed> {
  const list = normalizeCountries(countries);
  const seed = regimesSeedForCountries(list);
  const live = await discoverRegimesForCountries(list, realDeps(deps));
  const { regimes, source } = mergeRegimes(seed, live);
  const generatedAt = (deps.now ?? ((): Date => new Date()))().toISOString().slice(0, 10);
  return { regimes, source, generatedAt };
}

// Cache partagé : volatile par instance serveur (la persistance durable = audit Supabase).
const sharedCache = new TtlCache<RegimeFeed>(REGIME_TTL_MS);

/**
 * Variante mise en cache (TTL court) : une veille identique (mêmes pays) n'est pas relancée.
 * `now`/`cache` injectables. Ne lève jamais (repli seed garanti).
 */
export async function getRegimesForCountriesCached(
  countries: readonly string[],
  deps: RegimeFeedDeps = {},
): Promise<RegimeFeed> {
  const list = normalizeCountries(countries);
  const nowMs = (deps.now ?? ((): Date => new Date()))().getTime();
  const cache = deps.cache ?? sharedCache;
  const key = list.join("|");
  const hit = cache.get(key, nowMs);
  if (hit !== null) return hit;
  const feed = await getRegimesForCountries(list, deps);
  cache.set(key, feed, nowMs);
  return feed;
}
