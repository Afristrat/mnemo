import { describe, it, expect } from "vitest";
import { priceChangesFromLiveItems, MIN_ALERT_DELTA_PCT } from "@/lib/pricing/price-watch";
import type { LivePriceItem } from "@/lib/pricing/live-feed";

function liveItem(over: Partial<LivePriceItem>): LivePriceItem {
  return {
    key: "gpu.shared",
    label: "GPU L4 mutualisé (Scaleway)",
    vendor: "Scaleway",
    group: "media",
    status: "live",
    confidence: "high",
    amountEur: 120,
    baselineEur: 100,
    unit: "€/mois",
    url: "https://www.scaleway.com/en/pricing/gpu/",
    checkedAt: "2026-06-01",
    ...over,
  };
}

describe("priceChangesFromLiveItems (S-084)", () => {
  it("émet un PriceChange pour un poste live dont l'écart à la baseline dépasse le plancher", () => {
    const changes = priceChangesFromLiveItems([liveItem({ baselineEur: 100, amountEur: 120 })]);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      vendor: "Scaleway",
      item: "GPU L4 mutualisé (Scaleway)",
      oldPrice: 100,
      newPrice: 120,
      currency: "EUR",
      sourceUrl: "https://www.scaleway.com/en/pricing/gpu/",
      checkedAt: "2026-06-01",
    });
  });

  it("ignore un poste en repli baseline (status fallback ≠ live) — pas une variation réellement observée", () => {
    expect(priceChangesFromLiveItems([liveItem({ status: "fallback", amountEur: 200 })])).toHaveLength(0);
  });

  it("ignore un poste flaggé (à revérifier), jamais adopté en alerte", () => {
    expect(priceChangesFromLiveItems([liveItem({ status: "flagged", amountEur: 200 })])).toHaveLength(0);
  });

  it("ignore une variation sous le plancher anti-bruit", () => {
    // 100 → 100,5 = 0,5 % < MIN_ALERT_DELTA_PCT
    const tiny = liveItem({ baselineEur: 100, amountEur: 100 + (MIN_ALERT_DELTA_PCT / 100) * 100 * 0.5 });
    expect(priceChangesFromLiveItems([tiny])).toHaveLength(0);
  });

  it("ignore un poste sans source (DÉFCON 1 : pas d'URL → pas d'alerte)", () => {
    expect(priceChangesFromLiveItems([liveItem({ url: "" })])).toHaveLength(0);
  });

  it("ignore une baseline non strictement positive (pas de % fiable)", () => {
    expect(priceChangesFromLiveItems([liveItem({ baselineEur: 0 })])).toHaveLength(0);
  });

  it("détecte aussi une baisse (live < baseline)", () => {
    const changes = priceChangesFromLiveItems([liveItem({ baselineEur: 100, amountEur: 80 })]);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.newPrice).toBe(80);
    expect(changes[0]?.oldPrice).toBe(100);
  });
});
