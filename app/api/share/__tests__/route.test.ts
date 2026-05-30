import { describe, it, expect, vi, beforeEach } from "vitest";

// createClient (Supabase SSR) mocké → test déterministe, sans réseau ni base.
const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { POST } from "@/app/api/share/route";
import { GET } from "@/app/api/share/[id]/route";
import { encodeProfileToParam } from "@/lib/share";
import { DEFAULT_PROFILE } from "@/lib/wizard/defaultProfile";

const VALID_ENCODED = encodeProfileToParam(DEFAULT_PROFILE);
const FAKE_ID = "11111111-2222-4333-8444-555555555555";

function postReq(body: unknown): Request {
  return new Request("http://localhost/api/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/share (création du lien court, S-067)", () => {
  beforeEach(() => createClientMock.mockReset());

  it("400 si « encoded » absent", async () => {
    expect((await POST(postReq({}))).status).toBe(400);
  });

  it("400 si « encoded » ne décode pas en Profile valide (DÉFCON 1 : on ne stocke pas n'importe quoi)", async () => {
    expect((await POST(postReq({ encoded: "pas-un-profil" }))).status).toBe(400);
  });

  it("encoded valide → insère (id généré côté serveur, SANS returning) et le renvoie", async () => {
    // L'insert n'appelle PLUS `.select()` : l'id est généré côté serveur (cf. route). On vérifie que
    // l'id renvoyé est un uuid et qu'il a bien été passé à l'insert (même id en base et en réponse).
    const insert = vi.fn().mockResolvedValue({ error: null });
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn().mockReturnValue({ insert }),
    });
    const res = await POST(postReq({ encoded: VALID_ENCODED }));
    expect(res.status).toBe(200);
    const returnedId: unknown = (await res.json()).id;
    expect(typeof returnedId).toBe("string");
    expect(returnedId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu);
    // circle_id null (anonyme), created_by null (pas de session), id = celui renvoyé.
    expect(insert).toHaveBeenCalledWith({ id: returnedId, circle_id: null, created_by: null, encoded: VALID_ENCODED });
  });

  it("503 si Supabase indisponible (createClient lève)", async () => {
    createClientMock.mockImplementationOnce(() => {
      throw new Error("no config");
    });
    expect((await POST(postReq({ encoded: VALID_ENCODED }))).status).toBe(503);
  });

  it("503 si l'insert échoue", async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn().mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: { message: "boom" } }) }),
    });
    expect((await POST(postReq({ encoded: VALID_ENCODED }))).status).toBe(503);
  });
});

function getCtx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/share/[id] (lecture par id, S-067)", () => {
  beforeEach(() => createClientMock.mockReset());

  it("400 si l'id n'est pas un uuid", async () => {
    const res = await GET(new Request("http://localhost/api/share/x"), getCtx("not-a-uuid"));
    expect(res.status).toBe(400);
  });

  it("id valide trouvé → renvoie la chaîne encodée", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ encoded: VALID_ENCODED }], error: null });
    createClientMock.mockResolvedValue({ rpc });
    const res = await GET(new Request(`http://localhost/api/share/${FAKE_ID}`), getCtx(FAKE_ID));
    expect(res.status).toBe(200);
    expect((await res.json()).encoded).toBe(VALID_ENCODED);
    expect(rpc).toHaveBeenCalledWith("get_shared_reco", { reco_id: FAKE_ID });
  });

  it("id valide introuvable → 404", async () => {
    createClientMock.mockResolvedValue({ rpc: vi.fn().mockResolvedValue({ data: [], error: null }) });
    const res = await GET(new Request(`http://localhost/api/share/${FAKE_ID}`), getCtx(FAKE_ID));
    expect(res.status).toBe(404);
  });

  it("503 si la lecture échoue", async () => {
    createClientMock.mockResolvedValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }) });
    const res = await GET(new Request(`http://localhost/api/share/${FAKE_ID}`), getCtx(FAKE_ID));
    expect(res.status).toBe(503);
  });
});
