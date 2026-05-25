// Consentement réseau (F9) : opt-in EXPLICITE et HORODATÉ pour la collecte de coûts
// réels (moat ③). La collecte effective arrive au Lot 2 ; ici on pose le mécanisme.

import type { NetworkConsentInsert } from "@/lib/supabase/types";

/**
 * Construit la ligne de consentement à upserter. Pur : horodate l'opt-in
 * (`consented_at`) ou la révocation (`revoked_at`) selon le choix. `now` injectable.
 */
export function buildConsentUpsert(args: {
  circleId: string;
  userId: string;
  consented: boolean;
  now?: Date;
}): NetworkConsentInsert {
  const stamp = (args.now ?? new Date()).toISOString();
  return {
    circle_id: args.circleId,
    user_id: args.userId,
    scope: "cost_network",
    consented: args.consented,
    consented_at: args.consented ? stamp : null,
    revoked_at: args.consented ? null : stamp,
  };
}
