import { describe, it, expect, vi, beforeEach } from "vitest";

// callLLM + searchWeb mockés → test déterministe, sans réseau ni clé.
const { callLLMMock, searchWebMock } = vi.hoisted(() => ({ callLLMMock: vi.fn(), searchWebMock: vi.fn() }));
vi.mock("@/lib/llm/client", () => ({ callLLM: callLLMMock }));
vi.mock("@/lib/pricing/firecrawl", () => ({ searchWeb: searchWebMock }));

import { POST } from "@/app/api/llm/chat/route";

function post(body: unknown): Request {
  return new Request("http://localhost/api/llm/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/llm/chat (assistant Q&A, S-040)", () => {
  beforeEach(() => {
    callLLMMock.mockReset();
    searchWebMock.mockReset();
    searchWebMock.mockResolvedValue([]);
  });

  it("400 si la question est absente ou vide", async () => {
    expect((await POST(post({}))).status).toBe(400);
    expect((await POST(post({ question: "   " }))).status).toBe(400);
  });

  it("LLM OK → { ok, answer, sources } ; les FAITS reçus sont passés au prompt", async () => {
    searchWebMock.mockResolvedValue([{ title: "Qdrant", url: "https://qdrant.tech", snippet: "vector db" }]);
    callLLMMock.mockResolvedValue({ ok: true, content: "Pour les embeddings : Qwen3 (https://qdrant.tech)." });
    const res = await POST(post({ question: "embeddings ?", recoFacts: "Preset retenu : MEDIUM\nCoût total : 120 €/mois" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.answer).toContain("Qwen3");
    expect(data.sources[0].url).toBe("https://qdrant.tech");
    // Les FAITS autoritatifs ont bien été injectés dans le prompt système.
    const messages = callLLMMock.mock.calls[0][0];
    expect(messages[0].content).toContain("120 €/mois");
  });

  it("LLM KO → repli { ok:false, reason } (statut 200, jamais d'exception)", async () => {
    callLLMMock.mockResolvedValue({ ok: false, reason: "proxy indisponible" });
    const res = await POST(post({ question: "une question" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.reason).toBeTruthy();
  });
});
