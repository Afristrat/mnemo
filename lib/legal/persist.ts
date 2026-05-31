// Persistance de l'audit trail de la veille juridique (S-062) — SERVEUR UNIQUEMENT.
// Insère les observations (une par flux rafraîchi) dans `transfer_status_observations` (RLS, pivot
// circle). Gatée « live/flagged seulement » : un statut 100 % seed (la veille n'a pas tourné) n'est
// pas une observation → on n'écrit pas. Jamais bloquant, jamais throw (échec Supabase → réponse OK).

import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { buildTransferObservations } from "./observation";
import type { TransferBasis } from "./transfers";

type Deps = {
  client?: SupabaseClient<Database> | null;
  circleId?: string | null;
  createdBy?: string | null;
};

/** Ne garde que les bases issues de la veille (provenance live/flagged) — le seed n'est pas une observation. */
function liveBases(bases: TransferBasis[]): TransferBasis[] {
  return bases.filter((b) => (b.provenance ?? "seed") !== "seed");
}

/**
 * Persiste l'audit des statuts de transfert rafraîchis par la veille (live/flagged). Renvoie le nombre
 * de lignes écrites (0 si aucune base live / repli). Ne lève jamais.
 */
export async function persistTransferObservations(bases: TransferBasis[], deps: Deps = {}): Promise<number> {
  const live = liveBases(bases);
  if (live.length === 0) return 0;
  const client = deps.client ?? createAdminClient();
  if (client === null) return 0;
  const rows = buildTransferObservations({ bases: live, circleId: deps.circleId, createdBy: deps.createdBy });
  try {
    const { error } = await client.from("transfer_status_observations").insert(rows);
    return error === null ? rows.length : 0;
  } catch {
    return 0;
  }
}
