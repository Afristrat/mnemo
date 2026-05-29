// Audit trail de la veille juridique (S-062) : constructeur PUR des lignes
// `transfer_status_observations` (une par flux surveillé). L'insertion Supabase (et le respect RLS) se
// fait côté appelant (route serveur), exercée par le test d'intégration gated. Pattern aligné sur
// `lib/catalog/observation.ts` (builder pur, sans effet de bord). Trace chaque révision de statut
// (provenance live/seed/flagged + source + fraîcheur) pour la preuve DÉFCON 1 (jamais un statut sans date).

import type { TransferObservationInsert } from "@/lib/supabase/types";
import type { TransferBasis } from "./transfers";

/**
 * Construit les lignes d'audit (une par base de transfert rafraîchie). `circleId`/`createdBy` restent
 * `null` pour une veille anonyme (configurateur public). Pur. Chaque ligne porte la provenance
 * (seed/live/flagged), la confiance, le caractère révisable (`volatile`) et la source datée.
 */
export function buildTransferObservations(args: {
  bases: TransferBasis[];
  circleId?: string | null;
  createdBy?: string | null;
}): TransferObservationInsert[] {
  return args.bases.map((b): TransferObservationInsert => ({
    circle_id: args.circleId ?? null,
    created_by: args.createdBy ?? null,
    from_region: b.from,
    to_region: b.to,
    status: b.status,
    legal_basis: b.legalBasis,
    provenance: b.provenance ?? "seed",
    confidence: b.confidence,
    volatile: b.volatile,
    source_url: b.source?.url ?? null,
    source_label: b.source?.label ?? null,
    checked_at: b.checkedAt,
    note: b.note ?? null,
  }));
}
