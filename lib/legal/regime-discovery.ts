// Veille de DÉCOUVERTE des régimes réglementaires applicables PAR PAYS (S-077, tranche 2).
//
// Calque de `lib/residency/discovery.ts` (veille fournisseurs) : recherche web (SearXNG/Crawl4AI) +
// synthèse LLM (proxy LiteLLM), I/O INJECTÉE → orchestration PURE. Entrées = pays cible + pays de
// résidence des clients (un régime suit souvent la résidence des personnes, pas l'hébergement).
//
// Garde-fous DÉFCON 1 (cohérents avec la veille légale S-062, conservatrice sur le DROIT) :
//   (1) une source citée DOIT être une URL réellement renvoyée par la recherche (anti-hallucination) ;
//   (2) le LLM ne rend JAMAIS un avis juridique ni un verdict de conformité — seulement l'EXISTENCE
//       d'un régime (nom + portée + pays + source) ; statut « à valider par un conseil » ;
//   (3) une suggestion live est en confiance `low` (à confirmer) — le repli seed daté reste la référence ;
//   (4) `code` n'est rempli que si le régime est mappable sur l'énum moteur, sinon `null` (régime libre).
// Tout échoue → `[]` (repli seed côté appelant, cf. regime-discovery-cache).

import type { Regulation } from "@/lib/engine";
import type { LlmMessage, LlmResult } from "@/lib/llm";
import type { WebSearchResult } from "@/lib/pricing/scraper";
import { DEFAULT_PROMPTS } from "@/lib/prompts/registry";
import type { RegimeScope, RegimeSuggestion } from "./regime-seed";

export type RegimeDiscoverDeps = {
  search: (query: string, limit: number) => Promise<WebSearchResult[]>;
  llm: (messages: LlmMessage[]) => Promise<LlmResult>;
  now?: () => Date;
  /** Prompt système surchargeable (S-053) ; repli sur le gabarit par défaut. */
  systemPrompt?: string;
};

/** Requête web orientée pays (anglais : moteur de recherche). */
export function regimeDiscoveryQuery(countries: readonly string[]): string {
  const list = countries.length > 0 ? countries.join(", ") : "the target country";
  return `data protection and AI regulations applicable in ${list} 2026 official law`;
}

/** Gabarit par défaut = source unique du registry (S-053, éditable super-admin) — pas de dérive. */
export const DEFAULT_REGIME_PROMPT = DEFAULT_PROMPTS["regime-veille"];

/**
 * Mappe le NOM d'un régime sur l'énum moteur (`Regulation`) quand il est notoirement reconnaissable,
 * sinon `null` (régime libre). Pur, total. Mots-clés robustes (insensibles à la casse / variantes).
 */
export function mapRegimeCode(name: string): Regulation | null {
  const n = name.toLowerCase();
  if (n.includes("ai act") || n.includes("artificial intelligence act")) return "aiact";
  if (n.includes("hipaa")) return "hipaa";
  if (n.includes("cndp") || n.includes("09-08")) return "cndp";
  if (n.includes("lgpd") || n.includes("13.709") || n.includes("13709")) return "lgpd"; // Brésil (S-077, T5)
  if (n.includes("appi")) return "appi"; // Japon (S-077, T5)
  if (n.includes("rgpd") || n.includes("gdpr")) return "rgpd"; // UK GDPR inclus volontairement (régime équivalent)
  return null;
}

const VALID_SCOPES: readonly RegimeScope[] = ["data-protection", "ai", "sector", "other"];

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

function parseScope(value: unknown): RegimeScope {
  return typeof value === "string" && (VALID_SCOPES as readonly string[]).includes(value)
    ? (value as RegimeScope)
    : "other";
}

/**
 * Convertit la réponse LLM en régimes sourcés (pur). Filtres DÉFCON 1 : nom non vide, URL ∈ résultats
 * (anti-hallucination), dédup par (pays, nom). `code` mappé via `mapRegimeCode` ; confiance `low` (live,
 * à confirmer) ; provenance `live`. `fallbackCountry` si le LLM omet le pays d'un régime.
 */
export function parseDiscoveredRegimes(
  content: string,
  results: readonly WebSearchResult[],
  fallbackCountry: string,
  checkedAt: string,
): RegimeSuggestion[] {
  const json = extractJson(content);
  if (!isRecord(json) || !Array.isArray(json.regimes)) return [];
  const out: RegimeSuggestion[] = [];
  const seen = new Set<string>();
  for (const item of json.regimes) {
    if (!isRecord(item)) continue;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (name === "") continue;
    const sourceUrl = typeof item.sourceUrl === "string" ? item.sourceUrl : "";
    if (!results.some((res) => res.url === sourceUrl)) continue; // anti-hallucination d'URL
    const country =
      typeof item.country === "string" && item.country.trim() !== "" ? item.country.trim() : fallbackCountry;
    const key = `${country.toLowerCase()}::${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      code: mapRegimeCode(name),
      name,
      scope: parseScope(item.scope),
      country,
      confidence: "low",
      provenance: "live",
      source: { label: `Veille web — ${name}`, url: sourceUrl, checkedAt },
    });
  }
  return out;
}

/**
 * Découvre les régimes applicables pour un ensemble de pays (cible + résidences clients) : recherche web
 * → synthèse LLM → régimes sourcés, ou `[]` (pas de résultat / LLM KO / JSON invalide → repli seed côté
 * appelant). Ne lève pas : capture l'erreur d'I/O → `[]`. `fallbackCountry` = 1ᵉʳ pays fourni.
 */
export async function discoverRegimesForCountries(
  countries: readonly string[],
  deps: RegimeDiscoverDeps,
): Promise<RegimeSuggestion[]> {
  try {
    const results = await deps.search(regimeDiscoveryQuery(countries), 8);
    if (results.length === 0) return [];
    const sourcesBlock = results.map((res, i) => `[${i + 1}] ${res.title} — ${res.url}\n${res.snippet}`).join("\n");
    const user = `TARGET COUNTRIES: ${countries.join(", ")}\nWeb results:\n${sourcesBlock}`;
    const messages: LlmMessage[] = [
      { role: "system", content: deps.systemPrompt ?? DEFAULT_REGIME_PROMPT },
      { role: "user", content: user },
    ];
    const r = await deps.llm(messages);
    if (!r.ok) return [];
    const checkedAt = (deps.now ?? ((): Date => new Date()))().toISOString().slice(0, 10);
    const fallbackCountry = countries[0] ?? "";
    return parseDiscoveredRegimes(r.content, results, fallbackCountry, checkedAt);
  } catch {
    return [];
  }
}
