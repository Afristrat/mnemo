// Persistance de la collecte du coût réel (F13, S-082) — SERVEUR UNIQUEMENT.
// Construit (pur) puis insère une ligne par poste comparé dans `real_cost_entries` (RLS, pivot circle).
// Jamais bloquant, jamais throw. Le builder est exporté à part (testable sans I/O).

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, RealCostEntryInsert } from "@/lib/supabase/types";
import type { CostComparison } from "./real-cost";

/** Construit les lignes d'audit (une par poste). Pur — réutilisé par les tests. */
export function buildRealCostRows(args: {
  comparison: CostComparison;
  checkedAt: string;
  circleId?: string | null;
  createdBy?: string | null;
}): RealCostEntryInsert[] {
  return args.comparison.posts.map((p) => ({
    circle_id: args.circleId ?? null,
    created_by: args.createdBy ?? null,
    poste: p.poste,
    estimated: p.estimated,
    real_cost: p.real,
    delta_pct: p.deltaPct,
    status: p.status,
    checked_at: args.checkedAt,
  }));
}

type Deps = {
  client?: SupabaseClient<Database> | null;
  circleId?: string | null;
  createdBy?: string | null;
  checkedAt: string;
};

/** Persiste la comparaison (une ligne par poste). Renvoie le nb de lignes écrites (0 si repli). Ne lève jamais. */
export async function persistRealCostEntries(comparison: CostComparison, deps: Deps): Promise<number> {
  if (comparison.posts.length === 0) return 0;
  const client = deps.client ?? createAdminClient();
  if (client === null) return 0;
  const rows = buildRealCostRows({ comparison, checkedAt: deps.checkedAt, circleId: deps.circleId, createdBy: deps.createdBy });
  try {
    const { error } = await client.from("real_cost_entries").insert(rows);
    return error === null ? rows.length : 0;
  } catch {
    return 0;
  }
}
