// Dérivation des signaux de santé (F12, S-081) — PUR.
//
// Tant que les métriques d'EXPLOITATION réelles ne sont pas branchées (uptime, coût réel mesuré —
// S-082+), on dérive un sous-ensemble de signaux depuis ce que l'on connaît déjà : la RECOMMANDATION
// et le profil. Ce sont donc des signaux de « santé de CONCEPTION » (proxy), pas d'exploitation —
// honnêteté DÉFCON 1 : les dimensions non dérivables (availability, freshness runtime, drift) restent
// NON MESURÉES (absentes du `HealthInput`) plutôt que fabriquées. L'UI signale la couverture réelle.

import type { Budget, ScoreDimension } from "@/lib/engine";
import type { HealthInput } from "./health";

/** Plafond mensuel (€) par palier de budget. `gt2k` = pas de plafond explicite → adhérence neutre 100. */
const BUDGET_CAP: Record<Budget, number> = {
  lt50: 50,
  "50to200": 200,
  "200to500": 500,
  "500to2k": 2000,
  gt2k: Number.POSITIVE_INFINITY,
};

/** Score d'adhérence budgétaire 0–100 : 100 si le coût estimé tient dans le plafond, décroît au prorata sinon. */
function budgetScore(totalCost: number, budget: Budget): number {
  const cap = BUDGET_CAP[budget];
  if (!Number.isFinite(cap) || totalCost <= cap) return 100;
  if (totalCost <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((cap / totalCost) * 100)));
}

/**
 * Dérive des signaux de santé (0–100) à partir de la recommandation. Pure. Seules les dimensions
 * RÉELLEMENT dérivables sont renseignées : `resilience` et `compliance` (scores du radar, 0–10 → 0–100)
 * et `budget` (coût estimé vs plafond). `availability`/`freshness`/`drift` restent NON mesurés (signaux
 * d'exploitation à brancher en aval — S-082) → exclus du composite (DÉFCON 1, ADR-021).
 */
export function deriveHealthSignals(args: {
  scores: ScoreDimension[];
  totalCost: number;
  budget: Budget;
}): HealthInput {
  const scoreOf = (key: string): number | undefined => {
    const dim = args.scores.find((s) => s.key === key);
    return dim ? Math.round(dim.score * 10) : undefined;
  };
  const signals: HealthInput = { budget: budgetScore(args.totalCost, args.budget) };
  const resilience = scoreOf("resilience");
  if (resilience !== undefined) signals.resilience = resilience;
  const compliance = scoreOf("conf");
  if (compliance !== undefined) signals.compliance = compliance;
  return signals;
}
