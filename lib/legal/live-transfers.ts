// Veille live des statuts juridiques de transfert (S-062, jumeau de `lib/catalog/live-catalog`).
//
// Pour chaque flux SURVEILLÉ (statuts `volatile` : DPF UE-US, adéquation Maroc), on cherche les
// SOURCES OFFICIELLES sur le web (Firecrawl) + on demande au LLM (proxy LiteLLM) de lire le statut
// COURANT, sourcé. Garde-fous DÉFCON 1 : (1) le LLM ne peut citer qu'une URL **présente dans les
// résultats** (anti-hallucination) ; (2) `reconcileTransferBasis` ne remplace JAMAIS un statut en
// silence — concordant → confirmé, divergent → flaggé « à revérifier ». Veille KO → repli seed.
// Le LLM ne rend JAMAIS un avis juridique : il relève un statut indicatif, daté, révisable. Orchestration
// pure (I/O injectée). Les flux STABLES (même juridiction, etc.) ne déclenchent aucune veille.

import type { LlmMessage, LlmResult } from "@/lib/llm";
import { DEFAULT_PROMPTS } from "@/lib/prompts/registry";
import type { WebSearchResult } from "@/lib/pricing/scraper";
import { reconcileTransferBasis, type LiveTransferSignal } from "./reconcile";
import {
  lookupTransferBasis,
  WATCHED_TRANSFER_FLOWS,
  type TransferBasis,
  type TransferRegion,
  type TransferStatus,
} from "./transfers";

export type TransferFlow = { from: TransferRegion; to: TransferRegion };

export type ProposeTransferDeps = {
  search: (query: string, limit: number) => Promise<WebSearchResult[]>;
  llm: (messages: LlmMessage[]) => Promise<LlmResult>;
  now?: () => Date;
  /** Prompt système (S-053) — défaut = gabarit de veille juridique du registre ; surchargé par /admin. */
  systemPrompt?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Extrait le premier objet JSON d'un texte (le LLM peut l'entourer de prose / fences). */
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function parseStatus(value: unknown): TransferStatus | null {
  return value === "ok" || value === "restricted" || value === "forbidden" ? value : null;
}

/** Convertit la réponse LLM en signal, ou `null` si invalide / URL hallucinée (anti-DÉFCON 1). */
function parseSignal(content: string, results: WebSearchResult[], checkedAt: string): LiveTransferSignal | null {
  const json = extractJson(content);
  if (!isRecord(json)) return null;
  const status = parseStatus(json.status);
  if (status === null) return null;
  const sourceUrl = typeof json.sourceUrl === "string" ? json.sourceUrl : "";
  // DÉFCON 1 : la source DOIT être une URL réellement renvoyée par la recherche (jamais inventée).
  const hit = results.find((r) => r.url === sourceUrl);
  if (hit === undefined) return null;
  return {
    status,
    legalBasis: typeof json.legalBasis === "string" ? json.legalBasis : undefined,
    source: { label: `Veille juridique — ${hit.title}`, url: sourceUrl, checkedAt },
    note: typeof json.note === "string" ? json.note : undefined,
  };
}

/**
 * Veille réelle d'un flux : recherche de sources officielles → lecture LLM → signal sourcé, ou `null`
 * (pas de résultat / LLM KO / JSON invalide / URL hallucinée → repli seed côté orchestrateur).
 */
export async function proposeTransferLive(
  from: TransferRegion,
  to: TransferRegion,
  deps: ProposeTransferDeps,
): Promise<LiveTransferSignal | null> {
  const query = `${from} ${to} personal data transfer adequacy decision status 2026 official GDPR chapter V`;
  const results = await deps.search(query, 5);
  if (results.length === 0) return null;

  const sourcesBlock = results.map((r, i) => `[${i + 1}] ${r.title} — ${r.url}\n${r.snippet}`).join("\n");
  const user =
    `Flux de transfert : ${from} → ${to}\n` +
    `Statut indicatif actuel (à revérifier) : voir résultats officiels ci-dessous.\n` +
    `Résultats web (sources potentiellement officielles) :\n${sourcesBlock}`;
  const messages: LlmMessage[] = [
    { role: "system", content: deps.systemPrompt ?? DEFAULT_PROMPTS["legal-veille"] },
    { role: "user", content: user },
  ];
  const r = await deps.llm(messages);
  if (!r.ok) return null;

  const checkedAt = (deps.now ?? ((): Date => new Date()))().toISOString().slice(0, 10);
  return parseSignal(r.content, results, checkedAt);
}

export type RefreshDeps = ProposeTransferDeps & {
  /** Veille d'un flux injectable (tests) ; sinon construite depuis la recherche web + le LLM réels. */
  proposeTransfer?: (from: TransferRegion, to: TransferRegion) => Promise<LiveTransferSignal | null>;
};

/**
 * Rafraîchit les statuts des flux surveillés (par défaut `WATCHED_TRANSFER_FLOWS`). Pour chaque flux :
 * le repli daté (`lookupTransferBasis`) sert de base ; s'il est `volatile`, on lance la veille puis on
 * réconcilie (concordant → confirmé, divergent → flaggé) ; sinon on garde le repli tel quel. Parallélisé,
 * repli seed garanti par flux (erreur/indispo). Ne lève jamais. `now`/I/O injectables.
 */
export async function refreshTransferBases(
  deps: RefreshDeps,
  flows: readonly TransferFlow[] = WATCHED_TRANSFER_FLOWS,
): Promise<TransferBasis[]> {
  const propose =
    deps.proposeTransfer ?? ((from: TransferRegion, to: TransferRegion) => proposeTransferLive(from, to, deps));
  const now = deps.now ?? ((): Date => new Date());

  return Promise.all(
    flows.map(async ({ from, to }): Promise<TransferBasis> => {
      const seed = lookupTransferBasis(from, to);
      if (!seed.volatile) return { ...seed, provenance: "seed" };
      let live: LiveTransferSignal | null = null;
      try {
        live = await propose(from, to);
      } catch {
        live = null;
      }
      return reconcileTransferBasis(seed, live, now().toISOString().slice(0, 10));
    }),
  );
}
