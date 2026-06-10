// Persistance de l'audit de preuve sourcée — SERVEUR UNIQUEMENT. Insère le LIVE dans evidence_observations
// (RLS, pivot circle). Gatée « live seulement », jamais bloquante, jamais throw. Jumeau de regime-persist.

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { buildEvidenceObservations } from "./observation";
import type { SourcedEvidence } from "./types";

type Deps = {
  client?: SupabaseClient<Database> | null;
  circleId?: string | null;
  createdBy?: string | null;
  integrityHash?: string | null;
};

export async function persistEvidenceObservations(items: SourcedEvidence[], deps: Deps = {}): Promise<number> {
  const live = items.filter((ev) => ev.provenance === "live");
  if (live.length === 0) return 0;
  const client = deps.client ?? createAdminClient();
  if (client === null) return 0;
  const rows = buildEvidenceObservations({
    items: live,
    integrityHash: deps.integrityHash,
    circleId: deps.circleId,
    createdBy: deps.createdBy,
  });
  try {
    const { error } = await client.from("evidence_observations").insert(rows);
    return error === null ? rows.length : 0;
  } catch {
    return 0;
  }
}
