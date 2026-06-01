import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { persistRegimeObservations } from "@/lib/legal/regime-persist";
import { regimesSeedFor, type RegimeSuggestion } from "@/lib/legal/regime-seed";

// S-077 tranche 3 : persistance gatée « live seulement » (le seed daté n'est pas une observation),
// jamais bloquante. Mock minimal du client service-role (seul `.from(table).insert(rows)` est exercé).

function mockClient(error: unknown = null) {
  const insert = vi.fn(async () => ({ error }));
  const client = { from: vi.fn(() => ({ insert })) } as unknown as SupabaseClient<Database>;
  return { client, insert };
}

function liveRegime(): RegimeSuggestion {
  return {
    code: null,
    name: "Marco Civil",
    scope: "other",
    country: "bresil",
    confidence: "low",
    provenance: "live",
    source: { label: "Veille web — Marco Civil", url: "https://x.example/law", checkedAt: "2026-06-01" },
  };
}

describe("persistRegimeObservations (S-077, audit trail)", () => {
  it("régimes 100 % seed → aucune écriture (le seed n'est pas une observation)", async () => {
    const { client, insert } = mockClient();
    expect(await persistRegimeObservations(regimesSeedFor("union-europeenne"), { client })).toBe(0);
    expect(insert).not.toHaveBeenCalled();
  });

  it("au moins un régime live → insère (une ligne par régime live)", async () => {
    const { client, insert } = mockClient();
    const regimes = [...regimesSeedFor("bresil"), liveRegime()]; // 1 seed + 1 live
    expect(await persistRegimeObservations(regimes, { client })).toBe(1); // seul le live est persisté
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("client absent → 0, ne lève jamais", async () => {
    expect(await persistRegimeObservations([liveRegime()], { client: null })).toBe(0);
  });

  it("erreur d'insertion → 0, ne lève jamais", async () => {
    const { client } = mockClient({ message: "boom" });
    expect(await persistRegimeObservations([liveRegime()], { client })).toBe(0);
  });
});
