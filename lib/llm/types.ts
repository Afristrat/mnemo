// Fondation LLM plateforme (spec n°3, S-034). Types du client serveur vers le proxy LiteLLM.
//
// Le LLM ne touche JAMAIS le calcul (DÉFCON 1) : il sert l'assistance (Q&A, intake, narration) et la
// proposition de candidats sourcés pour la reco vivante. `callLLM` ne throw jamais → l'appelant gère le
// repli (seed). Secrets (`LITELLM_*`) lus côté serveur uniquement, jamais dans le bundle client.

export type LlmRole = "system" | "user" | "assistant";
export type LlmMessage = { role: LlmRole; content: string };

/** Résultat d'un appel LLM : succès avec contenu, ou échec typé (jamais d'exception propagée). */
export type LlmResult = { ok: true; content: string } | { ok: false; reason: string };

/** Options d'appel. `baseUrl`/`apiKey` sont injectables pour les tests (défaut = `process.env.LITELLM_*`). */
export type LlmCallOptions = {
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  baseUrl?: string;
  apiKey?: string;
};
