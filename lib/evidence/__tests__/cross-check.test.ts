import { describe, expect, it, vi } from "vitest";
import { extractClaim, runCrossCheck } from "../cross-check";
import type { LlmResult } from "@/lib/llm";
import type { WebSearchResult } from "@/lib/pricing/scraper";

describe("extractClaim", () => {
  it("borne et résume l'artefact collé (type guard, longueur)", () => {
    const c = extractClaim("OVHcloud certifie héberger en France (datacenter Gravelines).", "provider-cert");
    expect(c.expected.length).toBeGreaterThan(0);
    expect(c.subject.length).toBeGreaterThan(0);
  });
  it("artefact vide → expected vide (run repliera unverifiable)", () => {
    expect(extractClaim("", "provider-cert").expected).toBe("");
  });
});

describe("runCrossCheck", () => {
  it("match si les sources confirment", async () => {
    const results: WebSearchResult[] = [{ title: "OVH", url: "https://ovh.com", snippet: "Gravelines France" }];
    const deps = {
      search: vi.fn(async () => results),
      llm: vi.fn(
        async (): Promise<LlmResult> => ({
          ok: true,
          content: JSON.stringify({ verdict: "match", rationale: "confirmé", sourceUrls: ["https://ovh.com"] }),
        }),
      ),
    };
    const ev = await runCrossCheck("OVH héberge en France", "provider-cert", deps, "2026-06-10");
    expect(ev.verdict).toBe("match");
    expect(ev.claim.kind).toBe("cross_check");
  });
  it("artefact vide → unverifiable (pas d'appel réseau requis)", async () => {
    const deps = {
      search: vi.fn(async () => []),
      llm: vi.fn(async (): Promise<LlmResult> => ({ ok: false, reason: "x" })),
    };
    const ev = await runCrossCheck("", "provider-cert", deps, "2026-06-10");
    expect(ev.verdict).toBe("unverifiable");
    expect(deps.search).not.toHaveBeenCalled();
  });
});
