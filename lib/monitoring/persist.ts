// Persistance des snapshots d'Infra Health Score (S-081, F12) — SERVEUR UNIQUEMENT.
// Insère une ligne dans `health_metrics` (RLS, pivot circle). Jamais bloquant, jamais throw (échec
// Supabase / clé absente → 0). Jumeau de lib/legal/regime-persist (S-077).

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { buildHealthMetricRow } from "./observation";
import type { HealthSnapshot } from "./health";

type Deps = {
  client?: SupabaseClient<Database> | null;
  circleId?: string | null;
  createdBy?: string | null;
  checkedAt: string;
};

/** Persiste un snapshot de santé. Renvoie 1 si écrit, 0 sinon (repli silencieux). Ne lève jamais. */
export async function persistHealthMetric(report: HealthSnapshot, deps: Deps): Promise<number> {
  const client = deps.client ?? createAdminClient();
  if (client === null) return 0;
  const row = buildHealthMetricRow({
    report,
    checkedAt: deps.checkedAt,
    circleId: deps.circleId,
    createdBy: deps.createdBy,
  });
  try {
    const { error } = await client.from("health_metrics").insert(row);
    return error === null ? 1 : 0;
  } catch {
    return 0;
  }
}
