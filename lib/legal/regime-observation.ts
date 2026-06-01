// Audit trail de la veille des régimes (S-077) : constructeur PUR des lignes `regime_observations`
// (une par régime DÉCOUVERT par la veille). L'insertion Supabase (et le respect RLS) se fait côté
// appelant (route serveur). Pattern aligné sur `lib/legal/observation.ts` (S-062) — builder pur, sans
// effet de bord. Trace chaque régime sourcé (provenance + confiance + source datée) pour la preuve
// DÉFCON 1 (jamais un régime sans date). On ne construit QUE les régimes de la veille (provenance live).

import type { RegimeObservationInsert } from "@/lib/supabase/types";
import type { RegimeSuggestion } from "./regime-seed";

/**
 * Construit les lignes d'audit (une par régime sourcé). `circleId`/`createdBy` restent `null` pour une
 * veille anonyme (configurateur public). Pur. `code` (énum moteur) reporté en `regime_code` (null = libre).
 */
export function buildRegimeObservations(args: {
  regimes: RegimeSuggestion[];
  circleId?: string | null;
  createdBy?: string | null;
}): RegimeObservationInsert[] {
  return args.regimes.map((r): RegimeObservationInsert => ({
    circle_id: args.circleId ?? null,
    created_by: args.createdBy ?? null,
    country: r.country,
    regime_code: r.code,
    regime_name: r.name,
    scope: r.scope,
    provenance: r.provenance,
    confidence: r.confidence,
    source_url: r.source.url.length > 0 ? r.source.url : null,
    source_label: r.source.label.length > 0 ? r.source.label : null,
    checked_at: r.source.checkedAt,
    note: null,
  }));
}
