import { describe, it, expect } from "vitest";
import { callLLM, type LlmMessage } from "@/lib/llm";

const MESSAGES: LlmMessage[] = [{ role: "user", content: "ping" }];
const CFG = { baseUrl: "https://proxy.test", apiKey: "sk-test" };

/** fetch de test renvoyant une réponse JSON donnée (OpenAI-compatible). */
function jsonResponse(body: unknown, status = 200): typeof fetch {
  return async () => new Response(JSON.stringify(body), { status });
}

describe("callLLM (fondation LLM plateforme, S-034)", () => {
  it("succès : renvoie le contenu du proxy (format OpenAI)", async () => {
    const fetchImpl = jsonResponse({ choices: [{ message: { content: "Bonjour" } }] });
    const r = await callLLM(MESSAGES, { ...CFG, fetchImpl });
    expect(r).toEqual({ ok: true, content: "Bonjour" });
  });

  it("HTTP 5xx → repli typé sans exception", async () => {
    const r = await callLLM(MESSAGES, { ...CFG, fetchImpl: jsonResponse({ error: "boom" }, 502) });
    expect(r.ok).toBe(false);
  });

  it("erreur réseau → repli typé (jamais de throw propagé)", async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error("ECONNREFUSED");
    };
    const r = await callLLM(MESSAGES, { ...CFG, fetchImpl });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("ECONNREFUSED");
  });

  it("réponse sans contenu exploitable → repli typé", async () => {
    const r = await callLLM(MESSAGES, { ...CFG, fetchImpl: jsonResponse({ choices: [] }) });
    expect(r.ok).toBe(false);
  });

  it("configuration absente → repli SANS appel réseau (clé jamais requise pour échouer proprement)", async () => {
    let called = false;
    const fetchImpl: typeof fetch = async () => {
      called = true;
      return new Response("{}");
    };
    const r = await callLLM(MESSAGES, { baseUrl: "", apiKey: "", fetchImpl });
    expect(r.ok).toBe(false);
    expect(called).toBe(false);
  });
});
