// Client serveur vers le proxy LiteLLM (S-034). PUR-ish : `fetch` injectable, JAMAIS throw → repli.
//
// Sécurité : `LITELLM_API_KEY` / `LITELLM_BASE_URL` lus côté serveur uniquement (jamais NEXT_PUBLIC,
// jamais dans le bundle client) ; la clé n'est jamais retournée ni journalisée. Le proxy est
// OpenAI-compatible (`POST /v1/chat/completions` → `choices[0].message.content`).

import type { LlmCallOptions, LlmMessage, LlmResult } from "./types";

const DEFAULT_MODEL = "deepseek-v4-flash"; // alias exposé par proxy.ai-mpower.com (override : LITELLM_MODEL)
const DEFAULT_TIMEOUT_MS = 30_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Extrait le contenu texte d'une réponse OpenAI-compatible, sans `as`/`any` (JSON inconnu). */
function extractContent(json: unknown): string | null {
  if (!isRecord(json)) return null;
  const { choices } = json;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first: unknown = choices[0];
  if (!isRecord(first) || !isRecord(first.message)) return null;
  const { content } = first.message;
  return typeof content === "string" ? content : null;
}

/**
 * Appelle le LLM via le proxy LiteLLM. Renvoie un `LlmResult` typé (jamais d'exception) : timeout,
 * 5xx, réseau KO ou configuration absente → `{ ok: false, reason }`, l'appelant replie (seed/texte).
 */
export async function callLLM(messages: LlmMessage[], opts: LlmCallOptions = {}): Promise<LlmResult> {
  const baseUrl = opts.baseUrl ?? process.env.LITELLM_BASE_URL ?? "";
  const apiKey = opts.apiKey ?? process.env.LITELLM_API_KEY ?? "";
  const model = opts.model ?? process.env.LITELLM_MODEL ?? DEFAULT_MODEL;
  if (baseUrl === "" || apiKey === "") {
    return { ok: false, reason: "Configuration LLM absente (LITELLM_BASE_URL / LITELLM_API_KEY)" };
  }

  const fetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages }),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, reason: `Proxy LLM indisponible (HTTP ${res.status})` };
    const json: unknown = await res.json();
    const content = extractContent(json);
    if (content === null) return { ok: false, reason: "Réponse LLM inattendue (contenu absent)" };
    return { ok: true, content };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "erreur réseau LLM" };
  } finally {
    clearTimeout(timer);
  }
}
