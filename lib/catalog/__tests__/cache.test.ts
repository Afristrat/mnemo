import { describe, it, expect } from "vitest";
import type { Profile } from "@/lib/engine";
import { TtlCache } from "@/lib/pricing/cache";
import { getLiveCatalog, getLiveCatalogCached } from "@/lib/catalog/cache";
import type { ProposeForSlot } from "@/lib/catalog/live-catalog";
import type { Catalog, ComponentCandidate, SlotId } from "@/lib/catalog/types";

function prof(overrides: Partial<Profile> = {}): Profile {
  return {
    activity: "pme-startup",
    zone: "ue",
    users: 5,
    contentTypes: ["text"],
    volume: "10to100",
    growth: "medium",
    regulations: ["rgpd"],
    sensitivity: "internal",
    audit: false,
    bitemporal: false,
    techLevel: "hybrid",
    budget: "200to500",
    reqPerDay: "lt1k",
    latency: "fast",
    voices: "solo",
    modules: { bisect: 0, reversal: 0, prereg: 0, mel: 0, conflict: 0 },
    ...overrides,
  };
}

function liveCand(slot: SlotId, role: string): ComponentCandidate {
  return {
    name: `Live-${slot}`,
    role,
    sovereignty: "sovereign",
    source: { label: "web", url: `https://example.com/${slot}`, checkedAt: "2026-05-27" },
    confidence: "medium",
    provenance: "live",
  };
}

describe("getLiveCatalogCached (cache TTL court, S-036)", () => {
  it("ne relance PAS une veille identique tant que le cache est chaud", async () => {
    let calls = 0;
    const proposeForSlot: ProposeForSlot = async (slot, _p, seedSlot) => {
      calls += 1;
      return liveCand(slot, seedSlot.recommended.role);
    };
    const cache = new TtlCache<Catalog>(60 * 60 * 1000);
    const t0 = new Date("2026-05-27T10:00:00Z");

    const a = await getLiveCatalogCached(prof(), { proposeForSlot, cache, now: () => t0 });
    expect(calls).toBe(7); // une proposition par slot (7 couches)

    const b = await getLiveCatalogCached(prof(), { proposeForSlot, cache, now: () => t0 });
    expect(calls).toBe(7); // 2ᵉ appel = cache hit → aucune relance
    expect(b).toEqual(a);
  });

  it("relance la veille après expiration du TTL", async () => {
    let calls = 0;
    const proposeForSlot: ProposeForSlot = async (slot, _p, seedSlot) => {
      calls += 1;
      return liveCand(slot, seedSlot.recommended.role);
    };
    const cache = new TtlCache<Catalog>(1000);
    const p = prof();

    await getLiveCatalogCached(p, { proposeForSlot, cache, now: () => new Date(0) });
    expect(calls).toBe(7);
    await getLiveCatalogCached(p, { proposeForSlot, cache, now: () => new Date(2000) }); // > TTL
    expect(calls).toBe(14);
  });

  it("repli seed total quand la veille ne propose rien (getLiveCatalog)", async () => {
    const cat = await getLiveCatalog(prof(), { proposeForSlot: async () => null });
    expect(cat.source).toBe("seed");
    expect(cat.slots.c4.recommended.provenance).toBe("seed");
  });
});
