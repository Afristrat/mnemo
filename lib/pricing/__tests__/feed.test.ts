import { describe, it, expect, vi } from "vitest";
import { extractMoneyTokens, figuresFingerprint, detectVariation } from "@/lib/pricing/extract";
import { TtlCache } from "@/lib/pricing/cache";
import { scrapePricingMarkdown } from "@/lib/pricing/firecrawl";
import { buildObservation, refreshAllPricing, feedSources, type FeedSource } from "@/lib/pricing/feed";

const SOURCE: FeedSource = { layerId: 99, label: "Vendor — pricing", url: "https://vendor.test/pricing" };

function okResponse(markdown: string): Response {
  return { ok: true, json: async () => ({ success: true, data: { markdown } }) } as unknown as Response;
}

describe("extractMoneyTokens", () => {
  it("extrait les figures USD et EUR plausibles", () => {
    const tokens = extractMoneyTokens("Plans: $14.99/mo, $24.99/mo, et €0.0088 / heure, 20€/mois.");
    const usd = tokens.filter((t) => t.currency === "USD").map((t) => t.amount);
    const eur = tokens.filter((t) => t.currency === "EUR").map((t) => t.amount);
    expect(usd).toEqual([14.99, 24.99]);
    expect(eur).toEqual([0.0088, 20]);
  });

  it("rejette le bruit (compteurs animés à chiffres absurdes) et les zéros", () => {
    const tokens = extractMoneyTokens("Hype $00123456789012345/mo. Free $0. Real $42.");
    expect(tokens.map((t) => t.amount)).toEqual([42]);
  });

  it("normalise les séparateurs de milliers et déduplique", () => {
    const tokens = extractMoneyTokens("$1,234.50 then $1,234.50 again");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].amount).toBe(1234.5);
  });
});

describe("figuresFingerprint / detectVariation", () => {
  it("est stable indépendamment de l'ordre source", () => {
    const a = figuresFingerprint(extractMoneyTokens("$1 $2 $3"));
    const b = figuresFingerprint(extractMoneyTokens("$3 $1 $2"));
    expect(a).toBe(b);
  });

  it("ne signale aucune variation sans référence (premier relevé)", () => {
    expect(detectVariation(null, extractMoneyTokens("$5")).changed).toBe(false);
  });

  it("signale une variation quand l'empreinte diffère", () => {
    const figures = extractMoneyTokens("$5 $6");
    expect(detectVariation("deadbeef", figures).changed).toBe(true);
    expect(detectVariation(figuresFingerprint(figures), figures).changed).toBe(false);
  });
});

describe("TtlCache", () => {
  it("retourne la valeur dans la fenêtre TTL puis expire", () => {
    const cache = new TtlCache<string>(1000);
    cache.set("k", "v", 0);
    expect(cache.get("k", 500)).toBe("v");
    expect(cache.get("k", 1001)).toBeNull();
  });
});

describe("scrapePricingMarkdown", () => {
  it("retourne null sans clé API (jamais d'appel)", async () => {
    const fetchImpl = vi.fn();
    expect(await scrapePricingMarkdown(SOURCE.url, { apiKey: undefined, fetchImpl })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("retourne le markdown sur succès", async () => {
    const fetchImpl = vi.fn(async () => okResponse("# Pricing $25/mo"));
    expect(await scrapePricingMarkdown(SOURCE.url, { apiKey: "fc-x", fetchImpl })).toContain("$25/mo");
  });

  it("retourne null sur réponse non-OK ou erreur réseau", async () => {
    const notOk = vi.fn(async () => ({ ok: false }) as unknown as Response);
    expect(await scrapePricingMarkdown(SOURCE.url, { apiKey: "fc-x", fetchImpl: notOk })).toBeNull();
    const throws = vi.fn(async () => {
      throw new Error("network");
    });
    expect(await scrapePricingMarkdown(SOURCE.url, { apiKey: "fc-x", fetchImpl: throws })).toBeNull();
  });
});

describe("buildObservation", () => {
  const now = Date.parse("2026-06-01T10:00:00Z");

  it("repli (unavailable) quand le markdown est null", () => {
    const obs = buildObservation(SOURCE, null, { fingerprint: "x", capturedAt: "2026-05-25" }, now);
    expect(obs.status).toBe("unavailable");
    expect(obs.figureCount).toBe(0);
  });

  it("verified (high) quand l'empreinte correspond au snapshot", () => {
    const md = "$10 $20 $30";
    const fingerprint = figuresFingerprint(extractMoneyTokens(md));
    const obs = buildObservation(SOURCE, md, { fingerprint, capturedAt: "2026-05-25" }, now);
    expect(obs.status).toBe("verified");
    expect(obs.confidence).toBe("high");
    expect(obs.checkedAt).toBe("2026-06-01");
    expect(obs.figureCount).toBe(3);
  });

  it("changed (low) quand les figures diffèrent du snapshot", () => {
    const obs = buildObservation(SOURCE, "$10 $20 $30", { fingerprint: "deadbeef", capturedAt: "2026-05-25" }, now);
    expect(obs.status).toBe("changed");
    expect(obs.confidence).toBe("low");
    expect(obs.note).toContain("revérifier");
  });

  it("verified (medium) pour une page sans figure fixe (usage-based)", () => {
    const obs = buildObservation(SOURCE, "Usage-based, contact sales.", { fingerprint: null, capturedAt: "2026-05-25" }, now);
    expect(obs.status).toBe("verified");
    expect(obs.confidence).toBe("medium");
    expect(obs.figureCount).toBe(0);
  });
});

describe("refreshAllPricing", () => {
  it("couvre toutes les sources seed et met en cache (un seul appel par source)", async () => {
    const fetchImpl = vi.fn(async () => okResponse("Usage-based pricing, no fixed figure."));
    const cache = new TtlCache<Awaited<ReturnType<typeof refreshAllPricing>>[number]>(60_000);
    const deps = { apiKey: "fc-x", fetchImpl, now: () => 0, cache };

    const first = await refreshAllPricing(deps);
    expect(first).toHaveLength(feedSources().length);
    const calls = fetchImpl.mock.calls.length;

    const second = await refreshAllPricing(deps);
    expect(second).toEqual(first);
    expect(fetchImpl.mock.calls.length).toBe(calls); // servi par le cache
  });

  it("tombe en repli (unavailable) quand la clé manque", async () => {
    const fetchImpl = vi.fn();
    const observations = await refreshAllPricing({
      apiKey: undefined,
      fetchImpl,
      now: () => 0,
      cache: new TtlCache(60_000),
    });
    expect(observations.every((o) => o.status === "unavailable")).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
