// Alertes vendor partagées (F13 Network actif, Lot 2 · D, S-084) — PUR.
//
// Quand le price feed (S-025) détecte une VARIATION de prix vendor, on construit une alerte SOURCÉE
// (ancien → nouveau prix + date + URL) diffusable aux membres consentants du réseau. DÉFCON 1 :
// l'alerte est un FAIT chiffré et sourcé — JAMAIS une recommandation d'achat ni un jugement. Une
// variation nulle ne produit pas d'alerte. i18n : le résumé est un descripteur `Message`.

import { msg, type Message } from "@/lib/engine/message";

/** Variation détectée par le feed : ancien vs nouveau prix d'un poste vendor, avec sa source datée. */
export type PriceChange = {
  vendor: string;
  item: string;
  oldPrice: number;
  newPrice: number;
  currency: string;
  sourceUrl: string;
  checkedAt: string;
};

export type AlertSeverity = "info" | "notable" | "major";
export type AlertDirection = "increase" | "decrease";

export type VendorAlert = {
  vendor: string;
  item: string;
  oldPrice: number;
  newPrice: number;
  currency: string;
  /** Écart relatif (%) nouveau vs ancien. */
  deltaPct: number;
  direction: AlertDirection;
  severity: AlertSeverity;
  source: { url: string; checkedAt: string };
  /** Résumé localisé (descripteur i18n) — fait sourcé, jamais un conseil. */
  summary: Message;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function severityOf(absPct: number): AlertSeverity {
  if (absPct > 30) return "major";
  if (absPct >= 10) return "notable";
  return "info";
}

/**
 * Construit les alertes à partir des variations détectées. Pure et déterministe.
 *  - dédup par (vendor, item) en gardant la variation la PLUS RÉCENTE (checkedAt ISO max) ;
 *  - ignore les variations nulles (ancien = nouveau) et les anciens prix ≤ 0 (pas de % fiable) ;
 *  - sévérité par ampleur de l'écart ; résumé i18n sourcé.
 */
export function buildVendorAlerts(changes: readonly PriceChange[]): VendorAlert[] {
  const latest = new Map<string, PriceChange>();
  for (const c of changes) {
    if (c.oldPrice <= 0 || c.newPrice === c.oldPrice) continue;
    const key = `${c.vendor}::${c.item}`;
    const prev = latest.get(key);
    if (prev === undefined || c.checkedAt > prev.checkedAt) latest.set(key, c);
  }

  const alerts: VendorAlert[] = [];
  for (const c of latest.values()) {
    const deltaPct = round2(((c.newPrice - c.oldPrice) / c.oldPrice) * 100);
    const direction: AlertDirection = c.newPrice > c.oldPrice ? "increase" : "decrease";
    alerts.push({
      vendor: c.vendor,
      item: c.item,
      oldPrice: c.oldPrice,
      newPrice: c.newPrice,
      currency: c.currency,
      deltaPct,
      direction,
      severity: severityOf(Math.abs(deltaPct)),
      source: { url: c.sourceUrl, checkedAt: c.checkedAt },
      summary: msg("network.alert.summary", {
        direction,
        vendor: c.vendor,
        item: c.item,
        oldPrice: c.oldPrice,
        newPrice: c.newPrice,
        currency: c.currency,
        deltaPct,
      }),
    });
  }
  return alerts;
}
