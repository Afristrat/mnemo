// Audit trail de la veille catalogue (S-036) : constructeur PUR des lignes `catalog_observations`
// (une par couche). L'insertion Supabase (et le respect RLS) se fait côté appelant (route serveur),
// exercée par le test d'intégration gated. Pattern aligné sur `lib/conversion/log.ts` et
// `lib/network/consent.ts` (builders purs, sans effet de bord).

import type { CatalogObservationInsert } from "@/lib/supabase/types";
import type { Catalog, SlotId } from "./types";

const SLOT_IDS: readonly SlotId[] = ["c0", "c1", "c2", "c3", "c4", "c5", "c6"];

/**
 * Construit les lignes d'audit (une par slot) à partir d'un catalogue assemblé. `circleId`/`createdBy`
 * restent `null` pour une veille anonyme (configurateur public). Pur. Chaque ligne porte la source
 * (DÉFCON 1) et la provenance (live/seed/flagged) du composant retenu pour la couche.
 */
export function buildCatalogObservations(args: {
  catalog: Catalog;
  circleId?: string | null;
  createdBy?: string | null;
}): CatalogObservationInsert[] {
  const { catalog } = args;
  return SLOT_IDS.map((id): CatalogObservationInsert => {
    const c = catalog.slots[id].recommended;
    return {
      circle_id: args.circleId ?? null,
      created_by: args.createdBy ?? null,
      slot: id,
      component: c.name,
      role: c.role,
      sovereignty: c.sovereignty,
      provenance: c.provenance,
      confidence: c.confidence,
      source_url: c.source.url,
      source_label: c.source.label,
      checked_at: c.source.checkedAt,
      assembled_at: catalog.assembledAt,
    };
  });
}
