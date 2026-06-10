// Feature A — citations sourcées vérifiables. Mappe une Recommendation (+ Profile pour les régimes) vers des
// EvidenceClaim « citation » sur les 4 familles d'affirmations DURES (coût, juridique, SLA, existence provider),
// puis orchestre gatherSourcedEvidence sur chacune. PUR (I/O injectée via GatherDeps). Pas la prose/les scores.

import type { Profile, Recommendation } from "@/lib/engine";
import { gatherSourcedEvidence, type GatherDeps } from "./gather";
import type { EvidenceClaim, SourcedEvidence } from "./types";

/** Construit les claims « citation » à partir de la reco + profil. Pur, total. */
export function buildClaimsForReco(profile: Profile, reco: Recommendation): EvidenceClaim[] {
  const claims: EvidenceClaim[] = [];

  // 1) Existence + coût du composant recommandé de chaque couche tarifée.
  for (const layer of reco.layers) {
    if (layer.choice.trim() === "") continue;
    claims.push({
      kind: "citation",
      subject: `${layer.choice} — existence & offre`,
      query: `${layer.choice} official product pricing 2026`,
    });
  }

  // 2) Statut juridique : un claim par régime du profil.
  for (const reg of profile.regulations) {
    claims.push({
      kind: "citation",
      subject: `Régime ${reg} — statut en vigueur`,
      query: `${reg} data protection regulation in force 2026 official`,
    });
  }

  // 3) SLA de la classe d'hébergement (zone du profil).
  claims.push({
    kind: "citation",
    subject: `SLA hébergement — zone ${profile.zone}`,
    query: `cloud provider SLA availability guarantee ${profile.zone} 2026`,
  });

  return claims;
}

/** Orchestration : gather sur chaque claim (séquentiel — coût LLM maîtrisé). Ne lève jamais (gather replie). */
export async function gatherCitations(
  profile: Profile,
  reco: Recommendation,
  deps: GatherDeps,
  generatedAt: string,
): Promise<SourcedEvidence[]> {
  const claims = buildClaimsForReco(profile, reco);
  const out: SourcedEvidence[] = [];
  for (const claim of claims) {
    out.push(await gatherSourcedEvidence(claim, deps, generatedAt));
  }
  return out;
}
