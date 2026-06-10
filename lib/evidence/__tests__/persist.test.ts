import { describe, expect, it, vi } from "vitest";
import { persistEvidenceObservations } from "../persist";
import type { SourcedEvidence } from "../types";

function ev(provenance: "live" | "seed"): SourcedEvidence {
  return {
    claim: { kind: "citation", subject: "OVH", query: "ovh" },
    sources: [],
    verdict: "attested",
    confidence: provenance === "live" ? "low" : "dated",
    provenance,
    rationale: "x",
    generatedAt: "2026-06-10",
  };
}

function fakeClient(insert: ReturnType<typeof vi.fn>) {
  return { from: vi.fn(() => ({ insert })) };
}

describe("persistEvidenceObservations", () => {
  it("n'écrit QUE le live (le seed n'est pas une observation)", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    // @ts-expect-error client minimal de test
    const n = await persistEvidenceObservations([ev("live"), ev("seed")], { client: fakeClient(insert) });
    expect(n).toBe(1);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("aucun live → 0, pas d'insert", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    // @ts-expect-error client minimal de test
    const n = await persistEvidenceObservations([ev("seed")], { client: fakeClient(insert) });
    expect(n).toBe(0);
    expect(insert).not.toHaveBeenCalled();
  });

  it("erreur Supabase → 0, jamais throw", async () => {
    const insert = vi.fn(async () => ({ error: { message: "boom" } }));
    // @ts-expect-error client minimal de test
    const n = await persistEvidenceObservations([ev("live")], { client: fakeClient(insert) });
    expect(n).toBe(0);
  });
});
