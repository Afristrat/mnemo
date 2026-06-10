// Feature C — vérification d'authenticité externe. Extrait une affirmation d'un artefact CLIENT collé
// (certif provider, page de statut, mention légale) puis la confronte aux sources publiques (SearXNG+LLM).
// 'mismatch' = incohérence avec les sources (JAMAIS une accusation de fraude). PUR (I/O injectée).

import { gatherSourcedEvidence, type GatherDeps } from "./gather";
import type { SourcedEvidence } from "./types";

export type CrossCheckType = "provider-cert" | "status-page" | "legal-mention";

const MAX_ARTEFACT = 2_000;

const TYPE_LABEL: Record<CrossCheckType, string> = {
  "provider-cert": "Certificat fournisseur",
  "status-page": "Page de statut",
  "legal-mention": "Mention légale",
};

/** Borne l'artefact collé (anti-injection) → {expected, subject}. Pur, total. */
export function extractClaim(artefactRaw: string, type: CrossCheckType): { expected: string; subject: string } {
  const expected = typeof artefactRaw === "string" ? artefactRaw.trim().slice(0, MAX_ARTEFACT) : "";
  const subject = expected === "" ? TYPE_LABEL[type] : `${TYPE_LABEL[type]} — ${expected.slice(0, 80)}`;
  return { expected, subject };
}

export async function runCrossCheck(
  artefactRaw: string,
  type: CrossCheckType,
  deps: GatherDeps,
  generatedAt: string,
): Promise<SourcedEvidence> {
  const { expected, subject } = extractClaim(artefactRaw, type);
  if (expected === "") {
    return {
      claim: { kind: "cross_check", subject, query: "", expected: "" },
      sources: [],
      verdict: "unverifiable",
      confidence: "dated",
      provenance: "seed",
      rationale: "Artefact vide — rien à vérifier.",
      generatedAt,
    };
  }
  return gatherSourcedEvidence(
    { kind: "cross_check", subject, query: `${expected.slice(0, 120)} official source 2026`, expected },
    deps,
    generatedAt,
  );
}
