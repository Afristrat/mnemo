// Lock-in / Exit-Cost Meter (moat « chaîne de preuve », vague 2 #4) — PUR. Chiffre le COÛT DE SORTIE à
// côté du coût mensuel : l'asymétrie que les plateformes masquent. DÉFCON 1 : l'egress de rapatriement est
// chiffré UNIQUEMENT depuis un vecteur d'egress SOURCÉ + daté (le même que le moteur résidence) ; les frais
// d'API de sortie et la durée d'engagement mini ne sont JAMAIS fabriqués → « à confirmer au contrat vendor ».

import { hostingClassForProfile, selectEgressVector } from "@/lib/engine";
import type { Profile, Recommendation, ResidencyPriceTable } from "@/lib/engine";

export type ExitCost = {
  /** Go de données à rapatrier (dimensionnement réel de la reco). */
  storageGb: number;
  /** € / Go d'egress (vecteur sourcé, cohérent avec le moteur résidence). */
  egressPerGb: number;
  egressSourced: boolean;
  egressSource: { label: string; url: string; checkedAt: string } | null;
  /** Coût one-shot pour tout sortir (egress × volume), €. */
  exitEgressCost: number;
  /** Coût mensuel de la reco, pour comparaison. */
  monthlyCost: number;
  /** « Le coût de sortie ≈ N mois de service » (null si coût mensuel nul). */
  monthsEquivalent: number | null;
  /** Frais d'API de sortie — non sourçables sans devis vendor (DÉFCON 1). */
  apiFees: "unknown";
  /** Durée d'engagement minimale — au contrat vendor (DÉFCON 1). */
  minCommitment: "unknown";
  disclaimer: string;
};

const DISCLAIMER =
  "Egress chiffré ±30 % depuis une source datée ; frais d'API de sortie et durée d'engagement à confirmer au contrat vendor. Une IA peut se tromper.";

function round(n: number): number {
  return Math.round(n);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Coût de sortie d'une recommandation (pur, prix injectés). L'egress de rapatriement = volume dimensionné ×
 * egress/Go du vecteur sourcé (même `hostingClass` que le moteur). Un egress gratuit (source présente,
 * montant 0) est un BON signal anti-lock-in, affiché tel quel.
 */
export function computeExitCost(reco: Recommendation, profile: Profile, residencyPrices: ResidencyPriceTable): ExitCost {
  const vector = selectEgressVector(residencyPrices, hostingClassForProfile(profile));
  const egressPerGb = vector.interRegionEgress.amount;
  const egressSource = vector.interRegionEgress.source;
  const storageGb = reco.sizing.storageGb;
  const exitEgressCost = round(storageGb * egressPerGb);
  const monthlyCost = reco.totalCost;
  return {
    storageGb,
    egressPerGb,
    egressSourced: egressSource !== null,
    egressSource,
    exitEgressCost,
    monthlyCost,
    monthsEquivalent: monthlyCost > 0 ? round1(exitEgressCost / monthlyCost) : null,
    apiFees: "unknown",
    minCommitment: "unknown",
    disclaimer: DISCLAIMER,
  };
}
