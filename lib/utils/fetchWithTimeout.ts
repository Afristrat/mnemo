// fetch borné par un timeout client (AbortController). Au-delà de `timeoutMs`, la requête est
// abandonnée et la promesse rejette (AbortError) → l'appelant retombe sur son repli. Évite qu'un
// appel live lent (narration LLM, veille catalogue, prix live) laisse la page `/resultats` en
// chargement perpétuel : chaque fetch a une borne de temps garantie. Compose avec un signal externe
// éventuel (annulation au démontage du composant) → la première des deux causes l'emporte.

/** Délai de repli par défaut (ms) pour les appels live de la vue résultats. */
export const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Propage une annulation externe (ex. cleanup d'effet React) vers notre controller.
  const external = init.signal;
  if (external !== null && external !== undefined) {
    if (external.aborted) controller.abort();
    else external.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
