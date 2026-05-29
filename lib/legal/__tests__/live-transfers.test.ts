import { describe, it, expect } from "vitest";
import type { LlmMessage, LlmResult } from "@/lib/llm";
import type { WebSearchResult } from "@/lib/pricing/scraper";
import { proposeTransferLive, refreshTransferBases, type ProposeTransferDeps } from "@/lib/legal/live-transfers";
import type { LiveTransferSignal } from "@/lib/legal/reconcile";

// S-062, veille live (Firecrawl + LLM mockés). Vérifie : extraction sourcée, anti-hallucination d'URL,
// repli seed (LLM KO / recherche vide), flux volatils rafraîchis, flux stables intacts (pas de veille).

const RESULTS: WebSearchResult[] = [
  { title: "EU-US Data Privacy Framework", url: "https://commission.europa.eu/dpf", snippet: "DPF adequacy decision in force." },
  { title: "Adequacy decisions", url: "https://commission.europa.eu/adequacy", snippet: "List of adequate countries." },
];

function deps(over: Partial<ProposeTransferDeps> = {}): ProposeTransferDeps {
  return {
    search: async () => RESULTS,
    llm: async (): Promise<LlmResult> => ({ ok: true, content: '{"status":"restricted","sourceUrl":"https://commission.europa.eu/dpf","note":"DPF en vigueur"}' }),
    now: () => new Date("2026-08-01T00:00:00Z"),
    ...over,
  };
}

describe("proposeTransferLive (veille d'un flux)", () => {
  it("résultats + LLM JSON valide (URL ∈ résultats) → signal sourcé daté", async () => {
    const s = await proposeTransferLive("eu", "us", deps());
    expect(s?.status).toBe("restricted");
    expect(s?.source.url).toBe("https://commission.europa.eu/dpf");
    expect(s?.source.checkedAt).toBe("2026-08-01");
  });

  it("recherche vide → null (repli seed côté orchestrateur)", async () => {
    const s = await proposeTransferLive("eu", "us", deps({ search: async () => [] }));
    expect(s).toBeNull();
  });

  it("LLM KO → null", async () => {
    const s = await proposeTransferLive("eu", "us", deps({ llm: async () => ({ ok: false, reason: "down" }) }));
    expect(s).toBeNull();
  });

  it("DÉFCON 1 : URL hallucinée (absente des résultats) → null", async () => {
    const s = await proposeTransferLive(
      "eu",
      "us",
      deps({ llm: async () => ({ ok: true, content: '{"status":"ok","sourceUrl":"https://inventee.example/x"}' }) }),
    );
    expect(s).toBeNull();
  });

  it("statut hors énum → null", async () => {
    const s = await proposeTransferLive(
      "eu",
      "us",
      deps({ llm: async () => ({ ok: true, content: '{"status":"maybe","sourceUrl":"https://commission.europa.eu/dpf"}' }) }),
    );
    expect(s).toBeNull();
  });
});

describe("refreshTransferBases (orchestration)", () => {
  const now = (): Date => new Date("2026-08-01T00:00:00Z");
  const baseDeps = (signal: LiveTransferSignal | null): Parameters<typeof refreshTransferBases>[0] => ({
    search: async () => RESULTS,
    llm: async (_m: LlmMessage[]): Promise<LlmResult> => ({ ok: false, reason: "unused" }),
    now,
    proposeTransfer: async () => signal,
  });

  it("flux volatil + signal concordant → statut confirmé (provenance live)", async () => {
    const bases = await refreshTransferBases(
      baseDeps({ status: "restricted", source: { label: "x", url: "https://commission.europa.eu/dpf", checkedAt: "2026-08-01" } }),
      [{ from: "eu", to: "us" }],
    );
    expect(bases).toHaveLength(1);
    expect(bases[0]?.provenance).toBe("live");
    expect(bases[0]?.checkedAt).toBe("2026-08-01");
  });

  it("flux STABLE (non volatil) → aucune veille, repli seed (provenance seed)", async () => {
    let called = 0;
    const bases = await refreshTransferBases(
      {
        search: async () => RESULTS,
        llm: async (): Promise<LlmResult> => ({ ok: false, reason: "x" }),
        now,
        proposeTransfer: async () => {
          called += 1;
          return null;
        },
      },
      [{ from: "eu", to: "eu" }], // même juridiction → non volatil
    );
    expect(bases[0]?.provenance).toBe("seed");
    expect(bases[0]?.status).toBe("ok");
    expect(called).toBe(0); // la veille n'est PAS lancée pour un flux stable
  });

  it("veille qui lève → repli seed gracieux (jamais d'exception)", async () => {
    const bases = await refreshTransferBases(
      {
        search: async () => RESULTS,
        llm: async (): Promise<LlmResult> => ({ ok: false, reason: "x" }),
        now,
        proposeTransfer: async () => {
          throw new Error("réseau KO");
        },
      },
      [{ from: "eu", to: "us" }],
    );
    expect(bases[0]?.provenance).toBe("seed");
    expect(bases[0]?.status).toBe("restricted");
  });

  it("par défaut, surveille DPF UE-US + adéquation Maroc (2 flux volatils)", async () => {
    const bases = await refreshTransferBases(baseDeps(null));
    expect(bases).toHaveLength(2);
    expect(bases.every((b) => b.disclaimer.length > 0 && b.checkedAt.length > 0)).toBe(true);
  });
});
