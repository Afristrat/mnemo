// Client de scraping/recherche (côté serveur uniquement) — backends AUTO-HÉBERGÉS sur serveurai
// (remplace Firecrawl, dont les crédits cloud s'épuisaient, S-070) :
//   • recherche web  → SearXNG     (GET {SEARXNG_BASE_URL}/search?format=json)
//   • scrape markdown → Crawl4AI    (POST {CRAWL4AI_BASE_URL}/md)
//   • extraction JSON → Crawl4AI markdown + LLM local (LiteLLM/Ollama via callLLM)
// `fetch` natif (zéro SDK), `fetchImpl` injectable pour les tests. Aucune clé exposée au client.
// JAMAIS de throw → repli (l'appelant retombe sur le seed daté, DÉFCON 1). Signatures publiques
// inchangées (searchWeb / scrapePricingMarkdown / scrapeStructuredJson / ScrapeDeps / WebSearchResult).

import { callLLM } from "@/lib/llm/client";

const SEARXNG_BASE_URL = process.env.SEARXNG_BASE_URL ?? "http://searxng-strate:8080";
const CRAWL4AI_BASE_URL = process.env.CRAWL4AI_BASE_URL ?? "http://crawl4ai-strate:11235";

export type ScrapeDeps = {
  /** Jeton optionnel Crawl4AI (Bearer). Repli sur `CRAWL4AI_API_TOKEN`. (SearXNG : pas d'auth.) */
  apiKey: string | undefined;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

/** Un résultat de recherche web (sous-ensemble exploité ; jamais de valeur sensible). */
export type WebSearchResult = { title: string; url: string; snippet: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function crawlHeaders(deps: ScrapeDeps): Record<string, string> {
  const token = deps.apiKey ?? process.env.CRAWL4AI_API_TOKEN;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token !== undefined && token.length > 0) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * Recherche web (SearXNG `/search?format=json`) → liste {title, url, snippet}, pour la veille de
 * composants/juridique et l'assistant. Ne lève jamais (échec/réponse invalide → `[]`) ; l'appelant
 * replie sur le seed. Lecture JSON inconnu sans `as`/`any` (type guards).
 */
export async function searchWeb(query: string, limit: number, deps: ScrapeDeps): Promise<WebSearchResult[]> {
  const doFetch = deps.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), deps.timeoutMs ?? 30_000);

  try {
    const url = `${SEARXNG_BASE_URL}/search?q=${encodeURIComponent(query)}&format=json`;
    const response = await doFetch(url, { signal: controller.signal });
    if (!response.ok) return [];

    const payload: unknown = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.results)) return [];

    const out: WebSearchResult[] = [];
    for (const item of payload.results) {
      if (!isRecord(item)) continue;
      const itemUrl = typeof item.url === "string" ? item.url : "";
      if (itemUrl.length === 0) continue;
      const title = typeof item.title === "string" ? item.title : "";
      const snippet = typeof item.content === "string" ? item.content : "";
      out.push({ title, url: itemUrl, snippet });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Scrape une page (rendu JS) → markdown via Crawl4AI `/md`, ou `null` si l'appel échoue ou si la
 * réponse est inexploitable. Ne lève jamais : l'appelant bascule sur le seed (repli).
 */
export async function scrapePricingMarkdown(url: string, deps: ScrapeDeps): Promise<string | null> {
  const doFetch = deps.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), deps.timeoutMs ?? 30_000);

  try {
    const response = await doFetch(`${CRAWL4AI_BASE_URL}/md`, {
      method: "POST",
      headers: crawlHeaders(deps),
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const payload: unknown = await response.json();
    if (!isRecord(payload)) return null;
    const markdown = payload.markdown;
    return typeof markdown === "string" && markdown.length > 0 ? markdown : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Extrait le 1ᵉʳ objet JSON d'un texte LLM (tolère les fences ```json … ``` et le bavardage). */
function parseFirstJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced !== null ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Extraction **structurée** des vraies valeurs publiées sur une page vendor : Crawl4AI rend le
 * markdown, puis le LLM LOCAL (LiteLLM/Ollama via `callLLM`) en extrait un JSON conforme au `schema`
 * et au `prompt`. Renvoie l'objet (forme libre, à valider par l'appelant) ou `null` si une étape
 * échoue. Ne lève jamais : l'appelant réconcilie vs la baseline (garde-fou) et replie sur le seed.
 * DÉFCON 1 : aucune valeur inventée — si le LLM ne renvoie pas un JSON exploitable → `null` → seed.
 */
export async function scrapeStructuredJson(
  url: string,
  schema: Record<string, unknown>,
  prompt: string,
  deps: ScrapeDeps,
): Promise<unknown> {
  const markdown = await scrapePricingMarkdown(url, { ...deps, timeoutMs: deps.timeoutMs ?? 60_000 });
  if (markdown === null) return null;

  const system = [
    "Tu extrais des données STRICTEMENT présentes dans le contenu fourni. N'invente JAMAIS de valeur.",
    "Réponds UNIQUEMENT par un objet JSON conforme au schéma. Aucun texte hors du JSON.",
    `Consigne : ${prompt}`,
    `Schéma (JSON Schema) : ${JSON.stringify(schema)}`,
  ].join("\n");
  // Bornage : on ne passe que le début du markdown (les prix vendor sont en haut de page) — coût LLM maîtrisé.
  const user = markdown.slice(0, 12_000);

  const result = await callLLM(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { fetchImpl: deps.fetchImpl },
  );
  if (!result.ok) return null;
  return parseFirstJson(result.content);
}
