// Fiduciary Mode (F8, moat ②) : charte fiduciaire. Principe : Strate agit dans le seul intérêt du
// client. Zéro commission vendor cachée (leçon Flipper, cf. docs/MOAT-HUNT.md).
//
// i18n (S-059, résiduel) : le CONTENU (titre, intro, modèle de revenu, engagements) vit dans le
// namespace `Fiduciaire` des catalogues fr/en (source unique, partagée par la page /fiduciaire ET le
// livrable export). Ce module ne porte plus que la STRUCTURE : l'ordre des engagements (clés) + la date.

/** Engagements de la charte, dans l'ordre d'affichage. Chaque clé → `Fiduciaire.commitment.<clé>.{title,detail}`. */
export const FIDUCIARY_COMMITMENT_KEYS = [
  "noCommission",
  "openRecipe",
  "sourcedPrices",
  "sovereigntyFirst",
  "noActionOnAccounts",
] as const;

export type FiduciaryCommitmentKey = (typeof FIDUCIARY_COMMITMENT_KEYS)[number];

/** Date de dernière révision de la charte (donnée, pas de la prose à localiser). */
export const FIDUCIARY_LAST_UPDATED = "2026-05-25";
