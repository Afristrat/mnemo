import { describe, it, expect } from "vitest";
import { TtlCache } from "@/lib/pricing/cache";
import { regimesSeedFor } from "@/lib/legal/regime-seed";
import type { RegimeSuggestion } from "@/lib/legal/regime-seed";
import { getRegimesForCountriesCached, mergeRegimes, type RegimeFeed } from "@/lib/legal/regime-feed";

// S-077 tranche 3 : fusion seed∪live (seed = référence, doctrine conservatrice S-062) + cache TTL.

function liveRegime(country: string, name: string): RegimeSuggestion {
  return {
    code: null,
    name,
    scope: "data-protection",
    country,
    confidence: "low",
    provenance: "live",
    source: { label: `Veille web — ${name}`, url: "https://x.example/law", checkedAt: "2026-06-01" },
  };
}

describe("mergeRegimes (fusion seed∪live)", () => {
  it("veille vide → seed seul, source=seed", () => {
    const seed = regimesSeedFor("union-europeenne");
    const { regimes, source } = mergeRegimes(seed, []);
    expect(regimes).toEqual(seed);
    expect(source).toBe("seed");
  });

  it("aucun seed + live → source=live", () => {
    const { regimes, source } = mergeRegimes([], [liveRegime("atlantide", "Atlantis DPA")]);
    expect(regimes).toHaveLength(1);
    expect(source).toBe("live");
  });

  it("seed + live nouveau → mixed, le live est AJOUTÉ après le seed", () => {
    const seed = regimesSeedFor("bresil"); // LGPD
    const { regimes, source } = mergeRegimes(seed, [liveRegime("bresil", "Marco Civil da Internet")]);
    expect(source).toBe("mixed");
    expect(regimes).toHaveLength(seed.length + 1);
    expect(regimes[regimes.length - 1].name).toBe("Marco Civil da Internet");
  });

  it("un live DUPLIQUANT le seed (même pays+nom) n'est PAS ré-ajouté (seed reste la référence)", () => {
    const seed = regimesSeedFor("bresil"); // LGPD
    // Même clé (pays + nom EXACT du seed) → le live est considéré comme déjà couvert par le seed.
    const dup = liveRegime("bresil", seed[0].name);
    const { regimes } = mergeRegimes(seed, [dup]);
    expect(regimes).toHaveLength(seed.length);
    expect(regimes.every((r) => r.provenance === "seed")).toBe(true); // le live dupliqué n'écrase pas le seed
  });
});

describe("getRegimesForCountriesCached (cache TTL)", () => {
  it("un hit de cache court-circuite tout calcul (aucune I/O)", async () => {
    const cache = new TtlCache<RegimeFeed>(60_000);
    const sentinel: RegimeFeed = { regimes: regimesSeedFor("maroc"), source: "seed", generatedAt: "2026-06-01" };
    // La clé de cache = pays normalisés joints par « | ».
    cache.set("maroc", sentinel, 0);
    const out = await getRegimesForCountriesCached(["maroc"], { now: () => new Date(0), cache });
    expect(out).toBe(sentinel); // renvoyé tel quel, sans relancer la veille
  });
});
