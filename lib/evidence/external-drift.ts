// Feature B — drift EXTERNE. Pour chaque composant de la reco SIGNÉE (manifeste Exit Escrow), interroge le
// monde (SearXNG+LLM) : changement matériel depuis la date de signature ? (juridiction, incident SLA,
// dépréciation, rachat). Jumeau « externe » de lib/drift/reconcile.ts (qui compare au live RAPPORTÉ). PUR.

import type { BundleManifest } from "@/lib/exit/bundle";
import { gatherSourcedEvidence, type GatherDeps } from "./gather";
import type { EvidenceClaim, EvidenceSource } from "./types";

export type ExternalDriftSignal = {
  subject: string;
  verdict: "stable" | "changed" | "unknown";
  sources: EvidenceSource[];
  rationale: string;
  confidence: "low" | "dated";
};

export type ExternalDriftReport = {
  generatedAt: string;
  asOf: string;
  signals: ExternalDriftSignal[];
  changedCount: number;
  unknownCount: number;
  inSync: boolean; // aucun changed
  disclaimer: string;
};

const DISCLAIMER =
  "Veille externe de dérive (recherche web + IA) sur les composants de la reco signée. Une IA peut se tromper : vérifiez les sources avant d'agir.";

/** Un claim de drift externe par couche signée. `asOf` = date de signature. Pur. */
export function buildExternalDriftClaims(manifest: BundleManifest, asOf: string): EvidenceClaim[] {
  return manifest.layers
    .filter((l) => l.choice.trim() !== "")
    .map((l) => ({
      kind: "external_drift" as const,
      subject: `${l.choice} (${l.name})`,
      query: `${l.choice} jurisdiction OR SLA incident OR deprecated OR acquisition 2026`,
      asOf,
    }));
}

function isDriftVerdict(v: string): v is "stable" | "changed" | "unknown" {
  return v === "stable" || v === "changed" || v === "unknown";
}

export async function runExternalDrift(
  manifest: BundleManifest,
  asOf: string,
  deps: GatherDeps,
  generatedAt: string,
): Promise<ExternalDriftReport> {
  const claims = buildExternalDriftClaims(manifest, asOf);
  const signals: ExternalDriftSignal[] = [];
  for (const claim of claims) {
    const ev = await gatherSourcedEvidence(claim, deps, generatedAt);
    const verdict = isDriftVerdict(ev.verdict) ? ev.verdict : "unknown";
    signals.push({
      subject: claim.subject,
      verdict,
      sources: ev.sources,
      rationale: ev.rationale,
      confidence: ev.confidence,
    });
  }
  const changedCount = signals.filter((s) => s.verdict === "changed").length;
  const unknownCount = signals.filter((s) => s.verdict === "unknown").length;
  return {
    generatedAt,
    asOf,
    signals,
    changedCount,
    unknownCount,
    inSync: changedCount === 0,
    disclaimer: DISCLAIMER,
  };
}
