// Repli daté de la preuve sourcée : aucune source live disponible (SearXNG/LLM KO ou vide). DÉFCON 1 :
// on ne fabrique RIEN — verdict conservateur par kind, zéro source, confiance `dated`, provenance `seed`.
// Le seed n'est JAMAIS persisté en audit (cf. persist.ts). Pur.

import { FALLBACK_VERDICT, type EvidenceClaim, type SourcedEvidence } from "./types";

export function seedEvidence(claim: EvidenceClaim, generatedAt: string): SourcedEvidence {
  return {
    claim,
    sources: [],
    verdict: FALLBACK_VERDICT[claim.kind],
    confidence: "dated",
    provenance: "seed",
    rationale: "Aucune source publique disponible au relevé (repli) — à reconfirmer en ligne.",
    generatedAt,
  };
}
