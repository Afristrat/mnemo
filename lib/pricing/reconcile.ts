// Garde-fou DÉFCON 1 du price feed LIVE (S-025).
//
// Une extraction structurée (LLM) peut dérailler : observé en conditions réelles, la page
// d'agrégat GPU Scaleway renvoie « 0 € » pour un H100 qui vaut 2,73 €/h (prix chargé
// dynamiquement). On ne peut donc JAMAIS injecter une valeur live aveuglément. Cette fonction
// confronte chaque valeur live à la **baseline sourcée** (seed) : promue seulement si plausible,
// sinon rejetée au profit de la baseline avec un drapeau « à revérifier ».
//
// Pure et déterministe, aucune dépendance réseau ni UI. C'est ici que se joue la fiabilité.

import type { Confidence } from "@/components/ui/StatusDot";

/**
 * - `live`     : valeur extraite en direct, jugée plausible (dans la bande) → injectée.
 * - `flagged`  : valeur live présente mais aberrante (hors bande / ≤ 0) → baseline conservée, à revérifier.
 * - `fallback` : pas de valeur live (Firecrawl indisponible) → baseline conservée (dernier relevé).
 */
export type PriceStatus = "live" | "flagged" | "fallback";

export type Reconciled = {
  amount: number;
  status: PriceStatus;
  confidence: Confidence;
  note?: string;
};

/** Bande de plausibilité par défaut autour de la baseline (±60 %). Bloque 0 €, ×10, erreurs d'unité. */
export const DEFAULT_TOLERANCE = 0.6;

/**
 * Réconcilie une valeur live avec la baseline sourcée (garde-fou DÉFCON 1).
 *
 * @param live               valeur extraite en direct (ou `null` si extraction indisponible).
 * @param baselineAmount     valeur sourcée de repli (seed).
 * @param baselineConfidence confiance de la baseline (conservée en repli).
 * @param tolerance          demi-largeur relative de la bande de plausibilité (def. ±60 %).
 */
export function reconcilePrice(
  live: number | null,
  baselineAmount: number,
  baselineConfidence: Confidence,
  tolerance: number = DEFAULT_TOLERANCE,
): Reconciled {
  if (live === null || !Number.isFinite(live)) {
    return { amount: baselineAmount, status: "fallback", confidence: baselineConfidence };
  }

  // Poste gratuit par conception (palier `none`, embeddings self-hostés) : un live > 0 est suspect.
  if (baselineAmount <= 0) {
    return live <= 0
      ? { amount: baselineAmount, status: "live", confidence: baselineConfidence }
      : {
          amount: baselineAmount,
          status: "flagged",
          confidence: "low",
          note: "Valeur live inattendue sur un poste gratuit, baseline conservée.",
        };
  }

  const ratio = live / baselineAmount;
  const within = live > 0 && ratio >= 1 - tolerance && ratio <= 1 + tolerance;
  if (within) {
    return { amount: live, status: "live", confidence: "high" };
  }
  return {
    amount: baselineAmount,
    status: "flagged",
    confidence: "low",
    note: `Valeur live (${live}) hors bande vs baseline (${baselineAmount}), extraction jugée non fiable, baseline conservée.`,
  };
}
