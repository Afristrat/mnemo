import { describe, expect, it } from "vitest";
import { buildEvidencePack } from "../pack";
import type { SourcedEvidence } from "../types";

const items: SourcedEvidence[] = [
  {
    claim: { kind: "citation", subject: "OVH juridiction", query: "ovh" },
    sources: [{ url: "https://ovh.com/legal", title: "OVH legal", snippet: "EU", retrievedAt: "2026-06-10" }],
    verdict: "attested",
    confidence: "low",
    provenance: "live",
    rationale: "Hébergé en UE.",
    generatedAt: "2026-06-10",
  },
];

describe("buildEvidencePack", () => {
  it("produit MD + JSON + hash SHA-256 stable (64 hex)", async () => {
    const pack = await buildEvidencePack(items, "Sources & preuves");
    expect(pack.integrityHash).toMatch(/^[0-9a-f]{64}$/);
    expect(pack.markdown).toContain("Sources & preuves");
    expect(pack.markdown).toContain("OVH juridiction");
    expect(pack.markdown).toContain("https://ovh.com/legal");
    expect(pack.json).toContain("integrityHash");
  });

  it("hash déterministe (même entrée → même hash)", async () => {
    const a = await buildEvidencePack(items, "T");
    const b = await buildEvidencePack(items, "T");
    expect(a.integrityHash).toBe(b.integrityHash);
  });
});
