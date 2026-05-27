import { describe, it, expect, vi } from "vitest";
import { getLivePrices } from "@/lib/pricing/live-feed";
import { MEDIA_PRICE_SEED } from "@/lib/pricing/media-seed";
import { BACKUP_PRICE_SEED } from "@/lib/pricing/backup-seed";

// S-025, feed LIVE : extraction structurée + garde-fou. fetchImpl routé (Frankfurter + 3 pages
// Firecrawl distinguées par l'URL du body). Jamais de réseau réel.

type FcJson = Record<string, unknown>;

function firecrawl(json: FcJson): Response {
  return { ok: true, json: async () => ({ success: true, data: { json } }) } as unknown as Response;
}
function frankfurter(eur: number): Response {
  return { ok: true, json: async () => ({ date: "2026-05-27", rates: { EUR: eur } }) } as unknown as Response;
}
function notOk(): Response {
  return { ok: false, status: 500, json: async () => ({}) } as unknown as Response;
}

function router(handlers: {
  gpu?: FcJson | null;
  h100?: FcJson | null;
  storage?: FcJson | null;
  fx?: number;
}): typeof fetch {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("frankfurter")) return frankfurter(handlers.fx ?? 0.9);
    if (url.includes("firecrawl")) {
      const raw = typeof init?.body === "string" ? init.body : "{}";
      const body: { url?: string } = JSON.parse(raw);
      const target = body.url ?? "";
      if (target.includes("/h100/")) return handlers.h100 == null ? notOk() : firecrawl(handlers.h100);
      if (target.includes("/pricing/gpu/")) return handlers.gpu == null ? notOk() : firecrawl(handlers.gpu);
      if (target.includes("/pricing/storage/")) return handlers.storage == null ? notOk() : firecrawl(handlers.storage);
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

  it("Firecrawl indisponible partout → tout en repli seed (jamais de throw)", async () => {
    const fetchImpl = router({ gpu: null, h100: null, storage: null, fx: 0.9 });
    const feed = await getLivePrices({ apiKey: "k", fetchImpl, now: FIXED_NOW });
    expect(feed.items.every((i) => i.status === "fallback")).toBe(true);
    expect(feed.media.storagePerGbMonth.amount).toBe(MEDIA_PRICE_SEED.storagePerGbMonth.amount);
    expect(feed.backup.egressPerGb.amount).toBe(BACKUP_PRICE_SEED.egressPerGb.amount);
  });

  it("clé Firecrawl absente → extraction nulle → repli seed", async () => {
    const fetchImpl = router({ gpu: GPU_OK, h100: H100_OK, storage: STORAGE_OK, fx: 0.9 });
    const feed = await getLivePrices({ apiKey: undefined, fetchImpl, now: FIXED_NOW });
    expect(feed.items.every((i) => i.status === "fallback")).toBe(true);
  });
});
