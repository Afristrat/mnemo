import { describe, it, expect, vi, beforeEach } from "vitest";

// fetchWithTimeout mocké → réponse Statuspage déterministe, sans réseau.
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("@/lib/utils/fetchWithTimeout", () => ({
  fetchWithTimeout: fetchMock,
  DEFAULT_FETCH_TIMEOUT_MS: 10_000,
}));

import { GET } from "@/app/api/sla/status/route";

const STATUSPAGE = {
  incidents: [
    {
      name: "Incident test",
      impact: "minor",
      status: "resolved",
      started_at: new Date().toISOString(),
      resolved_at: new Date().toISOString(),
      shortlink: "https://stspg.io/x",
    },
  ],
};

function req(cls: string): Request {
  return new Request(`http://localhost/api/sla/status?class=${cls}`, {
    headers: { "x-forwarded-for": "203.0.113.50" },
  });
}

describe("GET /api/sla/status (SLA #5 observé)", () => {
  beforeEach(() => fetchMock.mockReset());

  it("400 si la classe d'hébergement est invalide", async () => {
    expect((await GET(req("nimporte"))).status).toBe(400);
  });

  it("souverain UE : agrège les statuts live des fournisseurs Statuspage", async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => JSON.stringify(STATUSPAGE) });
    const res = await GET(req("sovereign-eu"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.statuses)).toBe(true);
    expect(body.statuses.length).toBeGreaterThan(0);
    const scaleway = body.statuses.find((s: { providerId: string }) => s.providerId === "scaleway");
    expect(scaleway.provenance).toBe("live");
  });

  it("repli : si le fetch échoue, le fournisseur tombe en provenance=seed (jamais d'erreur 500)", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 }); // provider indisponible → repli seed
    const res = await GET(req("hyperscaler"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.statuses.every((s: { provenance: string }) => s.provenance === "seed")).toBe(true);
  });
});
