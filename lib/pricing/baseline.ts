// Snapshot de référence des figures de prix par couche (empreinte djb2 du jeu de
// figures nettoyé). Capturé via le price feed lui-même (script de capture), donc
// cohérent avec l'extracteur, jamais saisi à la main. `null` = pas encore de
// référence (le premier relevé l'établit).
//
// ⚠ Régénération : `node --experimental-strip-types scripts/capture-baseline.mts`
// (nécessite FIRECRAWL_API_KEY dans .env.local). Mettre à jour `capturedAt`.

export type PriceBaseline = { fingerprint: string | null; capturedAt: string };

export const PRICE_BASELINE: Record<number, PriceBaseline> = {
  1: { fingerprint: "16cf34a8", capturedAt: "2026-05-25" }, // Anthropic, 36 figures
  3: { fingerprint: null, capturedAt: "2026-05-25" }, // Qdrant, tarification à l'usage (0 figure fixe)
  4: { fingerprint: "40fe5678", capturedAt: "2026-05-25" }, // Mistral, 2 figures
  5: { fingerprint: "4c539c35", capturedAt: "2026-05-25" }, // Supabase, 29 figures
  6: { fingerprint: "129ffd2", capturedAt: "2026-05-25" }, // Scaleway, 184 figures
};

export function baselineForLayer(layerId: number): PriceBaseline {
  return PRICE_BASELINE[layerId] ?? { fingerprint: null, capturedAt: "" };
}
