import { describe, it, expect, vi, beforeEach } from "vitest";

const { callLLMMock } = vi.hoisted(() => ({ callLLMMock: vi.fn() }));
vi.mock("@/lib/llm/client", () => ({ callLLM: callLLMMock }));

import { POST } from "@/app/api/llm/narrate/route";

const BASE = {
  pain: "Douleur de base.",
  risk: "Risque de base.",
  gain: "Gain de base.",
  nextStep: "Étape de base.",
  presetReason: "Raison de base.",
};

function post(body: unknown): Request {
  return new Request("http://localhost/api/llm/narrate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/llm/narrate", () => {
  beforeEach(() => callLLMMock.mockReset());

  it("400 si aucun texte de base", async () => {
    expect((await POST(post({ activity: "freelance" }))).status).toBe(400);
  });

  it("LLM OK → textes réécrits, montant réintroduit rejeté (repli base)", async () => {
    callLLMMock.mockResolvedValue({
      ok: true,
      content: JSON.stringify({ pain: "Votre mémoire se disperse.", risk: "Coût 130 €/mois" }),
    });
    const res = await POST(post({ activity: "pme-startup", preset: "MEDIUM", base: BASE }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.pain).toContain("se disperse");
    expect(data.risk).toBe(BASE.risk); // montant → rejeté, repli
  });

  it("LLM KO → repli sur les textes de base", async () => {
    callLLMMock.mockResolvedValue({ ok: false, reason: "proxy indisponible" });
    const res = await POST(post({ base: BASE }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(BASE);
  });
});
