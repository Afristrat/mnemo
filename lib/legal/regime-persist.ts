// Persistance de l'audit trail de la veille des régimes (S-077) — SERVEUR UNIQUEMENT.
// Insère les régimes DÉCOUVERTS (provenance live) dans `regime_observations` (RLS, pivot circle). Gatée
// « live seulement » : un régime 100 % seed (la veille n'a rien ajouté) n'est pas une observation → on
// n'écrit pas. Jamais bloquant, jamais throw (échec Supabase → réponse OK). Jumeau de `lib/legal/persist`.

import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { buildRegimeObservations } from "./regime-observation";
import type { RegimeSuggestion } from "./regime-seed";

type Deps = {
  client?: SupabaseClient<Database> | null;
  circleId?: string | null;
  createdBy?: string | null;
};

/** Ne garde que les régimes issus de la veille (provenance live) — le seed daté n'est pas une observation. */
function liveRegimes(regimes: RegimeSuggestion[]): RegimeSuggestion[] {
  return regimes.filter((r) => r.provenance === "live");
}

/**
 * Persiste l'audit des régimes découverts par la veille (live). Renvoie le nombre de lignes écrites
 * (0 si aucun régime live / repli). Ne lève jamais.
 */
export async function persistRegimeObservations(regimes: RegimeSuggestion[], deps: Deps = {}): Promise<number> {
  const live = liveRegimes(regimes);
  if (live.length === 0) return 0;
  const client = deps.client ?? createAdminClient();
  if (client === null) return 0;
  const rows = buildRegimeObservations({ regimes: live, circleId: deps.circleId, createdBy: deps.createdBy });
  try {
    const { error } = await client.from("regime_observations").insert(rows);
    return error === null ? rows.length : 0;
  } catch {
    return 0;
  }
}
