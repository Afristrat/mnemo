// Détection des variations de prix vendor (S-084, F13 Network actif) — PUR.
//
// La veille prix (S-025, `getLivePrices`) réconcilie chaque poste vendor : un prix LIVE plausible est
// promu (`status: "live"`) face à la baseline sourcée datée. Une variation observée = baseline daté →
// live promu, au-delà d'un plancher anti-bruit. DÉFCON 1 : ancien = baseline SOURCÉE datée, nouveau =
// live SOURCÉ daté ; aucun montant inventé. `PriceChange` alimente `buildVendorAlerts` (lib/network).
//
// Import de TYPE uniquement (`LivePriceItem`) : zéro dépendance runtime vers le scraper server-only,
// le module reste pur et testable sans réseau.

import type { LivePriceItem } from "./live-feed";
import type { PriceChange } from "@/lib/network/alerts";

/** Plancher (%) : sous ce seuil, l'écart relève du bruit de réconciliation/arrondi, pas d'une alerte. */
export const MIN_ALERT_DELTA_PCT = 1;

/**
 * Dérive les variations de prix SIGNIFICATIVES d'un relevé live. Ne retient que les postes dont le live
 * a été PROMU (`status: "live"` — donc une vraie valeur publiée extraite, pas un repli seed) et dont
 * l'écart à la baseline dépasse `MIN_ALERT_DELTA_PCT`, avec une source non vide (DÉFCON 1). Pur.
 */
export function priceChangesFromLiveItems(items: readonly LivePriceItem[]): PriceChange[] {
  const changes: PriceChange[] = [];
  for (const it of items) {
    if (it.status !== "live") continue; // seul un live promu est une variation réellement observée
    if (it.baselineEur <= 0) continue; // pas de % fiable sans baseline strictement positive
    if (it.url === "") continue; // DÉFCON 1 : pas de source → pas d'alerte
    const deltaPct = Math.abs(((it.amountEur - it.baselineEur) / it.baselineEur) * 100);
    if (deltaPct < MIN_ALERT_DELTA_PCT) continue;
    changes.push({
      vendor: it.vendor,
      item: it.label,
      oldPrice: it.baselineEur,
      newPrice: it.amountEur,
      currency: "EUR",
      sourceUrl: it.url,
      checkedAt: it.checkedAt,
    });
  }
  return changes;
}
