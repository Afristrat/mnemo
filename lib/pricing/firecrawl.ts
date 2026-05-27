// Client Firecrawl minimal (côté serveur uniquement) pour le price feed (F4).
// On utilise `fetch` natif (Node 18+/Next) plutôt que le SDK : zéro dépendance,
// `fetchImpl` injectable pour les tests. La clé n'est jamais exposée au client.

const FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v2/scrape";

export type ScrapeDeps = {
  apiKey: string | undefined;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

type FirecrawlScrapeResponse = {
  success?: boolean;
  data?: { markdown?: string };
};

type FirecrawlJsonResponse = {
  success?: boolean;
  data?: { json?: unknown };
};

/**
 * Scrape une page (rendu JS) et renvoie son markdown, ou `null` si la clé manque,
 * si l'appel échoue ou si la réponse est inexploitable. Ne lève jamais : l'appelant
 * bascule alors sur le seed (repli).
 */
export async function scrapePricingMarkdown(url: string, deps: ScrapeDeps): Promise<string | null> {
  if (deps.apiKey === undefined || deps.apiKey.length === 0) return null;

  const doFetch = deps.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), deps.timeoutMs ?? 30_000);

  try {
    const response = await doFetch(FIRECRAWL_SCRAPE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${deps.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const payload: FirecrawlScrapeResponse = await response.json();
    if (payload.success !== true) return null;

    const markdown = payload.data?.markdown;
    return markdown !== undefined && markdown.length > 0 ? markdown : null;
  } catch {
    // Réseau, timeout, JSON invalide → repli sur le seed.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Extraction **structurée** (Firecrawl `format json` + schéma/`prompt` → LLM) des vraies valeurs
 * publiées sur une page vendor (mode `recommend`-injectable, S-025). Renvoie l'objet `data.json`
 * (forme libre, à valider par l'appelant) ou `null` si la clé manque, si l'appel échoue ou si la
 * réponse est inexploitable. Ne lève jamais : l'appelant réconcilie vs la baseline (garde-fou) et
 * bascule sur le seed au besoin. L'extraction LLM est plus lente que le scrape markdown → timeout
 * par défaut plus large.
 */
export async function scrapeStructuredJson(
  url: string,
  schema: Record<string, unknown>,
  prompt: string,
  deps: ScrapeDeps,
): Promise<unknown> {
  if (deps.apiKey === undefined || deps.apiKey.length === 0) return null;

  const doFetch = deps.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), deps.timeoutMs ?? 90_000);

  try {
    const response = await doFetch(FIRECRAWL_SCRAPE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${deps.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, formats: [{ type: "json", prompt, schema }], onlyMainContent: true }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const payload: FirecrawlJsonResponse = await response.json();
    if (payload.success !== true) return null;

    return payload.data?.json ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
