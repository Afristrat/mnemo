import { describe, expect, it, vi } from "vitest";
import { buildClaimsForReco, gatherCitations } from "../citations";
import { recommend } from "@/lib/engine";
import { baseProfile } from "./fixture";
import type { LlmResult } from "@/lib/llm";
import type { WebSearchResult } from "@/lib/pricing/scraper";

const profile = baseProfile();
const reco = recommend(profile);

describe("buildClaimsForReco", () => {
  it("produit des claims de kind 'citation' couvrant coût/juridique/SLA/provider", () => {
    const claims = buildClaimsForReco(profile, reco);
    expect(claims.length).toBeGreaterThan(0);
    expect(claims.every((c) => c.kind === "citation")).toBe(true);
    expect(claims.every((c) => c.query.length > 0 && c.subject.length > 0)).toBe(true);
    // au moins un claim juridique (régime rgpd du profil) et un claim SLA
    expect(claims.some((c) => c.subject.includes("rgpd"))).toBe(true);
    expect(claims.some((c) => c.subject.includes("SLA"))).toBe(true);
  });
});

describe("gatherCitations", () => {
  it("orchestre gather sur chaque claim et renvoie des SourcedEvidence", async () => {
    const results: WebSearchResult[] = [{ title: "T", url: "https://x.example", snippet: "s" }];
    const deps = {
      search: vi.fn(async () => results),
      llm: vi.fn(
        async (): Promise<LlmResult> => ({
          ok: true,
          content: JSON.stringify({ verdict: "attested", rationale: "ok", sourceUrls: ["https://x.example"] }),
        }),
      ),
    };
    const items = await gatherCitations(profile, reco, deps, "2026-06-10");
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]?.claim.kind).toBe("citation");
    expect(items.every((i) => i.generatedAt === "2026-06-10")).toBe(true);
  });
});
