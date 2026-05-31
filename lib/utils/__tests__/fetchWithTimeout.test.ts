import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout } from "@/lib/utils/fetchWithTimeout";

// Borne de temps des appels live (correctif « /resultats ne s'idle jamais ») : au-delà du délai, la
// requête est abandonnée et la promesse rejette → l'appelant retombe sur son repli.

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** fetch factice qui ne résout jamais, mais rejette dès que son signal est abandonné. */
function fetchThatHangs(): typeof fetch {
  return vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (signal?.aborted === true) {
        reject(new DOMException("aborted", "AbortError"));
        return;
      }
      signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    });
  }) as unknown as typeof fetch;
}

describe("fetchWithTimeout", () => {
  it("retourne la réponse quand le fetch répond avant le délai", async () => {
    const res = new Response("ok");
    vi.stubGlobal("fetch", vi.fn(async () => res));
    await expect(fetchWithTimeout("/x", {}, 1000)).resolves.toBe(res);
  });

  it("abandonne (rejette) le fetch au-delà du délai", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", fetchThatHangs());
    const assertion = expect(fetchWithTimeout("/x", {}, 5000)).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
  });

  it("propage une annulation externe déjà abandonnée (rejette immédiatement)", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal("fetch", fetchThatHangs());
    await expect(fetchWithTimeout("/x", { signal: controller.signal }, 5000)).rejects.toThrow();
  });
});
