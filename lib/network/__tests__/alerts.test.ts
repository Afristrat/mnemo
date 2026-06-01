import { describe, it, expect } from "vitest";
import { buildVendorAlerts, type PriceChange } from "@/lib/network/alerts";

// S-084 (F13) : alertes vendor sourcées (fait chiffré, jamais un conseil). Dedup + sévérité + i18n.

function change(over: Partial<PriceChange> = {}): PriceChange {
  return { vendor: "Scaleway", item: "DEV1-M", oldPrice: 10, newPrice: 12, currency: "EUR", sourceUrl: "https://x", checkedAt: "2026-06-01", ...over };
}

describe("buildVendorAlerts (S-084)", () => {
  it("variation → alerte sourcée avec direction, écart et sévérité", () => {
    const [a] = buildVendorAlerts([change({ oldPrice: 100, newPrice: 140 })]);
    expect(a.direction).toBe("increase");
    expect(a.deltaPct).toBe(40);
    expect(a.severity).toBe("major"); // >30
    expect(a.source.url).toBe("https://x");
    expect(a.summary.id).toBe("network.alert.summary");
    expect(a.summary.values?.deltaPct).toBe(40);
  });

  it("sévérité par ampleur (info <10, notable 10-30, major >30)", () => {
    expect(buildVendorAlerts([change({ oldPrice: 100, newPrice: 105 })])[0].severity).toBe("info");
    expect(buildVendorAlerts([change({ oldPrice: 100, newPrice: 120 })])[0].severity).toBe("notable");
    expect(buildVendorAlerts([change({ oldPrice: 100, newPrice: 200 })])[0].severity).toBe("major");
  });

  it("baisse de prix → direction decrease, écart négatif", () => {
    const [a] = buildVendorAlerts([change({ oldPrice: 100, newPrice: 80 })]);
    expect(a.direction).toBe("decrease");
    expect(a.deltaPct).toBe(-20);
  });

  it("ignore les variations nulles et les anciens prix ≤ 0", () => {
    expect(buildVendorAlerts([change({ oldPrice: 50, newPrice: 50 })])).toEqual([]);
    expect(buildVendorAlerts([change({ oldPrice: 0, newPrice: 10 })])).toEqual([]);
  });

  it("dédoublonne par (vendor, item) en gardant la plus récente", () => {
    const alerts = buildVendorAlerts([
      change({ oldPrice: 100, newPrice: 110, checkedAt: "2026-05-01" }),
      change({ oldPrice: 100, newPrice: 150, checkedAt: "2026-06-01" }),
    ]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].newPrice).toBe(150); // la plus récente
  });
});
