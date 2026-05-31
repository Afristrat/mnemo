// Coût d'inférence LLM À L'USAGE (S-074) — tarifé au 1M de tokens (entrée + sortie), décision Amine.
// Lève la dette « LLM à l'usage non chiffré » (S-033/S-041) : on ne mélange plus l'inférence dans le
// forfait C6. Pure, déterministe, prix INJECTÉS (zéro import lib/pricing) ; défaut neutre → coût 0
// (invariant `totalCost` préservé, comme compute/media). Les vrais prix sourcés viennent du seed
// `lib/pricing/llm-token-seed` (devises natives + FX) ou de la veille live.
//
// ANTI DOUBLE-COMPTAGE : si l'inférence est AUTO-HÉBERGÉE (preset HARD on-prem, ou préférence
// souveraineté), les tokens tournent sur le GPU/compute SOUVERAIN déjà chiffré → coût à l'usage = 0
// (on l'expose quand même en estimation de volume). Sinon (API), coût = tokens × prix/1M.

import type { CostSource, Preset, Profile, ReqPerDay } from "./types";

/** Prix d'un modèle au 1M de tokens, déjà normalisé en € (le seed convertit depuis les devises natives). */
export type LlmTokenPrice = {
  model: string;
  inputPerMillionEur: number;
  outputPerMillionEur: number;
  sovereignty: "sovereign" | "eu-hosted" | "api-third-party";
  source: CostSource;
};

/** Table de prix LLM (multi-segment, pas de référent unique) : modèle API par défaut + alternatives sourcées. */
export type LlmTokenPrices = {
  /** Modèle facturé en mode API (la plateforme route par défaut sur le moins cher souverain-compatible). */
  defaultApi: LlmTokenPrice;
  /** Autres options sourcées (UE souverain, hyperscaler) — transparence + comparaison, jamais imposées. */
  options: LlmTokenPrice[];
};

export const NEUTRAL_LLM_PRICES: LlmTokenPrices = {
  defaultApi: {
    model: "neutral",
    inputPerMillionEur: 0,
    outputPerMillionEur: 0,
    sovereignty: "sovereign",
    source: { label: "neutre", url: "", checkedAt: "" },
  },
  options: [],
};

// Hypothèses de consommation par requête RAG (±30 %, comme les facteurs de sizing) : contexte récupéré
// + système + question en ENTRÉE ; réponse générée en SORTIE. Modélisation, jamais un prix.
const REQ_PER_DAY_COUNT: Record<ReqPerDay, number> = { lt100: 50, lt1k: 500, lt10k: 5000, gt10k: 20000 };
const TOKENS_IN_PER_REQUEST = 2500;
const TOKENS_OUT_PER_REQUEST = 600;
const DAYS_PER_MONTH = 30;

export type LlmUsage = {
  monthlyTokensIn: number;
  monthlyTokensOut: number;
  /** Coût mensuel € (0 si auto-hébergé : inférence déjà comptée dans le compute/GPU souverain). */
  monthlyCost: number;
  /** Modèle tarifé (mode API) ou `null` si auto-hébergé. */
  pricedModel: string | null;
  selfHosted: boolean;
  /** Source du prix retenu (DÉFCON 1) ou `null` si auto-hébergé / neutre. */
  source: CostSource | null;
};

/** Inférence auto-hébergée : preset HARD (on-prem) ou préférence souveraineté → sur GPU/compute compté. */
function isSelfHostedLlm(profile: Profile, preset: Preset): boolean {
  return preset === "HARD" || profile.preferSovereign === true;
}

/** Volume de tokens mensuel estimé (entrée/sortie) depuis le débit de requêtes. Pure. */
export function estimateLlmUsage(profile: Profile): { monthlyTokensIn: number; monthlyTokensOut: number } {
  const reqMonth = REQ_PER_DAY_COUNT[profile.reqPerDay] * DAYS_PER_MONTH;
  return {
    monthlyTokensIn: reqMonth * TOKENS_IN_PER_REQUEST,
    monthlyTokensOut: reqMonth * TOKENS_OUT_PER_REQUEST,
  };
}

/**
 * Coût d'inférence LLM à l'usage. Auto-hébergé → 0 (anti double-comptage avec le compute souverain).
 * Sinon (API) : tokens × prix/1M du modèle par défaut. Prix INJECTÉS (défaut neutre → 0). Pure.
 */
export function costLlmUsage(profile: Profile, preset: Preset, prices: LlmTokenPrices = NEUTRAL_LLM_PRICES): LlmUsage {
  const { monthlyTokensIn, monthlyTokensOut } = estimateLlmUsage(profile);
  if (isSelfHostedLlm(profile, preset)) {
    return { monthlyTokensIn, monthlyTokensOut, monthlyCost: 0, pricedModel: null, selfHosted: true, source: null };
  }
  const p = prices.defaultApi;
  const monthlyCost = Math.round(
    (monthlyTokensIn / 1_000_000) * p.inputPerMillionEur + (monthlyTokensOut / 1_000_000) * p.outputPerMillionEur,
  );
  return {
    monthlyTokensIn,
    monthlyTokensOut,
    monthlyCost,
    pricedModel: p.model,
    selfHosted: false,
    source: monthlyCost > 0 ? p.source : null,
  };
}
