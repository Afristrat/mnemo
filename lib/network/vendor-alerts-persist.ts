// Persistance de l'audit du broadcast d'alertes vendor (S-084) — SERVEUR UNIQUEMENT.
// Insère les alertes diffusées dans `vendor_alerts` (RLS, pivot circle). Gatée « non vide » : aucune
// variation détectée → on n'écrit rien. Jamais bloquant, jamais throw : un échec d'insertion (Supabase
// indispo, clé absente) ne casse jamais la réponse de la veille. Calque de `lib/catalog/persist.ts`.

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { buildVendorAlertInserts, filterUnpersistedAlerts, type VendorAlertKey } from "./vendor-alerts-observation";
import type { VendorAlert } from "./alerts";

type Deps = {
  /** Client Supabase (service-role) — injecté pour les tests ; défaut = client admin réel ou `null`. */
  client?: SupabaseClient<Database> | null;
  circleId?: string | null;
  createdBy?: string | null;
};

/**
 * Persiste l'audit des alertes vendor diffusées. Renvoie le nombre de lignes écrites (0 si aucune alerte
 * ou repli/échec). Ne lève jamais.
 */
export async function persistVendorAlerts(alerts: readonly VendorAlert[], deps: Deps = {}): Promise<number> {
  if (alerts.length === 0) return 0;
  const client = deps.client ?? createAdminClient();
  if (client === null) return 0;
  const rows = buildVendorAlertInserts({ alerts, circleId: deps.circleId, createdBy: deps.createdBy });
  try {
    // Dédup d'audit : on ne re-logue pas une alerte identique déjà présente (même cercle/vendor/poste/date).
    // Le cron (toutes les N h) et les consultations relisent le même feed caché → sans ce filtre, doublons.
    const checkedAts = [...new Set(rows.map((r) => r.checked_at))];
    const { data } = await client.from("vendor_alerts").select("circle_id,vendor,item,checked_at").in("checked_at", checkedAts);
    const existing: VendorAlertKey[] = (data ?? []).map((d) => ({
      circle_id: d.circle_id,
      vendor: d.vendor,
      item: d.item,
      checked_at: d.checked_at,
    }));
    const fresh = filterUnpersistedAlerts(rows, existing);
    if (fresh.length === 0) return 0;
    const { error } = await client.from("vendor_alerts").insert(fresh);
    return error === null ? fresh.length : 0;
  } catch {
    return 0;
  }
}
