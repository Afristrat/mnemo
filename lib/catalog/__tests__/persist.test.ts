import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { persistCatalogObservations } from "@/lib/catalog/persist";
import { seedCatalog, type Catalog } from "@/lib/catalog";
import { decidePreset } from "@/lib/engine";
import { DEFAULT_PROFILE } from "@/lib/wizard/defaultProfile";

// Mock minimal du client Supabase service-role : seul `.from(table).insert(rows)` est exercé par le
// helper. Le cast est justifié et borné au test (on ne simule que la surface réellement appelée).
function mockClient(error: unknown = null) {
  const insert = vi.fn(async () => ({ error }));
  const client = { from: vi.fn(() => ({ insert })) } as unknown as SupabaseClient<Database>;
  return { client, insert };
}

const seed = seedCatalog(decidePreset(DEFAULT_PROFILE).preset, DEFAULT_PROFILE);
function withLiveC0(provenance: "live" | "flagged"): Catalog {
  return { ...seed, slots: { ...seed.slots, c0: { ...seed.slots.c0, recommended: { ...seed.slots.c0.recommended, provenance } } } };
}

describe("persistCatalogObservations (S-036, audit trail)", () => {
  it("catalogue 100 % seed → aucune écriture (le seed n'est pas une observation)", async () => {
    const { client, insert } = mockClient();
    expect(await persistCatalogObservations(seed, { client })).toBe(0);
    expect(insert).not.toHaveBeenCalled();
  });

  it("au moins une couche live/flagged → insère une ligne par couche (7)", async () => {
    const { client, insert } = mockClient();
    expect(await persistCatalogObservations(withLiveC0("live"), { client })).toBe(7);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("client absent → 0, ne lève jamais", async () => {
    expect(await persistCatalogObservations(withLiveC0("flagged"), { client: null })).toBe(0);
  });

  it("erreur d'insertion → 0, ne lève jamais", async () => {
    const { client } = mockClient({ message: "boom" });
    expect(await persistCatalogObservations(withLiveC0("live"), { client })).toBe(0);
  });
});
