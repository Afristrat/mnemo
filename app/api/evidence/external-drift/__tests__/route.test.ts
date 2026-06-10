import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/evidence/external-drift", () => ({
  runExternalDrift: vi.fn(async () => ({
    generatedAt: "2026-06-10",
    asOf: "2026-01-01",
    signals: [],
    changedCount: 0,
    unknownCount: 0,
    inSync: true,
    disclaimer: "d",
  })),
}));
vi.mock("@/lib/evidence/persist", () => ({ persistEvidenceObservations: vi.fn(async () => 0) }));

import { POST } from "../route";
import { baseProfile } from "@/lib/evidence/__tests__/fixture";

function req(body: unknown): Request {
  return new Request("http://localhost/api/evidence/external-drift", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/evidence/external-drift", () => {
  beforeEach(() => vi.clearAllMocks());

  it("profil + asOf → 200 (rapport)", async () => {
    const res = await POST(req({ profile: baseProfile(), asOf: "2026-01-01" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("signals");
  });

  it("corps invalide → 400", async () => {
    expect((await POST(req(42))).status).toBe(400);
  });

  it("profil invalide → 400", async () => {
    expect((await POST(req({ profile: { junk: 1 } }))).status).toBe(400);
  });
});
