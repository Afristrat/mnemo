import { describe, expect, it, vi, beforeEach } from "vitest";

// On mocke la brique pour tester le contrat HTTP de la route (pas le réseau réel).
vi.mock("@/lib/evidence/citations", () => ({
  gatherCitations: vi.fn(async () => [
    {
      claim: { kind: "citation", subject: "OVH", query: "ovh" },
      sources: [],
      verdict: "attested",
      confidence: "low",
      provenance: "live",
      rationale: "x",
      generatedAt: "2026-06-10",
    },
  ]),
}));
vi.mock("@/lib/evidence/persist", () => ({ persistEvidenceObservations: vi.fn(async () => 1) }));

import { POST } from "../route";
import { baseProfile } from "@/lib/evidence/__tests__/fixture";

function req(body: unknown): Request {
  return new Request("http://localhost/api/evidence/citations", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/evidence/citations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("profil valide → 200 + pack (items + integrityHash)", async () => {
    const res = await POST(req({ profile: baseProfile() }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.items)).toBe(true);
    expect(typeof json.integrityHash).toBe("string");
  });

  it("corps non-objet → 400", async () => {
    const res = await POST(req("nope"));
    expect(res.status).toBe(400);
  });

  it("profil invalide → 400", async () => {
    const res = await POST(req({ profile: { junk: true } }));
    expect(res.status).toBe(400);
  });
});
