import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEFAULT_PROFILE } from "@/lib/wizard/defaultProfile";

// callLLM mocké → test déterministe, indépendant de l'environnement (clé LITELLM absente ou non).
const { callLLMMock } = vi.hoisted(() => ({ callLLMMock: vi.fn() }));
vi.mock("@/lib/llm/client", () => ({ callLLM: callLLMMock }));

import { POST } from "@/app/api/llm/intake/route";

function post(body: unknown): Request {
  return new Request("http://localhost/api/llm/intake", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/llm/intake", () => {
  beforeEach(() => callLLMMock.mockReset());

  it("400 si le champ texte est absent ou vide", async () => {
    expect((await POST(post({}))).status).toBe(400);
    expect((await POST(post({ text: "   " }))).status).toBe(400);
  });

  it("LLM OK → profil validé/borné (le LLM extrait, le serveur valide)", async () => {
    callLLMMock.mockResolvedValue({ ok: true, content: JSON.stringify({ sensitivity: "secret", users: 9 }) });
    const res = await POST(post({ text: "données secrètes, 9 personnes" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.profile.sensitivity).toBe("secret");
    expect(data.profile.users).toBe(9);
    expect(data.applied).toEqual(expect.arrayContaining(["sensitivity", "users"]));
  });

  it("LLM KO → repli profil par défaut prudent, rejected ['llm']", async () => {
    callLLMMock.mockResolvedValue({ ok: false, reason: "proxy indisponible" });
    const res = await POST(post({ text: "peu importe" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.rejected).toContain("llm");
    expect(data.profile.sensitivity).toBe(DEFAULT_PROFILE.sensitivity);
  });

  it("base fournie (note libre S-052) → AJUSTE le profil et injecte le contexte dans le prompt", async () => {
    callLLMMock.mockResolvedValue({ ok: true, content: JSON.stringify({ contentTypes: ["text", "video"] }) });
    const base = { ...DEFAULT_PROFILE, activity: "agence", contentTypes: ["text"] };
    const res = await POST(post({ text: "on ajoute de la vidéo", base }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.profile.contentTypes).toEqual(["text", "video"]);
    // Le prompt a reçu le profil actuel pour l'AJUSTEMENT (pas un repli au défaut).
    const messages = callLLMMock.mock.calls[0][0];
    expect(messages[0].content).toContain("CURRENT PROFILE");
    expect(messages[0].content).toContain("agence");
  });
});
