import { describe, it, expect, vi } from "vitest";
import { persistConsent } from "@/lib/network/consent-persist";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Durcissement (reliquat S-15) : trace RGPD du consentement réseau via le client de session (RLS).
// On vérifie la clé d'upsert, l'horodatage de l'opt-in, et la robustesse (jamais throw).

const now = new Date("2026-06-08T12:00:00.000Z");

function clientWith(upsert: ReturnType<typeof vi.fn>): SupabaseClient<Database> {
  // Stub minimal : seul `.from(...).upsert(...)` est exercé.
  return { from: vi.fn().mockReturnValue({ upsert }) } as unknown as SupabaseClient<Database>;
}

describe("persistConsent (reliquat S-15)", () => {
  it("upsert l'opt-in horodaté avec la clé logique (circle_id,user_id,scope) → true", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const ok = await persistConsent(clientWith(upsert), {
      circleId: "c1",
      userId: "u1",
      consented: true,
      now,
    });
    expect(ok).toBe(true);
    expect(upsert).toHaveBeenCalledWith(
      {
        circle_id: "c1",
        user_id: "u1",
        scope: "cost_network",
        consented: true,
        consented_at: now.toISOString(),
        revoked_at: null,
      },
      { onConflict: "circle_id,user_id,scope" },
    );
  });

  it("renvoie false si l'upsert est refusé (RLS) sans lever", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: "rls" } });
    expect(await persistConsent(clientWith(upsert), { circleId: "c1", userId: "u1", consented: true })).toBe(false);
  });

  it("renvoie false si l'appel lève (réseau) sans propager l'exception", async () => {
    const upsert = vi.fn().mockRejectedValue(new Error("boom"));
    expect(await persistConsent(clientWith(upsert), { circleId: "c1", userId: "u1", consented: false })).toBe(false);
  });
});
