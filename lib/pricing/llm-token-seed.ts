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
  /** Date du relevé de CE modèle (YYYY-MM-DD). Défaut `CHECKED_AT` ; précisée quand vérifiée à une autre date. */
  checkedAt?: string;
};

const CHECKED_AT = "2026-05-31";

// Modèle routé par défaut par le proxy LiteLLM (le moins cher, open-weights auto-hébergeable).
const DEEPSEEK_DEFAULT: SeedEntry = {
  model: "DeepSeek V4 Flash",
  usdInputPerM: 0.14,
  usdOutputPerM: 0.28,
  sovereignty: "sovereign",
  url: "https://api-docs.deepseek.com/quick_start/pricing",
};
// UE souverain (Mistral) — aussi affiché en per-1M dans le panneau de fraîcheur (couche C4, S-074).
const MISTRAL_SMALL: SeedEntry = {
  model: "Mistral Small 4",
  usdInputPerM: 0.1,
  usdOutputPerM: 0.3,
  sovereignty: "eu-hosted",
  url: "https://mistral.ai/pricing",
};
const MISTRAL_LARGE: SeedEntry = {
  model: "Mistral Large 3",
  usdInputPerM: 0.5,
  usdOutputPerM: 1.5,
  sovereignty: "eu-hosted",
  url: "https://mistral.ai/pricing",
};
const OPENAI_MINI: SeedEntry = {
  model: "OpenAI GPT-5 mini",
  usdInputPerM: 0.25,
  usdOutputPerM: 2.0,
  sovereignty: "api-third-party",
  url: "https://openai.com/api/pricing/",
};
// Anthropic Claude Sonnet 4.6 (surface MCP C1 + escalade T2 C2 du catalogue) — relevé page officielle
// le 2026-06-01 : 3 $/1M en entrée, 15 $/1M en sortie. Aussi affiché en per-1M dans le panneau (couche C1).
const ANTHROPIC_SONNET: SeedEntry = {
  model: "Claude Sonnet 4.6",
  usdInputPerM: 3,
  usdOutputPerM: 15,
  sovereignty: "api-third-party",
  url: "https://platform.claude.com/docs/en/about-claude/pricing",
  checkedAt: "2026-06-01",
};

const SEED: { default: SeedEntry; options: SeedEntry[] } = {
  default: DEEPSEEK_DEFAULT,
  options: [MISTRAL_SMALL, MISTRAL_LARGE, OPENAI_MINI, ANTHROPIC_SONNET],
};

/**
 * Prix tokens NATIFS (USD/1M, entrée/sortie) des modèles LLM suivis par le panneau de fraîcheur
 * (S-074) — affichés tels quels (« entrée $X/1M · sortie $Y/1M ») au lieu de l'empreinte brute scrappée.
 * Référence unique (mêmes entrées que le seed). Les vendeurs d'infra ne sont pas concernés.
 */
export type LlmTokenUsd = { model: string; inputPerMillionUsd: number; outputPerMillionUsd: number; url: string; checkedAt: string };
function tokenUsdOf(e: SeedEntry): LlmTokenUsd {
  return {
    model: e.model,
    inputPerMillionUsd: e.usdInputPerM,
    outputPerMillionUsd: e.usdOutputPerM,
    url: e.url,
    checkedAt: e.checkedAt ?? CHECKED_AT,
  };
}
export const LLM_FRESHNESS_TOKEN_USD: Record<"anthropic" | "mistral", LlmTokenUsd> = {
  anthropic: tokenUsdOf(ANTHROPIC_SONNET),
  mistral: tokenUsdOf(MISTRAL_SMALL),
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
    source: { label: `Prix tokens — ${e.model}`, url: e.url, checkedAt: e.checkedAt ?? CHECKED_AT },
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
