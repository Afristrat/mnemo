// Brique « preuve sourcée » (SearXNG + LLM) partagée par les 3 features de la chaîne de preuve :
// citations (A), drift externe (B), vérification d'authenticité (C). Types PURS, zéro I/O.

export type EvidenceKind = "citation" | "external_drift" | "cross_check";

/** Verdicts par kind. A : attested/unattested · B : stable/changed/unknown · C : match/mismatch/unverifiable. */
export type EvidenceVerdict =
  | "attested"
  | "unattested"
  | "stable"
  | "changed"
  | "unknown"
  | "match"
  | "mismatch"
  | "unverifiable";

export type EvidenceClaim = {
  kind: EvidenceKind;
  /** Libellé humain du sujet (ex. « OVHcloud — juridiction de la donnée »). */
  subject: string;
  /** Requête SearXNG (anglais conseillé : moteur). */
  query: string;
  /** B : date de signature de la reco — borne la fenêtre « changement depuis » (ISO court). */
  asOf?: string;
  /** C : affirmation extraite de l'artefact client à confronter aux sources publiques. */
  expected?: string;
};

export type EvidenceSource = { url: string; title: string; snippet: string; retrievedAt: string };

export type SourcedEvidence = {
  claim: EvidenceClaim;
  sources: EvidenceSource[];
  verdict: EvidenceVerdict;
  confidence: "low" | "dated"; // live → low (conservateur, S-062) ; seed → dated
  provenance: "live" | "seed";
  rationale: string; // 1 phrase bornée (sortie LLM contrôlée) ; jamais une URL fabriquée
  generatedAt: string; // ISO court, injecté (pur)
};

/** Verdict conservateur par kind (rien trouvé / repli). */
export const FALLBACK_VERDICT: Record<EvidenceKind, EvidenceVerdict> = {
  citation: "unattested",
  external_drift: "unknown",
  cross_check: "unverifiable",
};
