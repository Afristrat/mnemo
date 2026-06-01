// Recalibration continue (F13 Network actif, Lot 2 · D, S-083) — PUR.
//
// Le moat ③ passe de « rails » à « actif » : les écarts coût réel/estimé (S-082), agrégés et
// ANONYMISÉS sur les membres consentants, permettent de PROPOSER un ajustement des baselines de coût.
//
// Garde-fous DÉFCON 1 (plus stricts que pour un simple calcul) :
//  1. Jamais d'auto-application : la sortie est une PROPOSITION tracée — un humain valide avant toute
//     modification d'un seed daté/sourcé (cohérent avec « jamais graver une décision périssable »).
//  2. Pas de recalibration sur échantillon insuffisant : sous `minObservations`, `adopt = false`
//     (confiance `low`) — on ne recalibre pas sur 2 points.
//  3. Médiane (robuste aux valeurs aberrantes), pas moyenne ; dispersion exposée pour la transparence.

/** Une observation d'écart pour un poste (issue de real_cost_entries, anonymisée). */
export type DeltaObservation = {
  poste: string;
  /** Écart relatif réel vs estimé (%), tel que calculé en S-082. */
  deltaPct: number;
};

export type RecalibrationProposal = {
  poste: string;
  /** Nombre d'observations agrégées pour ce poste. */
  observations: number;
  /** Médiane des écarts (%) — base de l'ajustement proposé. */
  medianDeltaPct: number;
  /** Écart interquartile (étendue) en points de % — indicateur de dispersion/consensus. */
  spreadPct: number;
  /** Facteur multiplicatif suggéré pour la baseline (1 + médiane/100). */
  suggestedFactor: number;
  confidence: "low" | "medium" | "high";
  /** `true` SEULEMENT si l'échantillon est suffisant ET cohérent → candidat à validation humaine. */
  adopt: boolean;
};

export type RecalibrationOptions = {
  /** Nombre minimal d'observations sous lequel on ne propose RIEN d'adoptable (défaut 5). */
  minObservations?: number;
  /** Dispersion maximale (IQR en points de %) au-delà de laquelle on ne propose pas l'adoption (défaut 40). */
  maxSpreadPct?: number;
};

const DEFAULT_MIN_OBS = 5;
const DEFAULT_MAX_SPREAD = 40;

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Étendue interquartile (Q3 − Q1) — robuste, mesure le consensus des écarts. */
function iqr(sorted: number[]): number {
  const n = sorted.length;
  if (n < 2) return 0;
  const q = (p: number): number => {
    const idx = Math.min(n - 1, Math.max(0, Math.round(p * (n - 1))));
    return sorted[idx];
  };
  return q(0.75) - q(0.25);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function confidenceFor(observations: number): "low" | "medium" | "high" {
  if (observations >= 30) return "high";
  if (observations >= 10) return "medium";
  return "low";
}

/**
 * Propose une recalibration par poste à partir d'observations d'écart agrégées. Pure et déterministe.
 * `adopt` n'est `true` que si l'échantillon est suffisant (≥ minObservations) ET cohérent (dispersion
 * ≤ maxSpreadPct) — sinon proposition affichée mais NON adoptable (DÉFCON 1 : l'humain tranche, on ne
 * grave jamais un seed sourcé sur un signal faible). Ordre stable : ordre d'apparition des postes.
 */
export function computeRecalibration(
  observations: readonly DeltaObservation[],
  options: RecalibrationOptions = {},
): RecalibrationProposal[] {
  const minObs = options.minObservations ?? DEFAULT_MIN_OBS;
  const maxSpread = options.maxSpreadPct ?? DEFAULT_MAX_SPREAD;

  const byPoste = new Map<string, number[]>();
  const order: string[] = [];
  for (const obs of observations) {
    const list = byPoste.get(obs.poste);
    if (list) list.push(obs.deltaPct);
    else {
      byPoste.set(obs.poste, [obs.deltaPct]);
      order.push(obs.poste);
    }
  }

  return order.map((poste): RecalibrationProposal => {
    const sorted = [...(byPoste.get(poste) ?? [])].sort((a, b) => a - b);
    const med = round2(median(sorted));
    const spread = round2(iqr(sorted));
    const confidence = confidenceFor(sorted.length);
    const adopt = sorted.length >= minObs && spread <= maxSpread;
    return {
      poste,
      observations: sorted.length,
      medianDeltaPct: med,
      spreadPct: spread,
      suggestedFactor: round2(1 + med / 100),
      confidence,
      adopt,
    };
  });
}
