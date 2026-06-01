// Infra Health Score (IHS) — moteur de santé composite (F12 Monitoring, Lot 2 · C, S-079).
//
// Fonction PURE, signaux INJECTÉS (zéro I/O) : la collecte des métriques réelles (disponibilité,
// coût réel…) est branchée en aval (S-081 UI/persistance, S-082 coût réel). Ce module ne fait QUE
// composer un score et un statut à partir de sous-scores normalisés 0–100.
//
// i18n (S-058) : aucun libellé en dur — chaque sortie textuelle est un descripteur `Message`
// (namespace `Engine.monitoring.*`) résolu en fr/en/ar par la couche de présentation.
//
// DÉFCON 1 : poids et seuils ne sont pas « magiques » — ils sont documentés et justifiés dans
// docs/DECISIONS.md (ADR-021). Une dimension NON mesurée (signal absent) est EXCLUE du composite
// (jamais pénalisée par un zéro inventé) et signalée comme « non mesurée » — on ne fabrique pas un
// score qu'on n'a pas. Le composite reflète donc uniquement ce qui est réellement observé.

import { msg, type Message } from "@/lib/engine/message";

/**
 * Dimensions de santé d'une base mémorielle déployée. Chaque dimension reçoit un sous-score
 * normalisé 0–100 (ou est absente = non mesurée).
 */
export const HEALTH_DIMENSIONS = [
  "availability", // disponibilité des services (uptime / health-checks)
  "resilience", // sauvegarde & reprise en place et testées (spec n°1/2)
  "compliance", // actions de conformité traitées (diagnostics)
  "budget", // adhérence au budget (coût réel vs cible)
  "freshness", // fraîcheur des prix/veilles sourcés
  "drift", // conformité de la config déployée à la recommandation
] as const;
export type HealthDimension = (typeof HEALTH_DIMENSIONS)[number];

/** Statut dérivé d'un score par seuils (ADR-021). `unknown` = dimension non mesurée. */
export type HealthStatus = "ok" | "warn" | "critical" | "unknown";

/**
 * Poids relatifs des dimensions dans le composite (ADR-021). Hiérarchie justifiée : une base
 * INACCESSIBLE ou des DONNÉES PERDUES rendent tout le reste vain (availability/resilience = vital) ;
 * un risque JURIDIQUE est grave (compliance) ; le budget/fraîcheur/dérive dégradent la qualité sans
 * être vitaux. Aucune valeur n'est tirée au hasard : c'est une échelle ordinale assumée (±, révisable).
 */
const WEIGHTS: Record<HealthDimension, number> = {
  availability: 3,
  resilience: 2,
  compliance: 2,
  budget: 1,
  freshness: 1,
  drift: 1,
};

/** Seuils de statut sur un score 0–100 (ADR-021). */
const OK_THRESHOLD = 80;
const WARN_THRESHOLD = 50;

/** Signaux d'entrée : sous-score 0–100 par dimension. Une dimension absente = non mesurée. */
export type HealthInput = Partial<Record<HealthDimension, number>>;

export type HealthSubscore = {
  dimension: HealthDimension;
  /** Sous-score 0–100, ou `null` si la dimension n'est pas mesurée. */
  score: number | null;
  status: HealthStatus;
  weight: number;
  /** Libellé localisé de la dimension (descripteur i18n). */
  label: Message;
};

export type HealthReport = {
  /** IHS composite 0–100 (moyenne pondérée des dimensions MESURÉES), ou `null` si rien n'est mesuré. */
  score: number | null;
  status: HealthStatus;
  subscores: HealthSubscore[];
  /** Nombre de dimensions effectivement mesurées / total. */
  measured: number;
  total: number;
  /** Alertes (dimensions mesurées en `warn`/`critical`), descripteurs i18n. */
  alerts: Message[];
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/** Statut par seuils (ADR-021). `null` → `unknown` (non mesuré). Pur, total. */
export function healthStatus(score: number | null): HealthStatus {
  if (score === null) return "unknown";
  if (score >= OK_THRESHOLD) return "ok";
  if (score >= WARN_THRESHOLD) return "warn";
  return "critical";
}

/**
 * Calcule l'Infra Health Score à partir de signaux injectés. Pure et déterministe.
 * Composite = moyenne PONDÉRÉE des seules dimensions mesurées (les non mesurées sont exclues, jamais
 * comptées comme zéro). `score` arrondi à l'entier. Alertes = dimensions mesurées en warn/critical.
 */
export function computeHealthScore(input: HealthInput): HealthReport {
  const subscores: HealthSubscore[] = HEALTH_DIMENSIONS.map((dimension) => {
    const raw = input[dimension];
    const score = typeof raw === "number" ? clampScore(raw) : null;
    return {
      dimension,
      score,
      status: healthStatus(score),
      weight: WEIGHTS[dimension],
      label: msg(`monitoring.health.dimension.${dimension}`),
    };
  });

  const measured = subscores.filter((s) => s.score !== null);
  let composite: number | null = null;
  if (measured.length > 0) {
    const weightSum = measured.reduce((acc, s) => acc + s.weight, 0);
    const weighted = measured.reduce((acc, s) => acc + s.weight * (s.score ?? 0), 0);
    composite = Math.round(weighted / weightSum);
  }

  const alerts = measured
    .filter((s) => s.status === "warn" || s.status === "critical")
    .map((s) => msg("monitoring.health.alert", { dimension: s.dimension, status: s.status }));

  return {
    score: composite,
    status: healthStatus(composite),
    subscores,
    measured: measured.length,
    total: HEALTH_DIMENSIONS.length,
    alerts,
  };
}
