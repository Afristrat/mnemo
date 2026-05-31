// Découverte de fournisseurs par pays : câblage I/O réel + repli annuaire seed + cache (S-073, T3).
//
// `discovery.ts` est PUR (I/O injectée). Ici on branche la recherche web réelle (SearXNG/Crawl4AI
// `searchWeb`) + le LLM (proxy LiteLLM `callLLM`), on REPLIE sur l'annuaire seed (tranche 1) filtré par
// les contraintes utilisateur (S-072) si la veille ne rend rien, et on met en cache par pays+profil
// (TTL court). Repli garanti → DÉFCON 1 : on rend toujours un ensemble conforme et sourcé.

import { providersByContinent, type Continent, type Profile } from "@/lib/engine";
import { callLLM, type LlmMessage, type LlmResult } from "@/lib/llm";
import { searchWeb, type WebSearchResult } from "@/lib/pricing/scraper";
import { SOVEREIGN_PROVIDERS_SEED } from "@/lib/pricing/sovereign-providers-seed";
import { TtlCache } from "@/lib/pricing/cache";
import {
  discoverProvidersForCountry,
  providerViolatesConstraints,
  type DiscoveredProvider,
} from "./discovery";

const DISCOVERY_TTL_MS = 60 * 60 * 1000; // 1 h (comme la veille catalogue)

export type ProviderDiscoveryResult = {
  country: string;
  continent: Continent;
  providers: DiscoveredProvider[];
  source: "live" | "seed" | "mixed";
  discoveredAt: string; // YYYY-MM-DD
};

export type DiscoveryDeps = {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  llm?: (messages: LlmMessage[]) => Promise<LlmResult>;
  systemPrompt?: string;
  now?: () => Date;
  cache?: TtlCache<ProviderDiscoveryResult>;
  /** Découverte injectable (tests) ; sinon construite depuis la recherche web + le LLM réels. */
  discover?: (country: string, continent: Continent, profile: Profile) => Promise<DiscoveredProvider[]>;
};

/** Repli : annuaire seed (tranche 1) du continent, filtré par contraintes utilisateur (S-072). */
function seedFallback(continent: Continent, profile: Profile): DiscoveredProvider[] {
  return providersByContinent(SOVEREIGN_PROVIDERS_SEED, continent)
    .filter((p) => !providerViolatesConstraints(p.sovereignty, profile))
    .map((p) => ({ ...p, provenance: "seed" as const }));
}

function realDiscover(deps: DiscoveryDeps): (country: string, continent: Continent, profile: Profile) => Promise<DiscoveredProvider[]> {
  const search = (query: string, limit: number): Promise<WebSearchResult[]> =>
    searchWeb(query, limit, { apiKey: deps.apiKey, fetchImpl: deps.fetchImpl });
  const llm = deps.llm ?? ((messages: LlmMessage[]): Promise<LlmResult> => callLLM(messages));
  return (country, continent, profile) =>
    discoverProvidersForCountry(country, continent, profile, { search, llm, now: deps.now, systemPrompt: deps.systemPrompt });
}

/**
 * Découvre les fournisseurs d'un pays (live) + repli annuaire seed, dédupliqués par nom (live prioritaire).
 * Ne lève jamais : la découverte capture ses erreurs, le repli seed garantit un ensemble conforme.
 */
export async function getProvidersForCountry(
  country: string,
  continent: Continent,
  profile: Profile,
  deps: DiscoveryDeps = {},
): Promise<ProviderDiscoveryResult> {
  const discover = deps.discover ?? realDiscover(deps);
  const live = await discover(country, continent, profile);

  const seen = new Set(live.map((p) => p.name.toLowerCase()));
  const seedAdded = seedFallback(continent, profile).filter((p) => !seen.has(p.name.toLowerCase()));
  const providers = [...live, ...seedAdded];

  const source: ProviderDiscoveryResult["source"] =
    live.length > 0 ? (seedAdded.length > 0 ? "mixed" : "live") : "seed";
  const discoveredAt = (deps.now ?? ((): Date => new Date()))().toISOString().slice(0, 10);
  return { country, continent, providers, source, discoveredAt };
}

const sharedCache = new TtlCache<ProviderDiscoveryResult>(DISCOVERY_TTL_MS);

function cacheKey(country: string, continent: Continent, profile: Profile): string {
  return `${continent}|${country}|${JSON.stringify(profile)}`;
}

/** Découverte mise en cache par pays+continent+profil (TTL court) ; ne relance pas une veille identique. */
export async function getProvidersForCountryCached(
  country: string,
  continent: Continent,
  profile: Profile,
  deps: DiscoveryDeps = {},
): Promise<ProviderDiscoveryResult> {
  const nowMs = (deps.now ?? ((): Date => new Date()))().getTime();
  const cache = deps.cache ?? sharedCache;
  const key = cacheKey(country, continent, profile);
  const hit = cache.get(key, nowMs);
  if (hit !== null) return hit;
  const result = await getProvidersForCountry(country, continent, profile, deps);
  cache.set(key, result, nowMs);
  return result;
}
