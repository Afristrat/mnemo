// Audit trail du broadcast d'alertes vendor (S-084) : constructeur PUR des lignes `vendor_alerts`.
// L'insertion Supabase (et le respect RLS) se fait côté appelant (route serveur via persist). Pattern
// aligné sur `lib/catalog/observation.ts` (builder pur, sans effet de bord). `circle_id` null = broadcast
// global (faits de prix publics). Chaque ligne porte la source datée (DÉFCON 1).

import type { VendorAlertInsert } from "@/lib/supabase/types";
import type { VendorAlert } from "./alerts";

/**
 * Construit les lignes d'audit d'alertes vendor à diffuser. `circleId`/`createdBy` restent `null` pour
 * un broadcast global anonyme. Pur.
 */
export function buildVendorAlertInserts(args: {
  alerts: readonly VendorAlert[];
  circleId?: string | null;
  createdBy?: string | null;
}): VendorAlertInsert[] {
  return args.alerts.map((a) => ({
    circle_id: args.circleId ?? null,
    created_by: args.createdBy ?? null,
    vendor: a.vendor,
    item: a.item,
    old_price: a.oldPrice,
    new_price: a.newPrice,
    currency: a.currency,
    delta_pct: a.deltaPct,
    direction: a.direction,
    severity: a.severity,
    source_url: a.source.url,
    checked_at: a.source.checkedAt,
  }));
}

/** Identité d'une alerte déjà loguée (un même état observé le même jour ne se re-logue pas). */
export type VendorAlertKey = { circle_id: string | null; vendor: string; item: string; checked_at: string };

function alertKey(k: VendorAlertKey): string {
  return `${k.circle_id ?? ""}::${k.vendor}::${k.item}::${k.checked_at}`;
}

/**
 * Dédup d'audit : ne garde que les alertes ABSENTES de la base, par (cercle, vendor, poste, date). Un
 * audit trail trace un changement, pas la répétition du même état à chaque relevé (cron) ou consultation.
 * Pur — la lecture de l'existant se fait côté appelant (persist).
 */
export function filterUnpersistedAlerts(
  rows: readonly VendorAlertInsert[],
  existing: readonly VendorAlertKey[],
): VendorAlertInsert[] {
  const seen = new Set(existing.map(alertKey));
  return rows.filter(
    (r) => !seen.has(alertKey({ circle_id: r.circle_id, vendor: r.vendor, item: r.item, checked_at: r.checked_at })),
  );
}
