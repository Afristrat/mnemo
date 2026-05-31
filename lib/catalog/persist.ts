// Persistance de l'audit trail de la veille catalogue (S-036) — SERVEUR UNIQUEMENT.
// Insère les observations (une par couche) dans `catalog_observations` (RLS, pivot circle). Gatée
// « live/flagged seulement » : si la veille n'a RIEN ramené (catalogue 100 % seed), on n'écrit pas
// (pas de bruit/coût d'écriture inutile — le seed n'est pas une observation). Jamais bloquant, jamais
// throw : un échec d'insertion (Supabase indispo, clé absente) ne casse jamais la réponse de la veille.

import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { buildCatalogObservations } from "./observation";
import type { Catalog } from "./types";

type Deps = {
  /** Client Supabase (service-role) — injecté pour les tests ; défaut = client admin réel ou `null`. */
  client?: SupabaseClient<Database> | null;
  circleId?: string | null;
  createdBy?: string | null;
};

/** Vrai si au moins une couche provient de la veille live (ou a été flaggée) — sinon catalogue full seed. */
function hasLiveSignal(catalog: Catalog): boolean {
  return Object.values(catalog.slots).some((s) => s.recommended.provenance !== "seed");
}

/**
 * Persiste l'audit du catalogue assemblé si la veille a contribué (live/flagged). Renvoie le nombre de
 * lignes écrites (0 si non applicable / repli). Ne lève jamais.
 */
export async function persistCatalogObservations(catalog: Catalog, deps: Deps = {}): Promise<number> {
  if (!hasLiveSignal(catalog)) return 0;
  const client = deps.client ?? createAdminClient();
  if (client === null) return 0;
  const rows = buildCatalogObservations({ catalog, circleId: deps.circleId, createdBy: deps.createdBy });
  try {
    const { error } = await client.from("catalog_observations").insert(rows);
    return error === null ? rows.length : 0;
  } catch {
    return 0;
  }
}
