import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/evidence/cross-check", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/evidence/cross-check")>();
  return {
    ...actual,
    runCrossCheck: vi.fn(async () => ({
      claim: { kind: "cross_check", subject: "X", query: "", expected: "e" },
      sources: [],
      verdict: "match",
      confidence: "low",
      provenance: "live",
      rationale: "ok",
      generatedAt: "2026-06-10",
    })),
  };
});
vi.mock("@/lib/evidence/persist", () => ({ persistEvidenceObservations: vi.fn(async () => 1) }));

import { POST } from "../route";

function req(body: unknown): Request {
  return new Request("http://localhost/api/evidence/cross-check", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/evidence/cross-check", () => {
  beforeEach(() => vi.clearAllMocks());

  it("artefact + type valide → 200", async () => {
    const res = await POST(req({ artefact: "OVH héberge en France", type: "provider-cert" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty("verdict");
  });

  it("type inconnu → 400", async () => {
    expect((await POST(req({ artefact: "x", type: "nope" }))).status).toBe(400);
  });

  it("corps invalide → 400", async () => {
    expect((await POST(req(7))).status).toBe(400);
  });
});
