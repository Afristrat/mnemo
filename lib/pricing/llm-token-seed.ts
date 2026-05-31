// Seed des prix d'inférence LLM au 1M de tokens (S-074) — devises NATIVES (USD) + étage FX→€ au
// runtime (réutilise le taux BCE daté `SEED_USD_TO_EUR`, comme les médias S-017). Doctrine
// `prix-jamais-hardcodes` : ce seed est un REPLI DATÉ + sourcé (URL + date + confiance), à rafraîchir
// par la veille (la veille tokens live = extension future, même pattern que la veille catalogue/prix).
// Multi-segment (pas de référent unique, retour Amine) : souverain-compatible (DeepSeek, défaut proxy)
// + UE souverain (Mistral) + hyperscaler repère (OpenAI). Le moteur reçoit les prix DÉJÀ en € (injectés).

import type { LlmTokenPrice, LlmTokenPrices } from "@/lib/engine";
import { SEED_USD_TO_EUR } from "./media-seed";

// Prix officiels relevés le 2026-05-31 (pages vendor), en USD/1M tokens (cache-miss). Confiance medium :
// source officielle récente, mais volatile (promos, révisions) → à confirmer par la veille.
type SeedEntry = {
  model: string;
  usdInputPerM: number;
  usdOutputPerM: number;
  sovereignty: LlmTokenPrice["sovereignty"];
  url: string;
};

const CHECKED_AT = "2026-05-31";

const SEED: { default: SeedEntry; options: SeedEntry[] } = {
  // Modèle routé par défaut par le proxy LiteLLM (le moins cher, open-weights auto-hébergeable).
  default: {
    model: "DeepSeek V4 Flash",
    usdInputPerM: 0.14,
    usdOutputPerM: 0.28,
    sovereignty: "sovereign",
    url: "https://api-docs.deepseek.com/quick_start/pricing",
  },
  options: [
    {
      model: "Mistral Small 4",
      usdInputPerM: 0.1,
      usdOutputPerM: 0.3,
      sovereignty: "eu-hosted",
      url: "https://mistral.ai/pricing",
    },
    {
      model: "Mistral Large 3",
      usdInputPerM: 0.5,
      usdOutputPerM: 1.5,
      sovereignty: "eu-hosted",
      url: "https://mistral.ai/pricing",
    },
    {
      model: "OpenAI GPT-5 mini",
      usdInputPerM: 0.25,
      usdOutputPerM: 2.0,
      sovereignty: "api-third-party",
      url: "https://openai.com/api/pricing/",
    },
  ],
};

/** Arrondit à 4 décimales (prix au 1M, petits montants). */
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function toEur(e: SeedEntry, rate: number): LlmTokenPrice {
  return {
    model: e.model,
    inputPerMillionEur: round4(e.usdInputPerM * rate),
    outputPerMillionEur: round4(e.usdOutputPerM * rate),
    sovereignty: e.sovereignty,
    source: { label: `Prix tokens — ${e.model}`, url: e.url, checkedAt: CHECKED_AT },
  };
}

/**
 * Table de prix LLM normalisée en € (FX appliqué). `rate` = USD→EUR (défaut : taux BCE daté du seed ;
 * la veille FX live le rafraîchira, comme les médias). Modèle API par défaut = DeepSeek V4 Flash.
 */
export function getLlmTokenPrices(rate: number = SEED_USD_TO_EUR): LlmTokenPrices {
  return {
    defaultApi: toEur(SEED.default, rate),
    options: SEED.options.map((e) => toEur(e, rate)),
  };
}
