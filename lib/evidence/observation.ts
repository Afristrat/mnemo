// Builder PUR des lignes evidence_observations (une par SourcedEvidence). L'insertion (et le respect RLS)
// se fait côté appelant (persist.ts). On ne construit QUE le live (le seed daté n'est pas une observation).

import type { EvidenceObservationInsert } from "@/lib/supabase/types";
import type { SourcedEvidence } from "./types";

export function buildEvidenceObservations(args: {
  items: SourcedEvidence[];
  integrityHash?: string | null;
  circleId?: string | null;
  createdBy?: string | null;
}): EvidenceObservationInsert[] {
  return args.items.map((ev): EvidenceObservationInsert => ({
    circle_id: args.circleId ?? null,
    created_by: args.createdBy ?? null,
    kind: ev.claim.kind,
    subject: ev.claim.subject,
    verdict: ev.verdict,
    confidence: ev.confidence,
    provenance: ev.provenance,
    sources: ev.sources,
    integrity_hash: args.integrityHash ?? null,
    generated_at: ev.generatedAt,
  }));
}
