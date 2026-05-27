import { describe, it, expect } from "vitest";
import { BACKUP_PRICE_SEED, getBackupPrices } from "@/lib/pricing/backup-seed";

// S-025 — seed backup (DÉFCON 1) : repli + baseline de validation. Chaque poste réellement sourcé.

describe("seed backup — DÉFCON 1", () => {
  it("chaque poste a un montant > 0, € natif, une confiance et une source datée (URL + checkedAt)", () => {
    for (const e of Object.values(BACKUP_PRICE_SEED)) {
      expect(e.amount).toBeGreaterThan(0);
      expect(e.currency).toBe("EUR");
      expect(["high", "medium", "low"]).toContain(e.confidence);
      expect(e.source).not.toBeNull();
      expect(e.source?.url).toMatch(/^https:\/\//);
      expect(e.source?.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("le poste hors-site (estimation) est en confiance dégradée + note « à confirmer par devis »", () => {
    expect(BACKUP_PRICE_SEED.offsiteBandwidthPerGb.confidence).toBe("medium");
    expect(BACKUP_PRICE_SEED.offsiteBandwidthPerGb.note).toMatch(/devis/);
  });

  it("getBackupPrices renvoie le seed", () => {
    expect(getBackupPrices()).toBe(BACKUP_PRICE_SEED);
  });
});
