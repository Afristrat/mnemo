import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { persistTransferObservations } from "@/lib/legal/persist";
import type { TransferBasis } from "@/lib/legal/transfers";

// Mock minimal du client Supabase service-role (cast justifié, borné au test : seule `.from().insert()`).
function mockClient(error: unknown = null) {
  const insert = vi.fn(async () => ({ error }));
  const client = { from: vi.fn(() => ({ insert })) } as unknown as SupabaseClient<Database>;
  return { client, insert };
}

function basis(over: Partial<TransferBasis> = {}): TransferBasis {
  return {
    from: "eu",
    to: "us",
    status: "restricted",
    legalBasis: "Art. 46 SCC",
    citation: "RGPD chap. V",
    source: null,
    confidence: "medium",
    volatile: true,
    checkedAt: "2026-01-01",
    cloudAct: true,
    disclaimer: "Ingénierie, pas un avis juridique.",
    provenance: "seed",
    ...over,
  };
}

describe("persistTransferObservations (S-062, audit trail)", () => {
  it("statuts 100 % seed → aucune écriture", async () => {
    const { client, insert } = mockClient();
    expect(await persistTransferObservations([basis(), basis({ to: "maroc" })], { client })).toBe(0);
    expect(insert).not.toHaveBeenCalled();
  });

  it("n'écrit QUE les bases issues de la veille (live/flagged), pas le seed", async () => {
    const { client, insert } = mockClient();
    const bases = [basis(), basis({ to: "maroc", provenance: "live" }), basis({ from: "maroc", to: "eu", provenance: "flagged" })];
    expect(await persistTransferObservations(bases, { client })).toBe(2); // 2 live/flagged sur 3
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("client absent → 0, ne lève jamais", async () => {
    expect(await persistTransferObservations([basis({ provenance: "live" })], { client: null })).toBe(0);
  });

  it("erreur d'insertion → 0, ne lève jamais", async () => {
    const { client } = mockClient({ message: "boom" });
    expect(await persistTransferObservations([basis({ provenance: "live" })], { client })).toBe(0);
  });
});
