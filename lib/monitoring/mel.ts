// Dispatch Deviation Guide — exploitation dégradée façon MEL (F12 Monitoring, Lot 2 · C, S-080).
//
// Inspiré de la Minimum Equipment List (aviation) : quand un « équipement » (ici une dimension de
// santé) est dégradé, le guide indique la CONDUITE À TENIR — exploitation dégradée permise + action
// corrective + verdict de dispatch (peut-on continuer d'exploiter, sous quelle condition, ou non).
//
// Fonction PURE : dérive du `HealthReport` (S-079), aucun I/O. Réutilise `HealthDimension`.
// i18n (S-058) : zéro prose — chaque sortie est un descripteur `Message` (`Engine.monitoring.mel.*`).
// DÉFCON 1 : les règles d'exploitation ne sont pas inventées au cas par cas — elles forment un
// catalogue documenté (ADR-022), raisonné par analogie MEL. Seules les dimensions DÉGRADÉES
// (warn/critical) produisent un item ; une dimension non mesurée ne génère aucune conduite (on ne
// recommande rien sur ce qu'on n'observe pas).

import { msg, type Message } from "@/lib/engine/message";
import { type HealthDimension, type HealthReport } from "./health";

/**
 * Verdict de dispatch (analogie MEL). Valeurs en camelCase = **sélecteurs ICU valides** (un tiret
 * casse un `{x, select, …}`, cf. règle du verdict) :
 *  - `goIf` : exploitation permise SOUS CONDITION (surveillance / mode dégradé encadré) ;
 *  - `noGo` : pas d'exploitation normale — bascule en mode protégé (lecture seule, gel des écritures,
 *    suspension du traitement concerné) jusqu'au rétablissement.
 */
export type MelDispatch = "goIf" | "noGo";

export type MelItem = {
  dimension: HealthDimension;
  status: "warn" | "critical";
  dispatch: MelDispatch;
  /** Conduite dégradée permise (par dimension), descripteur i18n. */
  guidance: Message;
  /** Action corrective à mener, descripteur i18n. */
  corrective: Message;
  /** Libellé du verdict de dispatch, descripteur i18n. */
  dispatchLabel: Message;
};

/**
 * Dimensions dont une dégradation CRITIQUE impose un `no-go` (mode protégé) : une base inaccessible
 * (availability), un risque de perte de données (resilience) ou une non-conformité avérée
 * (compliance) ne se « tolèrent » pas en exploitation normale. Les autres (budget/freshness/drift)
 * dégradent la qualité sans interdire l'exploitation → `go-if` (sous surveillance). Cf. ADR-022.
 */
const NO_GO_ON_CRITICAL: ReadonlySet<HealthDimension> = new Set<HealthDimension>([
  "availability",
  "resilience",
  "compliance",
]);

function dispatchFor(dimension: HealthDimension, status: "warn" | "critical"): MelDispatch {
  return status === "critical" && NO_GO_ON_CRITICAL.has(dimension) ? "noGo" : "goIf";
}

/**
 * Construit le guide de déviation à partir d'un rapport de santé (S-079). Pour chaque dimension
 * MESURÉE en `warn`/`critical`, émet un item MEL (conduite + correctif + dispatch). Pur, total,
 * déterministe ; ordre = celui des sous-scores du rapport (priorité de pondération préservée).
 */
export function deriveDeviationGuide(report: HealthReport): MelItem[] {
  const items: MelItem[] = [];
  for (const sub of report.subscores) {
    if (sub.status !== "warn" && sub.status !== "critical") continue;
    const status = sub.status;
    const dispatch = dispatchFor(sub.dimension, status);
    items.push({
      dimension: sub.dimension,
      status,
      dispatch,
      guidance: msg(`monitoring.mel.guidance.${sub.dimension}`),
      corrective: msg(`monitoring.mel.corrective.${sub.dimension}`),
      dispatchLabel: msg("monitoring.mel.dispatch", { dispatch }),
    });
  }
  return items;
}
