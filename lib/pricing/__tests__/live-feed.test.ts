import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { getLivePrices } from "@/lib/pricing/live-feed";
import { MEDIA_PRICE_SEED } from "@/lib/pricing/media-seed";
import { BACKUP_PRICE_SEED } from "@/lib/pricing/backup-seed";

// S-025/S-070, feed LIVE : extraction structurée + garde-fou. Backend auto-hébergé : Crawl4AI `/md`
// (markdown) PUIS extraction JSON par le LLM local (LiteLLM `/v1/chat/completions`). fetchImpl routé
// (Frankfurter + Crawl4AI par l'URL ciblée du body + LiteLLM par le marqueur markdown). Jamais de réseau réel.

type FcJson = Record<string, unknown>;

// callLLM cible LITELLM_BASE_URL — on doit le configurer pour que l'extraction ne court-circuite pas.
beforeAll(() => {
  process.env.LITELLM_BASE_URL = "http://litellm.test";
  process.env.LITELLM_API_KEY = "test-key";
});
afterAll(() => {
  delete process.env.LITELLM_BASE_URL;
  delete process.env.LITELLM_API_KEY;
});

function md(marker: string): Response {
  return { ok: true, json: async () => ({ markdown: marker, success: true }) } as unknown as Response;
}
function llm(json: FcJson): Response {
  return {
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(json) } }] }),
  } as unknown as Response;
}
function frankfurter(eur: number): Response {
  return { ok: true, json: async () => ({ date: "2026-05-27", rates: { EUR: eur } }) } as unknown as Response;
}
function notOk(): Response {
  return { ok: false, status: 500, json: async () => ({}) } as unknown as Response;
}

type Handlers = { gpu?: FcJson | null; h100?: FcJson | null; storage?: FcJson | null; fx?: number; llmDown?: boolean };

function userContent(init: RequestInit | undefined): string {
  try {
    const body: { messages?: { role?: string; content?: string }[] } = JSON.parse(
      typeof init?.body === "string" ? init.body : "{}",
    );
    return (body.messages ?? []).filter((m) => m.role === "user").map((m) => m.content ?? "").join(" ");
  } catch {
    return "";
  }
}

function router(handlers: Handlers): typeof fetch {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("frankfurter")) return frankfurter(handlers.fx ?? 0.9);
    // Étape 1 : Crawl4AI /md → markdown marqueur identifiant la page (ou indispo).
    if (url.includes("/md")) {
      const body: { url?: string } = JSON.parse(typeof init?.body === "string" ? init.body : "{}");
      const target = body.url ?? "";
      if (target.includes("/h100/")) return handlers.h100 == null ? notOk() : md("PAGE_H100");
      if (target.includes("/pricing/gpu/")) return handlers.gpu == null ? notOk() : md("PAGE_GPU");
      if (target.includes("/pricing/storage/")) return handlers.storage == null ? notOk() : md("PAGE_STORAGE");
      return notOk();
    }
    // Étape 2 : extraction LLM → JSON structuré, routé par le marqueur présent dans le message user.
    if (url.includes("/chat/completions")) {
      if (handlers.llmDown === true) return notOk();
      const content = userContent(init);
      if (content.includes("PAGE_H100")) return handlers.h100 == null ? notOk() : llm(handlers.h100);
      if (content.includes("PAGE_GPU")) return handlers.gpu == null ? notOk() : llm(handlers.gpu);
      if (content.includes("PAGE_STORAGE")) return handlers.storage == null ? notOk() : llm(handlers.storage);
      return notOk();
    }
    return notOk();
  });
  return fn as unknown as typeof fetch;
}

const GPU_OK: FcJson = {
  gpus: [
    { model: "L4-1-24G", pricePerHourEur: 0.75 },
    { model: "H100-1-80G", pricePerHourEur: 0 },
  ],
};
const H100_OK: FcJson = { gpus: [{ model: "H100 PCIe", pricePerHourEur: 2.73 }] };
const STORAGE_OK: FcJson = {
  standardStoragePerGbMonthEur: 0.0146,
  glacierStoragePerGbMonthEur: 0.00254,
  glacierRetrievalPerGbEur: 0.009,
  egressPerGbEur: 0.01,
};

const FIXED_NOW = (): number => Date.parse("2026-05-27T00:00:00Z");

describe("getLivePrices", () => {
  it("promeut les valeurs live plausibles (GPU × heures, stockage, egress/archive)", async () => {
    const fetchImpl = router({ gpu: GPU_OK, h100: H100_OK, storage: STORAGE_OK, fx: 0.9 });
    const feed = await getLivePrices({ apiKey: "k", fetchImpl, now: FIXED_NOW });

    // L4 0,75 €/h × 200 h = 150 €/mois (= seed) → promu.
    expect(feed.media.gpuMonthly.shared.amount).toBeCloseTo(150, 1);
    expect(feed.items.find((i) => i.key === "gpu.shared")?.status).toBe("live");
    // H100 2,73 €/h × 730 h ≈ 1993 €/mois → promu.
    expect(feed.media.gpuMonthly["dedicated-large"].amount).toBeCloseTo(1992.9, 1);
    expect(feed.items.find((i) => i.key === "gpu.dedicated-large")?.status).toBe("live");
    // Stockage chaud + postes backup.
    expect(feed.media.storagePerGbMonth.amount).toBeCloseTo(0.0146, 5);
    expect(feed.backup.egressPerGb.amount).toBeCloseTo(0.01, 5);
    expect(feed.backup.archiveStoragePerGbMonth.amount).toBeCloseTo(0.00254, 6);
    expect(feed.items.filter((i) => i.group === "backup").every((i) => i.status === "live")).toBe(true);
  });

  it("page H100 indisponible → poste GPU dédié-large en repli seed (fallback)", async () => {
    const fetchImpl = router({ gpu: GPU_OK, h100: null, storage: STORAGE_OK, fx: 0.9 });
    const feed = await getLivePrices({ apiKey: "k", fetchImpl, now: FIXED_NOW });
    expect(feed.items.find((i) => i.key === "gpu.dedicated-large")?.status).toBe("fallback");
    expect(feed.media.gpuMonthly["dedicated-large"].amount).toBe(
      MEDIA_PRICE_SEED.gpuMonthly["dedicated-large"].amount,
    );
  });

  it("valeur live aberrante (stockage ×13) → rejetée (flagged), baseline conservée, confiance basse", async () => {
    const fetchImpl = router({
      gpu: GPU_OK,
      h100: H100_OK,
      storage: { ...STORAGE_OK, standardStoragePerGbMonthEur: 0.2 },
      fx: 0.9,
    });
    const feed = await getLivePrices({ apiKey: "k", fetchImpl, now: FIXED_NOW });
    const st = feed.items.find((i) => i.key === "storage");
    expect(st?.status).toBe("flagged");
    expect(st?.confidence).toBe("low");
    expect(feed.media.storagePerGbMonth.amount).toBe(MEDIA_PRICE_SEED.storagePerGbMonth.amount);
  });

  it("Crawl4AI indisponible partout → tout en repli seed (jamais de throw)", async () => {
    const fetchImpl = router({ gpu: null, h100: null, storage: null, fx: 0.9 });
    const feed = await getLivePrices({ apiKey: "k", fetchImpl, now: FIXED_NOW });
    expect(feed.items.every((i) => i.status === "fallback")).toBe(true);
    expect(feed.media.storagePerGbMonth.amount).toBe(MEDIA_PRICE_SEED.storagePerGbMonth.amount);
    expect(feed.backup.egressPerGb.amount).toBe(BACKUP_PRICE_SEED.egressPerGb.amount);
  });

  it("LLM d'extraction indisponible → extraction nulle → repli seed", async () => {
    // Crawl4AI rend bien le markdown, mais l'extraction LLM échoue → aucune valeur promue (DÉFCON 1).
    const fetchImpl = router({ gpu: GPU_OK, h100: H100_OK, storage: STORAGE_OK, fx: 0.9, llmDown: true });
    const feed = await getLivePrices({ apiKey: "k", fetchImpl, now: FIXED_NOW });
    expect(feed.items.every((i) => i.status === "fallback")).toBe(true);
  });
});
