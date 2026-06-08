// Persistance du consentement réseau (F9) — SERVEUR UNIQUEMENT.
// Trace RGPD/CNDP : upsert horodaté de l'opt-in (ou de la révocation) dans `network_consents`,
// sous l'identité de l'appelant (client de session → RLS `consents_insert/update` : user_id = auth.uid()
// et membre du cercle). Le builder de la ligne est pur (`buildConsentUpsert`, testable sans I/O).
// Ne lève jamais : un échec de trace ne doit pas casser la réponse de l'appelant.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { buildConsentUpsert } from "./consent";

/**
 * Upsert le consentement réseau (clé logique `circle_id, user_id, scope`). Renvoie `true` si la ligne
 * a été écrite, `false` sinon (erreur RLS, exception réseau…). Ne lève jamais.
 */
export async function persistConsent(
  client: SupabaseClient<Database>,
  args: { circleId: string; userId: string; consented: boolean; now?: Date },
): Promise<boolean> {
  const row = buildConsentUpsert(args);
  try {
    const { error } = await client
      .from("network_consents")
      .upsert(row, { onConflict: "circle_id,user_id,scope" });
    return error === null;
  } catch {
    return false;
  }
}
