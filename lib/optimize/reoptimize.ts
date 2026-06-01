// Continuous Re-optimization (Lot 3 F15, S-086) — PUR.
//
// Quand une alternative deviendrait sensiblement moins chère À ISO-CONTRAINTES (souveraineté /
// conformité préservées, cf. S-072), on PROPOSE une migration — sur VALIDATION HUMAINE, jamais
// automatiquement. DÉFCON 1 : (1) on ne propose JAMAIS un candidat qui violerait une contrainte
// utilisateur (ex. hyperscaler quand la souveraineté est exigée) ; (2) on ne propose que si le gain
// dépasse un seuil (sinon migrer ne vaut pas la peine) ; (3) la proposition est sourcée et l'humain
// tranche. Les candidats sont INJECTÉS (la veille prix/catalogue les fournit en aval).

/** Contraintes dures à préserver lors de la re-optimisation (sous-ensemble de S-072). */
export type OptimizationConstraints = {
  /** Si vrai, seuls les candidats souverains sont éligibles (jamais d'hyperscaler imposé). */
  requireSovereign: boolean;
};

export type OptimizationCandidate = {
  label: string;
  monthlyCost: number;
  sovereign: boolean;
  source?: { url: string; checkedAt: string };
};

export type ReoptimizationProposal = {
  currentCost: number;
  candidate: OptimizationCandidate;
  /** Économie mensuelle estimée (€). */
  savingAbs: number;
  /** Économie relative (%) vs coût actuel. */
  savingPct: number;
  /** Toujours `true` : une proposition F15 requiert une validation humaine (rappel explicite). */
  requiresHumanValidation: true;
};

/** Seuil d'économie par défaut (%) sous lequel migrer ne vaut pas le coût de transition. */
export const DEFAULT_REOPT_THRESHOLD_PCT = 10;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Propose la meilleure re-optimisation à iso-contraintes, ou `null` si rien ne dépasse le seuil. Pure.
 * Filtre : contraintes préservées (souveraineté) ET coût strictement inférieur à l'actuel. Choisit le
 * moins cher ; ne renvoie une proposition que si l'économie ≥ `thresholdPct`. Jamais d'auto-application.
 */
export function proposeReoptimization(
  currentCost: number,
  candidates: readonly OptimizationCandidate[],
  constraints: OptimizationConstraints,
  thresholdPct: number = DEFAULT_REOPT_THRESHOLD_PCT,
): ReoptimizationProposal | null {
  if (currentCost <= 0) return null;
  const eligible = candidates.filter(
    (c) => (constraints.requireSovereign ? c.sovereign : true) && c.monthlyCost < currentCost,
  );
  if (eligible.length === 0) return null;

  const best = eligible.reduce((min, c) => (c.monthlyCost < min.monthlyCost ? c : min));
  const savingAbs = round2(currentCost - best.monthlyCost);
  const savingPct = round2((savingAbs / currentCost) * 100);
  if (savingPct < thresholdPct) return null;

  return { currentCost, candidate: best, savingAbs, savingPct, requiresHumanValidation: true };
}
