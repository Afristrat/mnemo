import { describe, it, expect } from "vitest";
import { runVendorWatch } from "@/lib/network/vendor-watch";
import type { LivePriceItem } from "@/lib/pricing/live-feed";
import type { VendorAlert } from "@/lib/network/alerts";

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
    checkedAt: "2026-06-02",
    ...over,
  };
}

describe("runVendorWatch (S-084 orchestration)", () => {
  it("détecte les variations et les persiste (I/O injectées)", async () => {
    const persisted: VendorAlert[] = [];
    const res = await runVendorWatch({
      items: async () => [liveItem({ baselineEur: 100, amountEur: 130 })],
      persist: async (alerts) => {
        persisted.push(...alerts);
        return alerts.length;
      },
    });
    expect(res.detected).toBe(1);
    expect(res.persisted).toBe(1);
    expect(persisted[0]?.vendor).toBe("Scaleway");
  });

  it("aucune variation → rien détecté, rien persisté", async () => {
    const res = await runVendorWatch({
      items: async () => [liveItem({ status: "fallback" })],
      persist: async () => 0,
    });
    expect(res).toEqual({ detected: 0, persisted: 0 });
  });

  it("ne lève jamais : une source en échec retombe sur un résultat vide", async () => {
    const res = await runVendorWatch({
      items: async () => {
        throw new Error("scraper down");
      },
    });
    expect(res).toEqual({ detected: 0, persisted: 0 });
  });
});
