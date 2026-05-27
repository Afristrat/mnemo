// Logique PURE du budget-mètre (S-020) : compare le coût mensuel d'infra (variable, ±30 %) au
// budget déclaré, et, en cas de tension, pointe la cause DOMINANTE + propose UN levier.
// Ne touche JAMAIS au prix de vente du service (spec §8). Testable sans UI.

import type { Budget, Sizing } from "@/lib/engine";

export type BudgetStatus = "ok" | "warn" | "over";

/** Plafond mensuel (€) par palier de budget, borne haute du palier ; gt2k = pas de plafond pratique. */
const BUDGET_CEILING: Record<Budget, number> = {
  lt50: 50,
  "50to200": 200,
  "200to500": 500,
  "500to2k": 2000,
  gt2k: Number.POSITIVE_INFINITY,
};

export type BudgetEval = {
  status: BudgetStatus;
  ceiling: number;
  /** Part du plafond consommée (0–1+), pour la jauge. */
  ratio: number;
  /** Cause dominante du coût (factuelle). Pertinente surtout en warn/over. */
  cause: string;
  /** Un levier concret pour revenir dans le budget (jamais « payez plus »). */
  lever: string;
};

/**
 * Évalue le budget : vert (`ok`, ≤ 80 % du plafond), jaune (`warn`, ≤ 100 %), rouge (`over`, > 100 %).
 * La cause dominante distingue le GPU souverain (typiquement la génération), le coût à l'usage des
 * API médias, ou la stack de base. Pur et déterministe.
 */
export function evaluateBudget(totalCost: number, budget: Budget, sizing: Sizing): BudgetEval {
  const ceiling = BUDGET_CEILING[budget];
  const ratio = ceiling === Number.POSITIVE_INFINITY ? 0 : totalCost / ceiling;
  const status: BudgetStatus = totalCost <= ceiling * 0.8 ? "ok" : totalCost <= ceiling ? "warn" : "over";

  const gpu = sizing.gpu.monthlyCost;
  const api = sizing.workloads.reduce((sum, w) => sum + w.monthlyCost, 0);
  const media = gpu + api;

  let cause: string;
  let lever: string;
  if (media <= 0) {
    cause = "La stack de base (preset choisi) porte l'essentiel du coût.";
    lever = "Alléger le preset (revoir sensibilité, audit, modules) ou relever le budget.";
  } else if (gpu >= api) {
    cause = `Le pool GPU souverain (${gpu} €/mois) domine, typiquement la génération de médias.`;
    lever = "Passer la génération concernée en API 💳, réduire le volume/palier, ou ne pas générer.";
  } else {
    cause = `Le coût à l'usage des API médias (${api} €/mois) domine.`;
    lever = "Réduire le volume/palier de ces usages, ou les exécuter en souverain 🟢 si le volume est élevé.";
  }

  return { status, ceiling, ratio, cause, lever };
}
