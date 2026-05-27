// Veille temps réel du catalogue (reco vivante, spec n°3 §5.4, S-036).
//
// Pour chaque slot, on cherche sur le web (Firecrawl) + on demande au LLM (proxy LiteLLM) de proposer
// LE composant le plus adapté, sourcé. Garde-fous DÉFCON 1 : (1) le LLM ne peut citer qu'une URL
// **présente dans les résultats web** (anti-hallucination d'URL) ; (2) `reconcileCatalog` valide ensuite
// (licence/souveraineté/profil) sinon repli **seed**. Tout échoue → repli seed total. Le LLM ne calcule
// jamais un coût. Orchestration pure (deps injectables) ; l'I/O (search/llm) est injectée.

import { decidePreset, type Profile } from "@/lib/engine";
import type { LlmMessage, LlmResult } from "@/lib/llm";
import type { WebSearchResult } from "@/lib/pricing/firecrawl";
import { seedCatalog } from "./catalog-seed";
import { reconcileCatalog } from "./reconcile";
import type { Catalog, CatalogSlot, ComponentCandidate, ComponentSovereignty, SlotId } from "./types";

const SLOT_IDS: readonly SlotId[] = ["c0", "c1", "c2", "c3", "c4", "c5", "c6"];

/** Propose un candidat pour un slot (injectable : la vraie veille web+LLM, ou un mock en test). */
export type ProposeForSlot = (
  slot: SlotId,
  profile: Profile,
  seedSlot: CatalogSlot,
) => Promise<ComponentCandidate | null>;

export type AssembleDeps = { proposeForSlot: ProposeForSlot; now?: () => Date };

/**
 * Assemble un catalogue **live** : chaque slot est proposé par la veille puis passé au garde-fou
 * (`reconcileCatalog`) ; à défaut (null/erreur/aberrant) → repli sur le candidat seed. Parallélisé.
 * Pur (l'I/O est dans `proposeForSlot`). `source` = live (tout live) / seed (tout seed) / mixed.
 */
export async function assembleLiveCatalog(profile: Profile, deps: AssembleDeps): Promise<Catalog> {
  const { preset } = decidePreset(profile);
  const seed = seedCatalog(preset, profile);
  const now = deps.now ?? (() => new Date());

  const entries = await Promise.all(
    SLOT_IDS.map(async (id): Promise<readonly [SlotId, CatalogSlot]> => {
      const seedSlot = seed.slots[id];
      let live: ComponentCandidate | null = null;
      try {
        live = await deps.proposeForSlot(id, profile, seedSlot);
      } catch {
        live = null;
      }
      const recommended =
        live === null ? seedSlot.recommended : reconcileCatalog(live, seedSlot.recommended, profile);
      return [id, { slot: id, recommended, alternatives: seedSlot.alternatives }];
    }),
  );

  const slots: Record<SlotId, CatalogSlot> = { ...seed.slots };
  for (const [id, slot] of entries) slots[id] = slot;

  const provenances = SLOT_IDS.map((id) => slots[id].recommended.provenance);
  const allLive = provenances.every((p) => p === "live");
  const allSeed = provenances.every((p) => p === "seed");
  const source: Catalog["source"] = allLive ? "live" : allSeed ? "seed" : "mixed";

  return { slots, assembledAt: now().toISOString().slice(0, 10), source };
}

// --- Veille réelle d'un slot (recherche web + synthèse LLM, sourcée) ---------------------------

export type ProposeDeps = {
  search: (query: string, limit: number) => Promise<WebSearchResult[]>;
  llm: (messages: LlmMessage[]) => Promise<LlmResult>;
  now?: () => Date;
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

function parseSovereignty(value: unknown): ComponentSovereignty {
  return value === "sovereign" || value === "eu-hosted" || value === "api-third-party" ? value : "api-third-party";
}

/** Convertit la réponse LLM en `ComponentCandidate`, ou `null` si invalide / URL hallucinée. */
function parseCandidate(content: string, results: WebSearchResult[], role: string, checkedAt: string): ComponentCandidate | null {
  const json = extractJson(content);
  if (!isRecord(json)) return null;
  const name = typeof json.name === "string" ? json.name.trim() : "";
  if (name === "") return null;
  const sourceUrl = typeof json.sourceUrl === "string" ? json.sourceUrl : "";
  // DÉFCON 1 : la source DOIT être une des URLs réellement renvoyées par la recherche (pas inventée).
  if (!results.some((r) => r.url === sourceUrl)) return null;
  return {
    name,
    role,
    license: typeof json.license === "string" ? json.license : undefined,
    sovereignty: parseSovereignty(json.sovereignty),
    benchmarkRank: typeof json.benchmarkRank === "string" ? json.benchmarkRank : undefined,
    source: { label: `Veille web — ${name}`, url: sourceUrl, checkedAt },
    confidence: "medium", // live sourcé mais non re-vérifié manuellement ; le garde-fou peut downgrader
    provenance: "live",
    note: typeof json.note === "string" ? json.note : undefined,
  };
}

const SYSTEM_PROMPT =
  "Tu es un architecte d'infrastructure de base mémorielle IA souveraine. À partir UNIQUEMENT des résultats web fournis, " +
  "propose LE composant le plus adapté au rôle demandé. Réponds STRICTEMENT en JSON, sans prose ni commentaire, avec les " +
  'clés : {"name","role","license","sovereignty","benchmarkRank","sourceUrl","note"}. "sovereignty" ∈ ' +
  '{"sovereign","eu-hosted","api-third-party"}. "sourceUrl" DOIT être exactement l\'une des URLs des résultats fournis ' +
  "(n'invente JAMAIS d'URL). Aucune justification commerciale, aucun biais de fournisseur.";

/**
 * Veille réelle d'un slot : recherche web → synthèse LLM → `ComponentCandidate` sourcé, ou `null`
 * (pas de résultat / LLM KO / JSON invalide / URL hallucinée → repli seed côté orchestrateur). Pur-ish.
 */
export async function proposeForSlotLive(
  slot: SlotId,
  profile: Profile,
  seedSlot: CatalogSlot,
  deps: ProposeDeps,
): Promise<ComponentCandidate | null> {
  const sovereignHint = profile.sensitivity === "secret" ? " souverain auto-hébergeable open-source" : "";
  const query = `meilleur ${seedSlot.recommended.role}${sovereignHint} 2026 comparatif licence open-source`;
  const results = await deps.search(query, 5);
  if (results.length === 0) return null;

  const sourcesBlock = results
    .map((r, i) => `[${i + 1}] ${r.title} — ${r.url}\n${r.snippet}`)
    .join("\n");
  const user =
    `Rôle: ${seedSlot.recommended.role}\n` +
    `Contraintes: zone=${profile.zone}, sensibilité=${profile.sensitivity}\n` +
    `Référence actuelle: ${seedSlot.recommended.name}\n` +
    `Résultats web:\n${sourcesBlock}`;
  const messages: LlmMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: user },
  ];
  const r = await deps.llm(messages);
  if (!r.ok) return null;

  const checkedAt = (deps.now ?? (() => new Date()))().toISOString().slice(0, 10);
  return parseCandidate(r.content, results, seedSlot.recommended.role, checkedAt);
}
