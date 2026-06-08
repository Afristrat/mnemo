import { describe, it, expect, vi, beforeEach } from "vitest";

// createClient (Supabase SSR) mocké → test déterministe, sans réseau ni base.
const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { POST } from "@/app/api/network/real-cost/route";

function postReq(body: unknown): Request {
  return new Request("http://localhost/api/network/real-cost", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.7" },
    body: JSON.stringify(body),
  });
}

const ENTRIES = [{ poste: "Stockage", estimated: 100, real: 130 }];

/** Stub de client de session : `from(table)` renvoie un sous-stub selon la table exercée. */
function sessionClient(opts: {
  userId: string | null;
  circleId?: string | null;
  insert?: ReturnType<typeof vi.fn>;
  upsert?: ReturnType<typeof vi.fn>;
}): { client: unknown; insert: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn> } {
  const insert = opts.insert ?? vi.fn().mockResolvedValue({ error: null });
  const upsert = opts.upsert ?? vi.fn().mockResolvedValue({ error: null });
  const circleRows = opts.circleId === undefined ? [] : [{ id: opts.circleId }];
  const from = vi.fn().mockImplementation((table: string) => {
    if (table === "circles") {
      return { select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: circleRows }) }) }) };
    }
    if (table === "network_consents") return { upsert };
    return { insert }; // real_cost_entries
  });
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: opts.userId === null ? null : { id: opts.userId } } }) },
    from,
  };
  return { client, insert, upsert };
}

describe("POST /api/network/real-cost (durcissement reliquat S-15)", () => {
  beforeEach(() => createClientMock.mockReset());

  it("400 si aucun poste valide", async () => {
    expect((await POST(postReq({ entries: [] }))).status).toBe(400);
  });

  it("sans consentement : renvoie la comparaison, ne persiste rien (createClient jamais appelé)", async () => {
    const res = await POST(postReq({ entries: ENTRIES }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.persisted).toBe(0);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("anonyme + consent : insère circle_id null sans tracer de consentement (pas d'identité)", async () => {
    const { client, insert, upsert } = sessionClient({ userId: null });
    createClientMock.mockResolvedValue(client);
    const res = await POST(postReq({ entries: ENTRIES, consent: true }));
    expect(res.status).toBe(200);
    expect((await res.json()).persisted).toBe(1);
    expect(upsert).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith([expect.objectContaining({ circle_id: null, created_by: null, poste: "Stockage" })]);
  });

  it("authentifié + consent : trace le consentement (upsert) et rattache l'écart au cercle", async () => {
    const { client, insert, upsert } = sessionClient({ userId: "u1", circleId: "c1" });
    createClientMock.mockResolvedValue(client);
    const res = await POST(postReq({ entries: ENTRIES, consent: true }));
    expect(res.status).toBe(200);
    expect((await res.json()).persisted).toBe(1);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith([expect.objectContaining({ circle_id: "c1", created_by: "u1" })]);
  });

  it("repli non bloquant : si Supabase lève, renvoie quand même la comparaison (persisted 0)", async () => {
    createClientMock.mockImplementationOnce(() => {
      throw new Error("no config");
    });
    const res = await POST(postReq({ entries: ENTRIES, consent: true }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.persisted).toBe(0);
    expect(body.comparison.posts).toHaveLength(1);
  });
});
