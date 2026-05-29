// Veille juridique : assemblage serveur (Firecrawl + LiteLLM) + cache TTL (S-062, jumeau de
// `lib/catalog/cache`). `live-transfers.ts` est PUR (I/O injectée) ; ce module branche l'I/O RÉELLE
// (recherche web `searchWeb` + LLM `callLLM`) et met en cache le résultat (TTL court) pour ne pas
// relancer une veille identique à chaque requête. Les clés restent SERVEUR ; `now`/I/O injectables.

import { callLLM, type LlmMessage, type LlmResult } from "@/lib/llm";
import { searchWeb, type WebSearchResult } from "@/lib/pricing/scraper";
import { TtlCache } from "@/lib/pricing/cache";
import { refreshTransferBases, type RefreshDeps, type TransferFlow } from "./live-transfers";
import { WATCHED_TRANSFER_FLOWS, type TransferBasis } from "./transfers";

/** TTL : un statut juridique évolue lentement (jours/mois) ; on rafraîchit au plus une fois / 6 h. */
const LEGAL_TTL_MS = 6 * 60 * 60 * 1000;

export type LiveTransferDeps = {
  /** Clé Firecrawl (serveur uniquement) — la recherche web replie sur `[]` si absente. */
  apiKey?: string;
  /** `fetch` injectable (tests sans réseau). */
  fetchImpl?: typeof fetch;
  /** LLM injectable (défaut : proxy LiteLLM `callLLM`). */
  llm?: (messages: LlmMessage[]) => Promise<LlmResult>;
  /** Prompt système de veille juridique éditable (S-053) ; repli sur le gabarit par défaut si absent. */
  systemPrompt?: string;
  now?: () => Date;
  cache?: TtlCache<TransferBasis[]>;
};

/** Construit les dépendances réelles de veille (recherche web Firecrawl + LLM LiteLLM). */
function realDeps(deps: LiveTransferDeps): RefreshDeps {
  const search = (query: string, limit: number): Promise<WebSearchResult[]> =>
    searchWeb(query, limit, { apiKey: deps.apiKey, fetchImpl: deps.fetchImpl });
  const llm = deps.llm ?? ((messages: LlmMessage[]): Promise<LlmResult> => callLLM(messages));
  return { search, llm, now: deps.now, systemPrompt: deps.systemPrompt };
}

/** Rafraîchit les statuts (sans cache). Ne lève jamais : repli seed par flux (cf. `live-transfers`). */
export async function getLiveTransferBases(
  deps: LiveTransferDeps = {},
  flows: readonly TransferFlow[] = WATCHED_TRANSFER_FLOWS,
): Promise<TransferBasis[]> {
  return refreshTransferBases(realDeps(deps), flows);
}

// Cache partagé : volatile par instance serveur (la persistance durable = audit Supabase).
const sharedCache = new TtlCache<TransferBasis[]>(LEGAL_TTL_MS);

function cacheKey(flows: readonly TransferFlow[]): string {
  return flows.map((f) => `${f.from}>${f.to}`).join("|");
}

/**
 * Statuts live mis en cache (TTL court) : une veille identique n'est pas relancée. `now`/`cache`
 * injectables pour les tests. Ne lève jamais (repli seed garanti en amont).
 */
export async function getLiveTransferBasesCached(
  deps: LiveTransferDeps = {},
  flows: readonly TransferFlow[] = WATCHED_TRANSFER_FLOWS,
): Promise<TransferBasis[]> {
  const nowMs = (deps.now ?? ((): Date => new Date()))().getTime();
  const cache = deps.cache ?? sharedCache;
  const key = cacheKey(flows);
  const hit = cache.get(key, nowMs);
  if (hit !== null) return hit;
  const bases = await getLiveTransferBases(deps, flows);
  cache.set(key, bases, nowMs);
  return bases;
}
