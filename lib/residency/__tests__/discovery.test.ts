import { describe, it, expect } from "vitest";
import type { Profile } from "@/lib/engine";
import type { LlmMessage, LlmResult } from "@/lib/llm";
import type { WebSearchResult } from "@/lib/pricing/scraper";
import {
  discoverProvidersForCountry,
  discoveryQuery,
  parseDiscoveredProviders,
  providerViolatesConstraints,
} from "../discovery";
import { getProvidersForCountry } from "../discovery-cache";

function prof(over: Partial<Profile> = {}): Profile {
  return {
    activity: "pme-startup",
    continent: "europe",
    country: "union-europeenne",
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
    ...over,
  };
}

const RESULTS: WebSearchResult[] = [
  { title: "Provider A", url: "https://a.example/cloud", snippet: "sovereign cloud" },
  { title: "Provider B", url: "https://b.example/cloud", snippet: "hyperscaler region" },
];

function llmReturning(json: string): (m: LlmMessage[]) => Promise<LlmResult> {
  return async (): Promise<LlmResult> => ({ ok: true, content: json });
}

describe("providerViolatesConstraints (S-072 absolue)", () => {
  it("souveraineté exigée (preferSovereign) → rejette hyperscaler, admet sovereign/eu-hosted", () => {
    const p = prof({ preferSovereign: true });
    expect(providerViolatesConstraints("hyperscaler", p)).toBe(true);
    expect(providerViolatesConstraints("sovereign", p)).toBe(false);
    expect(providerViolatesConstraints("eu-hosted", p)).toBe(false);
  });
  it("sans exigence de souveraineté → aucun rejet dur (RGPD seul n'interdit pas)", () => {
    const p = prof();
    expect(providerViolatesConstraints("hyperscaler", p)).toBe(false);
  });
});

describe("discoveryQuery", () => {
  it("intègre le pays cible + oriente vers la souveraineté si exigée", () => {
    expect(discoveryQuery("Kenya", prof())).toContain("Kenya");
    expect(discoveryQuery("Kenya", prof({ preferSovereign: true }))).toContain("sovereign");
  });
});

describe("parseDiscoveredProviders (garde-fous DÉFCON 1 + S-072)", () => {
  it("anti-hallucination : rejette un fournisseur dont l'URL n'est pas dans les résultats", () => {
    const json = JSON.stringify({ providers: [{ name: "Ghost", sovereignty: "sovereign", sourceUrl: "https://invented.example" }] });
    expect(parseDiscoveredProviders(json, RESULTS, "africa", "Kenya", "2026-05-31", prof())).toEqual([]);
  });

  it("contrainte ABSOLUE : un hyperscaler est écarté quand la souveraineté est exigée", () => {
    const json = JSON.stringify({
      providers: [
        { name: "Provider A", sovereignty: "sovereign", sourceUrl: "https://a.example/cloud" },
        { name: "Provider B", sovereignty: "hyperscaler", sourceUrl: "https://b.example/cloud" },
      ],
    });
    const out = parseDiscoveredProviders(json, RESULTS, "africa", "Kenya", "2026-05-31", prof({ preferSovereign: true }));
    expect(out.map((p) => p.name)).toEqual(["Provider A"]);
    expect(out[0].provenance).toBe("live");
    expect(out[0].source.url).toBe("https://a.example/cloud");
  });

  it("déduplique par nom (insensible à la casse)", () => {
    const json = JSON.stringify({
      providers: [
        { name: "Provider A", sovereignty: "sovereign", sourceUrl: "https://a.example/cloud" },
        { name: "provider a", sovereignty: "sovereign", sourceUrl: "https://a.example/cloud" },
      ],
    });
    expect(parseDiscoveredProviders(json, RESULTS, "africa", "Kenya", "2026-05-31", prof()).length).toBe(1);
  });

  it("JSON invalide → []", () => {
    expect(parseDiscoveredProviders("pas du json", RESULTS, "africa", "Kenya", "2026-05-31", prof())).toEqual([]);
  });
});

describe("discoverProvidersForCountry", () => {
  it("aucun résultat web → [] (repli seed côté appelant)", async () => {
    const out = await discoverProvidersForCountry("Kenya", "africa", prof(), {
      search: async () => [],
      llm: llmReturning("{}"),
    });
    expect(out).toEqual([]);
  });

  it("LLM KO → []", async () => {
    const out = await discoverProvidersForCountry("Kenya", "africa", prof(), {
      search: async () => RESULTS,
      llm: async () => ({ ok: false, reason: "indisponible" }),
    });
    expect(out).toEqual([]);
  });
});

describe("getProvidersForCountry (live + repli annuaire seed)", () => {
  it("veille vide → repli annuaire seed du continent, conforme aux contraintes", async () => {
    const res = await getProvidersForCountry("Kenya", "africa", prof(), { discover: async () => [] });
    expect(res.source).toBe("seed");
    expect(res.providers.length).toBeGreaterThan(0);
    expect(res.providers.every((p) => p.provenance === "seed")).toBe(true);
  });

  it("veille non vide → source mixed/live, live prioritaire et dédupliqué vs seed", async () => {
    const res = await getProvidersForCountry("Kenya", "africa", prof(), {
      discover: async () => [
        {
          name: "Provider live",
          continent: "africa",
          country: "Kenya",
          sovereignty: "sovereign",
          note: "",
          source: { label: "x", url: "https://a.example/cloud", checkedAt: "2026-05-31" },
          provenance: "live",
        },
      ],
    });
    expect(["live", "mixed"]).toContain(res.source);
    expect(res.providers[0].provenance).toBe("live");
  });

  it("souveraineté exigée → le repli seed exclut les classes non souveraines (north-america : hyperscalers absents)", async () => {
    // L'annuaire north-america contient OVHcloud Canada (eu-hosted) → admis ; aucun hyperscaler listé.
    const res = await getProvidersForCountry("Canada", "north-america", prof({ preferSovereign: true }), { discover: async () => [] });
    expect(res.providers.every((p) => p.sovereignty !== "hyperscaler")).toBe(true);
  });
});
