// Veille catalogue : assemblage serveur (Firecrawl + LiteLLM) + cache TTL court (S-036).
//
// `live-catalog.ts` est PUR (l'I/O est injectée). Ce module branche l'I/O RÉELLE : la recherche web
// (Firecrawl `searchWeb`) et le LLM (proxy LiteLLM `callLLM`), wrappées en `proposeForSlot`, puis met
// en cache le catalogue assemblé PAR PROFIL (TTL court) pour ne pas relancer une veille identique à
// chaque requête (coût + latence Firecrawl/LLM). Les clés restent serveur ; `now`/I/O injectables.

import type { Profile } from "@/lib/engine";
import { callLLM, type LlmMessage, type LlmResult } from "@/lib/llm";
import { searchWeb, type WebSearchResult } from "@/lib/pricing/firecrawl";
import { TtlCache } from "@/lib/pricing/cache";
import { assembleLiveCatalog, proposeForSlotLive, type ProposeForSlot } from "./live-catalog";
import type { Catalog } from "./types";

/** TTL court : la veille web+LLM est coûteuse, mais le catalogue doit rester frais (≪ les 6 h des prix). */
const CATALOG_TTL_MS = 60 * 60 * 1000; // 1 h

export type LiveCatalogDeps = {
  /** Clé Firecrawl (serveur uniquement) — la recherche web replie sur `[]` si absente. */
  apiKey?: string;
  /** `fetch` injectable (tests sans réseau). */
  fetchImpl?: typeof fetch;
  /** LLM injectable (défaut : proxy LiteLLM `callLLM`). */
  llm?: (messages: LlmMessage[]) => Promise<LlmResult>;
  /** Veille d'un slot injectable (tests) ; sinon construite depuis la recherche web + le LLM réels. */
  proposeForSlot?: ProposeForSlot;
  /** Prompt système de veille éditable (S-053) ; repli sur le gabarit par défaut si absent. */
  systemPrompt?: string;
  now?: () => Date;
  cache?: TtlCache<Catalog>;
};

/** Construit la veille réelle d'un slot : recherche web Firecrawl → synthèse LLM sourcée. */
function realProposeForSlot(deps: LiveCatalogDeps): ProposeForSlot {
  const search = (query: string, limit: number): Promise<WebSearchResult[]> =>
    searchWeb(query, limit, { apiKey: deps.apiKey, fetchImpl: deps.fetchImpl });
  const llm = deps.llm ?? ((messages: LlmMessage[]): Promise<LlmResult> => callLLM(messages));
  return (slot, profile, seedSlot) =>
    proposeForSlotLive(slot, profile, seedSlot, { search, llm, now: deps.now, systemPrompt: deps.systemPrompt });
}

/** Assemble le catalogue live (sans cache). Ne lève jamais : repli seed par slot (cf. `live-catalog`). */
export async function getLiveCatalog(profile: Profile, deps: LiveCatalogDeps = {}): Promise<Catalog> {
  const proposeForSlot = deps.proposeForSlot ?? realProposeForSlot(deps);
  return assembleLiveCatalog(profile, { proposeForSlot, now: deps.now });
}

// Cache partagé : volatile par instance serveur (la persistance durable = audit Supabase / Lot 2).
const sharedCache = new TtlCache<Catalog>(CATALOG_TTL_MS);

/** Clé de cache stable par profil : mêmes entrées ⇒ même veille (pas de relance). */
function cacheKey(profile: Profile): string {
  return JSON.stringify(profile);
}

/**
 * Catalogue live mis en cache PAR PROFIL (TTL court) : une veille identique n'est pas relancée.
 * `now`/`cache` injectables pour les tests. Ne lève jamais (repli seed garanti en amont).
 */
export async function getLiveCatalogCached(profile: Profile, deps: LiveCatalogDeps = {}): Promise<Catalog> {
  const nowMs = (deps.now ?? ((): Date => new Date()))().getTime();
  const cache = deps.cache ?? sharedCache;
  const key = cacheKey(profile);
  const hit = cache.get(key, nowMs);
  if (hit !== null) return hit;
  const catalog = await getLiveCatalog(profile, deps);
  cache.set(key, catalog, nowMs);
  return catalog;
}
