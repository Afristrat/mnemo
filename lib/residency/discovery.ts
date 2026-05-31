// Veille de DÉCOUVERTE de fournisseurs d'infrastructure PAR PAYS CIBLE (S-073, tranche 3).
//
// Vision Amine : « pour chaque continent, proposer de TROUVER des fournisseurs dans le(s) pays cible(s),
// surtout pour ceux qui veulent plusieurs solutions infra REDONDANTES ». Décision Amine (S-072) : « la
// recherche crawl4ai doit OBLIGATOIREMENT respecter les choix utilisateurs comme contrainte ABSOLUE ».
//
// Mirroir du pattern catalogue (lib/catalog/live-catalog) : recherche web (SearXNG/Crawl4AI) + synthèse
// LLM (proxy LiteLLM), I/O INJECTÉE → orchestration PURE. Garde-fous DÉFCON 1 :
//   (1) la contrainte utilisateur oriente la REQUÊTE, est une RÈGLE DURE du prompt, ET re-filtre la
//       sortie (`providerViolatesConstraints`) — un fournisseur non conforme n'est JAMAIS retenu ;
//   (2) une source citée DOIT être une URL réellement renvoyée par la recherche (anti-hallucination) ;
//   (3) JAMAIS de prix egress fabriqué (l'annuaire = existence + pays + souveraineté + source) ;
//   (4) le statut juridique de transfert reste géré par lib/legal (conservateur), hors de cette veille.
// Tout échoue → repli annuaire seed (tranche 1) filtré par contraintes (cf. discovery-cache).

import type { Continent, Profile, ProviderSovereignty, SovereignProvider } from "@/lib/engine";
import type { LlmMessage, LlmResult } from "@/lib/llm";
import type { WebSearchResult } from "@/lib/pricing/scraper";
import { deriveCatalogConstraints } from "@/lib/catalog/constraints";

export type ProviderProvenance = "live" | "seed";
export type DiscoveredProvider = SovereignProvider & { provenance: ProviderProvenance };

/**
 * Contrainte DURE spécifique fournisseurs (S-072, absolue) : on ne rejette que sur un CHOIX EXPLICITE.
 * Souveraineté exigée (`secret`/`secret-pro`/`hipaa`/toggle `preferSovereign`) ⇒ aucun **hyperscaler**
 * (la classe clairement non souveraine). `sovereign` et `eu-hosted` restent admis (pas d'interprétation
 * discutable ; la zone/le transfert sont encadrés par le modèle de résidence + lib/legal).
 */
export function providerViolatesConstraints(sovereignty: ProviderSovereignty, profile: Profile): boolean {
  const c = deriveCatalogConstraints(profile);
  return c.requireSovereign && sovereignty === "hyperscaler";
}

/** Requête web orientée pays + contraintes (anglais : moteur de recherche). */
export function discoveryQuery(country: string, profile: Profile): string {
  const c = deriveCatalogConstraints(profile);
  const sov = c.requireSovereign ? "sovereign data-residency" : "local";
  return `${sov} cloud infrastructure providers in ${country} 2026 data center hosting`;
}

/** Bloc de RÈGLES DURES injecté dans le prompt (anglais), pays + contraintes utilisateur. */
export function discoveryPromptRules(country: string, profile: Profile): string {
  const c = deriveCatalogConstraints(profile);
  const rules: string[] = [`providers MUST operate infrastructure in/for: ${country}`];
  if (c.requireSovereign) rules.push("each provider MUST be sovereign or locally-hosted — NO global hyperscaler (reject hyperscaler)");
  if (c.regulated) rules.push(`MUST be compatible with the regimes: ${c.regulations.join(", ")}`);
  if (c.nonPublic) rules.push("data is NOT public — exclude providers that cannot keep data in the target jurisdiction");
  return rules.join("; ");
}

export const DEFAULT_DISCOVERY_PROMPT =
  "You are an infrastructure analyst. From the web results, list real cloud/infrastructure providers that " +
  "operate in the TARGET COUNTRY and satisfy the HARD CONSTRAINTS. Return STRICT JSON: " +
  '{"providers":[{"name":string,"country":string,"sovereignty":"sovereign"|"eu-hosted"|"hyperscaler",' +
  '"note":string,"sourceUrl":string}]}. ' +
  "sourceUrl MUST be one of the provided result URLs (never invent one). Reject any provider violating a " +
  "hard constraint. NEVER output prices. Max 6 providers, most relevant first.";

export type DiscoverDeps = {
  search: (query: string, limit: number) => Promise<WebSearchResult[]>;
  llm: (messages: LlmMessage[]) => Promise<LlmResult>;
  now?: () => Date;
  /** Prompt système surchargeable (S-053) ; repli sur le gabarit par défaut. */
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

/** Défaut `hyperscaler` = conservateur (la classe la plus susceptible d'être rejetée si souveraineté exigée). */
function parseSovereignty(value: unknown): ProviderSovereignty {
  return value === "sovereign" || value === "eu-hosted" || value === "hyperscaler" ? value : "hyperscaler";
}

/**
 * Convertit la réponse LLM en fournisseurs sourcés conformes (pur). Filtre DÉFCON 1 + S-072 :
 * nom non vide, URL ∈ résultats (anti-hallucination), contrainte dure respectée, dédup par nom.
 */
export function parseDiscoveredProviders(
  content: string,
  results: WebSearchResult[],
  continent: Continent,
  fallbackCountry: string,
  checkedAt: string,
  profile: Profile,
): DiscoveredProvider[] {
  const json = extractJson(content);
  if (!isRecord(json) || !Array.isArray(json.providers)) return [];
  const out: DiscoveredProvider[] = [];
  const seen = new Set<string>();
  for (const item of json.providers) {
    if (!isRecord(item)) continue;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (name === "") continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    const sourceUrl = typeof item.sourceUrl === "string" ? item.sourceUrl : "";
    if (!results.some((r) => r.url === sourceUrl)) continue; // anti-hallucination d'URL
    const sovereignty = parseSovereignty(item.sovereignty);
    if (providerViolatesConstraints(sovereignty, profile)) continue; // contrainte S-072 ABSOLUE
    seen.add(key);
    out.push({
      name,
      continent,
      country: typeof item.country === "string" && item.country.trim() !== "" ? item.country.trim() : fallbackCountry,
      sovereignty,
      note: typeof item.note === "string" ? item.note : "",
      source: { label: `Veille web — ${name}`, url: sourceUrl, checkedAt },
      provenance: "live",
    });
  }
  return out;
}

/**
 * Découvre des fournisseurs pour un pays cible (recherche web → synthèse LLM → fournisseurs sourcés
 * conformes), ou `[]` (pas de résultat / LLM KO / JSON invalide / tous non conformes → repli seed côté
 * appelant). Ne lève pas : capture l'erreur d'I/O → `[]`.
 */
export async function discoverProvidersForCountry(
  country: string,
  continent: Continent,
  profile: Profile,
  deps: DiscoverDeps,
): Promise<DiscoveredProvider[]> {
  try {
    const results = await deps.search(discoveryQuery(country, profile), 6);
    if (results.length === 0) return [];
    const sourcesBlock = results.map((r, i) => `[${i + 1}] ${r.title} — ${r.url}\n${r.snippet}`).join("\n");
    const user =
      `TARGET COUNTRY: ${country}\n` +
      `HARD CONSTRAINTS (reject any provider that violates these): ${discoveryPromptRules(country, profile)}\n` +
      `Web results:\n${sourcesBlock}`;
    const messages: LlmMessage[] = [
      { role: "system", content: deps.systemPrompt ?? DEFAULT_DISCOVERY_PROMPT },
      { role: "user", content: user },
    ];
    const r = await deps.llm(messages);
    if (!r.ok) return [];
    const checkedAt = (deps.now ?? ((): Date => new Date()))().toISOString().slice(0, 10);
    return parseDiscoveredProviders(r.content, results, continent, country, checkedAt, profile);
  } catch {
    return [];
  }
}
