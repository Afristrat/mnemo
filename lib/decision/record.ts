// Decision Record opposable (moat « chaîne de preuve », vague 2 #1) — builder PUR.
//
// À chaque recommandation, on FIGE un dossier de décision : la décision retenue (preset + raison +
// coût + scores), les ALTERNATIVES ÉCARTÉES (les membres de l'ensemble, que le moteur calcule déjà mais
// jette), les TENSIONS exposées (accord de l'ensemble, risques, conflit de résidence) et les SOURCES
// datées. Horodaté + rejouable (profil encodé). Couplé à un hash d'intégrité (lib/decision/integrity),
// il devient un artefact OPPOSABLE : un tiers (auditeur, comité, régulateur) peut vérifier qu'il n'a pas
// été altéré et rejouer la reco à l'identique. DÉFCON 1 : aucune donnée fabriquée — pure agrégation de
// ce que le moteur a produit. La prose i18n est résolue en chaînes (le dossier est figé dans une langue).

import { formatPresetReason } from "@/lib/engine/preset";
import { encodeProfileToParam } from "@/lib/share";
import type { EngineResolver } from "@/lib/engine/message";
import type { Ensemble, EnsembleAgreement } from "@/lib/engine/ensemble";
import type { Preset, Profile } from "@/lib/engine";

export const DECISION_RECORD_VERSION = 1;

/** Une alternative considérée puis écartée (un membre de l'ensemble). */
export type DecisionAlternative = {
  id: string;
  label: string;
  intent: string;
  assumptions: string[];
  preset: Preset;
  monthlyCost: number;
  scoreAvg: number;
};

export type DecisionRecord = {
  version: number;
  /** Date de génération (ISO) — injectée (le builder reste pur/déterministe). */
  generatedAt: string;
  /** Profil encodé → rejeu à l'identique de la recommandation. */
  profileEncoded: string;
  decision: {
    preset: Preset;
    reason: string;
    monthlyCost: number;
    costLow: number;
    costHigh: number;
    setupCost: number;
    scoreAvg: number;
  };
  scores: { key: string; label: string; value: number }[];
  alternatives: DecisionAlternative[];
  tensions: {
    agreement: EnsembleAgreement;
    costSpreadPct: number;
    risks: string[];
    residencyConflict: string | null;
  };
  sources: { label: string; url: string; date: string }[];
};

function round(n: number): number {
  return Math.round(n);
}

/**
 * Construit le dossier de décision à partir de l'ensemble (décision = baseline, alternatives = variants)
 * et du profil de référence. Pur : `generatedAt` et `resolve` sont injectés. La fourchette ±30 % reflète
 * l'incertitude assumée du chiffrage.
 */
export function buildDecisionRecord(args: {
  profile: Profile;
  ensemble: Ensemble;
  generatedAt: string;
  resolve: EngineResolver;
}): DecisionRecord {
  const { ensemble, resolve } = args;
  const base = ensemble.baseline;
  return {
    version: DECISION_RECORD_VERSION,
    generatedAt: args.generatedAt,
    profileEncoded: encodeProfileToParam(args.profile),
    decision: {
      preset: base.preset,
      reason: formatPresetReason(base.presetReason, resolve),
      monthlyCost: round(base.totalCost),
      costLow: round(base.totalCost * 0.7),
      costHigh: round(base.totalCost * 1.3),
      setupCost: round(base.setupCost),
      scoreAvg: base.scoreAvg,
    },
    scores: base.scores.map((s) => ({ key: s.key, label: resolve(s.label), value: s.score })),
    alternatives: ensemble.variants.map((v) => ({
      id: v.id,
      label: resolve(v.label),
      intent: resolve(v.intent),
      assumptions: v.assumptions.map(resolve),
      preset: v.recommendation.preset,
      monthlyCost: round(v.recommendation.totalCost),
      scoreAvg: v.recommendation.scoreAvg,
    })),
    tensions: {
      agreement: ensemble.spread.agreement,
      costSpreadPct: ensemble.spread.costRangePct,
      risks: base.risks.map(resolve),
      residencyConflict: base.residency.conflict.hasConflict ? resolve(base.residency.conflict.reason) : null,
    },
    sources: base.costSources.map((s) => ({ label: s.label, url: s.url, date: s.checkedAt })),
  };
}
