import { describe, expect, it } from "vitest";
import { seedEvidence } from "../seed";
import type { EvidenceClaim } from "../types";

const claim: EvidenceClaim = { kind: "citation", subject: "OVH", query: "ovh pricing" };

describe("seedEvidence", () => {
  it("renvoie un repli daté conservateur SANS source (DÉFCON : rien d'inventé)", () => {
    const ev = seedEvidence(claim, "2026-06-10");
    expect(ev.provenance).toBe("seed");
    expect(ev.confidence).toBe("dated");
    expect(ev.sources).toEqual([]);
    expect(ev.verdict).toBe("unattested"); // FALLBACK_VERDICT.citation
    expect(ev.generatedAt).toBe("2026-06-10");
    expect(ev.rationale.length).toBeGreaterThan(0);
  });

  it("verdict conservateur par kind", () => {
    expect(seedEvidence({ ...claim, kind: "external_drift" }, "2026-06-10").verdict).toBe("unknown");
    expect(seedEvidence({ ...claim, kind: "cross_check" }, "2026-06-10").verdict).toBe("unverifiable");
  });
});
