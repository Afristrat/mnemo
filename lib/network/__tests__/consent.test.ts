import { describe, it, expect } from "vitest";
import { buildConsentUpsert } from "@/lib/network/consent";

const now = new Date("2026-05-25T12:00:00.000Z");

describe("buildConsentUpsert", () => {
  it("horodate l'opt-in (consented_at) et n'a pas de révocation", () => {
    const row = buildConsentUpsert({ circleId: "c1", userId: "u1", consented: true, now });
    expect(row.scope).toBe("cost_network");
    expect(row.consented).toBe(true);
    expect(row.consented_at).toBe(now.toISOString());
    expect(row.revoked_at).toBeNull();
  });

  it("horodate la révocation (revoked_at) et annule le consentement", () => {
    const row = buildConsentUpsert({ circleId: "c1", userId: "u1", consented: false, now });
    expect(row.consented).toBe(false);
    expect(row.consented_at).toBeNull();
    expect(row.revoked_at).toBe(now.toISOString());
  });
});
