import { describe, it, expect } from "vitest";
import { computeSovereignCompute, NEUTRAL_COMPUTE_PRICES } from "@/lib/engine";
import type { Preset, Profile } from "@/lib/engine";
import { COMPUTE_PRICE_SEED } from "@/lib/pricing/compute-seed";

// S-033, compute souverain : dimensionnement des serveurs self-hosted. Prix INJECTÉS (DÉFCON 1).

const P = COMPUTE_PRICE_SEED;

function profile(over: Partial<Profile> = {}): Profile {
  return {
    activity: "pme-startup", zone: "ue", users: 5, contentTypes: ["text"], volume: "10to100",
    growth: "medium", regulations: ["rgpd"], sensitivity: "internal", audit: false, bitemporal: false,
    techLevel: "hybrid", budget: "200to500", reqPerDay: "lt1k", latency: "fast", voices: "solo",
    modules: { bisect: 0, reversal: 0, prereg: 0, mel: 0, conflict: 0 }, ...over,
  };
}

describe("computeSovereignCompute, dimensionnement serveurs self-hosted", () => {
  it("LIGHT : 1 petite instance (glue), le reste est managé", () => {
    const c = computeSovereignCompute(profile(), "LIGHT", P);
    expect(c.instances).toHaveLength(1);
    expect(c.instances[0]?.spec.name).toBe(P.glue.name);
    expect(c.instances[0]?.count).toBe(1);
    expect(c.monthlyCost).toBe(Math.round(P.glue.pricePerHourEur * 730));
  });

  it("MEDIUM : 1 nœud self-host de base", () => {
    const c = computeSovereignCompute(profile(), "MEDIUM", P);
    expect(c.instances[0]?.spec.name).toBe(P.node.name);
    expect(c.instances[0]?.count).toBe(1);
  });

  it("HARD : 2 nœuds de base (séparation + redondance)", () => {
    const c = computeSovereignCompute(profile(), "HARD", P);
    expect(c.instances[0]?.count).toBe(2);
  });

  it("scaling : gros volume / beaucoup d'users / fort débit ajoutent des nœuds", () => {
    const base = computeSovereignCompute(profile(), "MEDIUM", P).instances[0]?.count ?? 0;
    const big = computeSovereignCompute(profile({ volume: "gt1000" }), "MEDIUM", P).instances[0]?.count ?? 0;
    const users = computeSovereignCompute(profile({ users: 200 }), "MEDIUM", P).instances[0]?.count ?? 0;
    const req = computeSovereignCompute(profile({ reqPerDay: "gt10k" }), "MEDIUM", P).instances[0]?.count ?? 0;
    expect(big).toBeGreaterThan(base);
    expect(users).toBeGreaterThan(base);
    expect(req).toBeGreaterThan(base);
  });

  it("monotonie : à charge égale, HARD ≥ MEDIUM ≥ LIGHT", () => {
    const light = computeSovereignCompute(profile(), "LIGHT", P).monthlyCost;
    const medium = computeSovereignCompute(profile(), "MEDIUM", P).monthlyCost;
    const hard = computeSovereignCompute(profile(), "HARD", P).monthlyCost;
    expect(medium).toBeGreaterThan(light);
    expect(hard).toBeGreaterThan(medium);
  });

  it("chaque instance porte une source datée (DÉFCON 1)", () => {
    const c = computeSovereignCompute(profile(), "MEDIUM", P);
    expect(c.sources.length).toBeGreaterThan(0);
    for (const s of c.sources) {
      expect(s.url).toMatch(/^https:\/\//);
      expect(s.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("prix injectés : table neutre ⇒ coût 0 (préserve les invariants)", () => {
    expect(computeSovereignCompute(profile(), "HARD", NEUTRAL_COMPUTE_PRICES).monthlyCost).toBe(0);
  });
});
