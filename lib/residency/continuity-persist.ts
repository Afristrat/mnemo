// Persistance de l'audit de continuité de résidence (S-095) — SERVEUR UNIQUEMENT. Insère un relevé dans
// residency_continuity_observations (RLS, pivot circle). Jamais bloquant, jamais throw (échec Supabase → 0).
// Jumeau de lib/legal/regime-persist.

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { buildContinuityObservation } from "./continuity-observation";
import type { ResidencyContinuityReport } from "./continuity";

type Deps = { client?: SupabaseClient<Database> | null; circleId?: string | null; createdBy?: string | null };

/** Persiste un relevé de continuité de résidence. Renvoie 1 si écrit, 0 sinon. Ne lève jamais. */
export async function persistContinuityObservation(
  report: ResidencyContinuityReport,
  integrityHash: string,
  deps: Deps = {},
): Promise<number> {
  const client = deps.client ?? createAdminClient();
  if (client === null) return 0;
  const row = buildContinuityObservation({ report, integrityHash, circleId: deps.circleId, createdBy: deps.createdBy });
  try {
    const { error } = await client.from("residency_continuity_observations").insert(row);
    return error === null ? 1 : 0;
  } catch {
    return 0;
  }
}
