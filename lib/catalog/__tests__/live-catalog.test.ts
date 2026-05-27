import { describe, it, expect } from "vitest";
import type { Profile } from "@/lib/engine";
import type { LlmMessage, LlmResult } from "@/lib/llm";
import type { WebSearchResult } from "@/lib/pricing/firecrawl";
import { seedCatalog } from "@/lib/catalog/catalog-seed";
import { assembleLiveCatalog, proposeForSlotLive, type ProposeForSlot } from "@/lib/catalog/live-catalog";
import type { CatalogSlot, ComponentCandidate, SlotId } from "@/lib/catalog/types";

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

describe("assembleLiveCatalog (orchestration, S-036)", () => {
  it("tous les slots proposés et valides → catalogue 100 % live", async () => {
    const proposeForSlot: ProposeForSlot = async (slot, _p, seedSlot) => liveCand(slot, seedSlot.recommended.role);
    const cat = await assembleLiveCatalog(prof(), { proposeForSlot, now: () => new Date("2026-05-27") });
    expect(cat.source).toBe("live");
    expect(cat.slots.c4.recommended.name).toBe("Live-c4");
    expect(cat.slots.c4.recommended.provenance).toBe("live");
  });

  it("aucune proposition (null) → repli seed total", async () => {
    const proposeForSlot: ProposeForSlot = async () => null;
    const cat = await assembleLiveCatalog(prof(), { proposeForSlot });
    expect(cat.source).toBe("seed");
    expect(cat.slots.c4.recommended.provenance).toBe("seed");
  });

  it("une proposition qui throw → repli seed pour ce slot (jamais d'exception)", async () => {
    const proposeForSlot: ProposeForSlot = async () => {
      throw new Error("réseau KO");
    };
    const cat = await assembleLiveCatalog(prof(), { proposeForSlot });
    expect(cat.source).toBe("seed");
  });

  it("un seul slot live → catalogue mixte", async () => {
    const proposeForSlot: ProposeForSlot = async (slot, _p, seedSlot) =>
      slot === "c4" ? liveCand(slot, seedSlot.recommended.role) : null;
    const cat = await assembleLiveCatalog(prof(), { proposeForSlot });
    expect(cat.source).toBe("mixed");
    expect(cat.slots.c4.recommended.provenance).toBe("live");
    expect(cat.slots.c2.recommended.provenance).toBe("seed");
  });
});

describe("proposeForSlotLive (veille réelle web + LLM, S-036)", () => {
  const seedSlot: CatalogSlot = seedCatalog("MEDIUM", prof()).slots.c4;
  const results: WebSearchResult[] = [{ title: "Best embeddings", url: "https://hf.co/model-x", snippet: "MTEB #1" }];
  const search = async (): Promise<WebSearchResult[]> => results;

  it("propose un candidat sourcé quand le LLM cite une URL des résultats", async () => {
    const llm = async (_m: LlmMessage[]): Promise<LlmResult> => ({
      ok: true,
      content: '{"name":"Model-X","sovereignty":"sovereign","benchmarkRank":"#1 MTEB","sourceUrl":"https://hf.co/model-x"}',
    });
    const c = await proposeForSlotLive("c4", prof(), seedSlot, { search, llm, now: () => new Date("2026-05-27") });
    expect(c).not.toBeNull();
    expect(c?.name).toBe("Model-X");
    expect(c?.provenance).toBe("live");
    expect(c?.source.url).toBe("https://hf.co/model-x");
  });

  it("rejette une URL hallucinée (pas dans les résultats) → null (DÉFCON 1)", async () => {
    const llm = async (): Promise<LlmResult> => ({
      ok: true,
      content: '{"name":"Model-Y","sourceUrl":"https://inventee.example/never"}',
    });
    expect(await proposeForSlotLive("c4", prof(), seedSlot, { search, llm })).toBeNull();
  });

  it("LLM en échec → null (repli seed)", async () => {
    const llm = async (): Promise<LlmResult> => ({ ok: false, reason: "timeout" });
    expect(await proposeForSlotLive("c4", prof(), seedSlot, { search, llm })).toBeNull();
  });

  it("aucun résultat web → null (pas de source = pas de proposition)", async () => {
    const llm = async (): Promise<LlmResult> => ({ ok: true, content: "{}" });
    expect(await proposeForSlotLive("c4", prof(), seedSlot, { search: async () => [], llm })).toBeNull();
  });
});
