import { describe, expect, it, vi } from "vitest";
import { gatherSourcedEvidence } from "../gather";
import type { EvidenceClaim } from "../types";
import type { WebSearchResult } from "@/lib/pricing/scraper";
import type { LlmResult } from "@/lib/llm";

const claim: EvidenceClaim = { kind: "citation", subject: "OVH juridiction", query: "ovh data jurisdiction" };
const results: WebSearchResult[] = [
  { title: "OVH legal", url: "https://ovh.com/legal", snippet: "data hosted in EU" },
  { title: "Blog", url: "https://blog.example/ovh", snippet: "opinion" },
];

function deps(search: WebSearchResult[], llmContent: string) {
  return {
    search: vi.fn(async () => search),
    llm: vi.fn(async (): Promise<LlmResult> => ({ ok: true, content: llmContent })),
  };
}

describe("gatherSourcedEvidence", () => {
  it("classe le verdict et ne garde que les URLs ∈ résultats SearXNG (anti-hallucination)", async () => {
    const llm = JSON.stringify({
      verdict: "attested",
      rationale: "OVH héberge la donnée en UE.",
      sourceUrls: ["https://ovh.com/legal", "https://hallucinated.example/fake"],
    });
    const ev = await gatherSourcedEvidence(claim, deps(results, llm), "2026-06-10");
    expect(ev.provenance).toBe("live");
    expect(ev.confidence).toBe("low");
    expect(ev.verdict).toBe("attested");
    expect(ev.sources.map((s) => s.url)).toEqual(["https://ovh.com/legal"]); // la fausse URL est rejetée
    expect(ev.sources[0]?.retrievedAt).toBe("2026-06-10"); // date injectée, pas celle du LLM
  });

  it("recherche vide → repli seed", async () => {
    const ev = await gatherSourcedEvidence(claim, deps([], "{}"), "2026-06-10");
    expect(ev.provenance).toBe("seed");
    expect(ev.verdict).toBe("unattested");
  });

  it("LLM KO → repli seed", async () => {
    const d = {
      search: vi.fn(async () => results),
      llm: vi.fn(async (): Promise<LlmResult> => ({ ok: false, reason: "x" })),
    };
    const ev = await gatherSourcedEvidence(claim, d, "2026-06-10");
    expect(ev.provenance).toBe("seed");
  });

  it("verdict LLM invalide pour le kind → fallback conservateur, mais provenance live si sources valides", async () => {
    const llm = JSON.stringify({ verdict: "banana", rationale: "x", sourceUrls: ["https://ovh.com/legal"] });
    const ev = await gatherSourcedEvidence(claim, deps(results, llm), "2026-06-10");
    expect(ev.verdict).toBe("unattested");
    expect(ev.provenance).toBe("live");
  });

  it("ne lève jamais (search throw → seed)", async () => {
    const d = {
      search: vi.fn(async () => {
        throw new Error("net");
      }),
      llm: vi.fn(async (): Promise<LlmResult> => ({ ok: true, content: "{}" })),
    };
    const ev = await gatherSourcedEvidence(claim, d, "2026-06-10");
    expect(ev.provenance).toBe("seed");
  });
});
