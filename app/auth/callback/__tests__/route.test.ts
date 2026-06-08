import { describe, it, expect, vi, beforeEach } from "vitest";

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { GET } from "@/app/auth/callback/route";

function reqWith(qs: string): Request {
  return new Request(`http://localhost/auth/callback${qs}`);
}
function clientWith(exchange: ReturnType<typeof vi.fn>): unknown {
  return { auth: { exchangeCodeForSession: exchange } };
}
function location(res: Response): string {
  return res.headers.get("location") ?? "";
}

describe("GET /auth/callback (S-089 — échange PKCE)", () => {
  beforeEach(() => createClientMock.mockReset());

  it("code valide → échange puis redirige vers next interne (/compte par défaut)", async () => {
    const exchange = vi.fn().mockResolvedValue({ error: null });
    createClientMock.mockResolvedValue(clientWith(exchange));
    const res = await GET(reqWith("?code=abc"));
    expect(res.status).toBe(307);
    expect(location(res)).toMatch(/\/compte$/);
    expect(exchange).toHaveBeenCalledWith("abc");
  });

  it("respecte un `next` interne explicite", async () => {
    createClientMock.mockResolvedValue(clientWith(vi.fn().mockResolvedValue({ error: null })));
    const res = await GET(reqWith("?code=abc&next=/admin"));
    expect(location(res)).toMatch(/\/admin$/);
  });

  it("anti open-redirect : un `next` externe (//evil) retombe sur /compte", async () => {
    createClientMock.mockResolvedValue(clientWith(vi.fn().mockResolvedValue({ error: null })));
    const res = await GET(reqWith("?code=abc&next=//evil.com"));
    expect(location(res)).toMatch(/\/compte$/);
    expect(location(res)).not.toMatch(/evil/);
  });

  it("sans code → /connexion?error=auth", async () => {
    const res = await GET(reqWith(""));
    expect(location(res)).toMatch(/\/connexion\?error=auth$/);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("échec d'échange → /connexion?error=auth (jamais de détail)", async () => {
    createClientMock.mockResolvedValue(clientWith(vi.fn().mockResolvedValue({ error: { message: "bad code" } })));
    const res = await GET(reqWith("?code=bad"));
    expect(location(res)).toMatch(/\/connexion\?error=auth$/);
  });
});
