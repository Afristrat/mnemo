// Collecte du coût réel & écart vs estimé (F13 Network actif, Lot 2 · D, S-082) — PUR.
//
// L'utilisateur (consentement opt-in F9) déclare son coût RÉEL par poste ; on le compare à l'ESTIMÉ
// du moteur → écart par poste + écart total + flag hors tolérance. Aucune I/O ici (la persistance et
// le consentement sont gérés en aval). DÉFCON 1 : l'écart est un FAIT chiffré (estimé vs réel), jamais
// un jugement ; la tolérance ±30 % est la même hypothèse assumée que partout dans le projet.

/** Tolérance par défaut (%) : cohérente avec le ±30 % assumé des coûts (ADR pricing). */
export const DEFAULT_TOLERANCE_PCT = 30;

/** Saisie d'un poste : libellé + coût estimé (moteur) + coût réel (déclaré par l'utilisateur). */
export type RealCostEntry = {
  poste: string;
  estimated: number;
  real: number;
};

export type PostStatus = "within" | "over" | "under";

export type PostComparison = {
  poste: string;
  estimated: number;
  real: number;
  /** Écart absolu (réel − estimé), en €. */
  deltaAbs: number;
  /** Écart relatif (%) vs estimé ; 0 si estimé = 0 et réel = 0 ; 100 si estimé = 0 et réel > 0. */
  deltaPct: number;
  status: PostStatus;
};

export type CostComparison = {
  posts: PostComparison[];
  totalEstimated: number;
  totalReal: number;
  totalDeltaPct: number;
  /** `true` si l'écart TOTAL reste dans la tolérance (|deltaPct| ≤ tolérance). */
  withinTolerance: boolean;
  tolerancePct: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Écart relatif (%) robuste au diviseur nul. Pur. */
function pctDelta(estimated: number, real: number): number {
  if (estimated === 0) return real === 0 ? 0 : 100;
  return round2(((real - estimated) / estimated) * 100);
}

function statusOf(deltaPct: number, tolerancePct: number): PostStatus {
  if (deltaPct > tolerancePct) return "over";
  if (deltaPct < -tolerancePct) return "under";
  return "within";
}

/**
 * Compare coûts réels et estimés (pur, déterministe). Chaque poste reçoit son écart absolu/relatif et
 * un statut (within/over/under) selon la tolérance ; le total agrège et flag le dépassement global.
 */
export function compareRealVsEstimated(
  entries: readonly RealCostEntry[],
  tolerancePct: number = DEFAULT_TOLERANCE_PCT,
): CostComparison {
  const posts: PostComparison[] = entries.map((e) => {
    const deltaPct = pctDelta(e.estimated, e.real);
    return {
      poste: e.poste,
      estimated: e.estimated,
      real: e.real,
      deltaAbs: round2(e.real - e.estimated),
      deltaPct,
      status: statusOf(deltaPct, tolerancePct),
    };
  });
  const totalEstimated = round2(entries.reduce((acc, e) => acc + e.estimated, 0));
  const totalReal = round2(entries.reduce((acc, e) => acc + e.real, 0));
  const totalDeltaPct = pctDelta(totalEstimated, totalReal);
  return {
    posts,
    totalEstimated,
    totalReal,
    totalDeltaPct,
    withinTolerance: Math.abs(totalDeltaPct) <= tolerancePct,
    tolerancePct,
  };
}
