// Contrôle de fraîcheur des pages source des prix médias (S-017) — SERVEUR UNIQUEMENT.
//
// Extrait de `media-feed.ts` en S-078 : ce module importe le scraper (qui lit des tokens serveur
// SEARXNG/CRAWL4AI), donc il porte le garde-fou `server-only`. `media-feed.ts` reste ainsi PUR et
// importable par les Client Components (Wizard, ResultsView…) sans tirer le scraper dans le bundle.
//
// `refreshMediaPriceFreshness` vérifie seulement que chaque page source est joignable (`verified`)
// ou non (`unavailable`) ; elle NE ré-extrait JAMAIS un prix dérivé (toute revue de valeur est
// manuelle, DÉFCON 1). Repli (clé absente / réseau) → `unavailable`, jamais de throw.

import "server-only";
import { mediaPriceSources } from "./media-feed";
import { scrapePricingMarkdown } from "./scraper";

export type MediaPriceFreshness = {
  label: string;
  url: string;
  status: "verified" | "unavailable";
  checkedAt: string;
};

function isoDate(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export async function refreshMediaPriceFreshness(deps: {
  apiKey: string | undefined;
  fetchImpl?: typeof fetch;
  now?: () => number;
}): Promise<MediaPriceFreshness[]> {
  const nowMs = (deps.now ?? ((): number => Date.now()))();
  const checkedAt = isoDate(nowMs);
  return Promise.all(
    mediaPriceSources().map(async (s) => {
      const markdown = await scrapePricingMarkdown(s.url, { apiKey: deps.apiKey, fetchImpl: deps.fetchImpl });
      return { label: s.label, url: s.url, status: markdown === null ? "unavailable" : "verified", checkedAt };
    }),
  );
}
