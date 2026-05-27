import { describe, it, expect } from "vitest";
import { buildBackupPlan, deriveBackupPlan, legalRetentionYears } from "@/lib/engine";
import type { Backup, BackupCriticality, Profile, Sizing } from "@/lib/engine";
import { MEDIA_PRICE_SEED } from "@/lib/pricing/media-seed";
import { BACKUP_PRICE_SEED } from "@/lib/pricing/backup-seed";

// S-026, moteur backup pur : dérivation criticité→plan, surcharge conformité, monotonie coût,
// arbitrage vecteurs. Prix INJECTÉS (DÉFCON 1 : aucune valeur réelle en dur dans les tests).

const HOT = MEDIA_PRICE_SEED.storagePerGbMonth; // stockage chaud (€/Go·mois)
const BK = BACKUP_PRICE_SEED;
const SIZING: Sizing = { gpu: { tier: "none", monthlyCost: 0 }, storageGb: 100, embeddingsMultimodal: false, workloads: [] };

function profile(backup: Backup | undefined, over: Partial<Profile> = {}): Profile {
  return {
    activity: "pme-startup", zone: "ue", users: 5, contentTypes: ["text"], volume: "10to100",
    growth: "medium", regulations: ["rgpd"], sensitivity: "internal", audit: false, bitemporal: false,
    techLevel: "hybrid", budget: "200to500", reqPerDay: "lt1k", latency: "fast", voices: "solo",
    modules: { bisect: 0, reversal: 0, prereg: 0, mel: 0, conflict: 0 }, backup, ...over,
  };
}
function plan(backup: Backup | undefined, over: Partial<Profile> = {}): ReturnType<typeof buildBackupPlan> {
  return buildBackupPlan(profile(backup, over), SIZING, HOT, BK);
}
const force = (c: BackupCriticality): Backup => ({ criticality: c, vectorStrategy: "backup" });

describe("deriveBackupPlan, dérivation criticité → plan", () => {
  it("none → plan neutre (0 copie, coûts 0)", () => {
    const p = plan({ criticality: "none" });
    expect(p.copies).toBe(0);
    expect(p.monthlyCost).toBe(0);
    expect(p.setupCost).toBe(0);
    expect(p.threeTwoOne.tested).toBe(false);
  });

  it("backup absent ⇒ traité comme none", () => {
    expect(plan(undefined).monthlyCost).toBe(0);
  });

  it("standard : RPO 24 h, 2 copies, offsite, tier hot, sans PITR, érasure expiration", () => {
    const p = plan({ criticality: "standard" });
    expect(p.rpoMinutes).toBe(1440);
    expect(p.copies).toBe(2);
    expect(p.offsite).toBe(true);
    expect(p.tier).toBe("hot");
    expect(p.pitr).toBe(false);
    expect(p.erasurePolicy).toBe("expiration");
  });

  it("high : RPO 1 h, 3 copies, air-gap, tier cold, PITR", () => {
    const p = plan({ criticality: "high" });
    expect(p.rpoMinutes).toBe(60);
    expect(p.copies).toBe(3);
    expect(p.airgap).toBe(true);
    expect(p.tier).toBe("cold");
    expect(p.pitr).toBe(true);
  });

  it("critical : immutable + crypto-shred + rétention 365 j", () => {
    const p = plan({ criticality: "critical" });
    expect(p.immutable).toBe(true);
    expect(p.erasurePolicy).toBe("crypto-shred");
    expect(p.retentionDays).toBe(365);
  });

  it("affinage expert : override les défauts du palier", () => {
    const p = plan({ criticality: "standard", retentionDays: 7, copies: 4 });
    expect(p.retentionDays).toBe(7);
    expect(p.copies).toBe(4);
  });

  it("deriveBackupPlan est pur (pas de coûts dans le noyau)", () => {
    const core = deriveBackupPlan(profile({ criticality: "high" }));
    expect(core.criticality).toBe("high");
    expect(core.threeTwoOne.copies).toBe(3);
  });
});

describe("conformité (§6, sourcée)", () => {
  it("régime régulé (secret-pro) ⇒ crypto-shred + immutable + BYOK + rétention légale 5", () => {
    const p = plan({ criticality: "standard" }, { regulations: ["rgpd", "secret-pro"] });
    expect(p.erasurePolicy).toBe("crypto-shred");
    expect(p.immutable).toBe(true);
    expect(p.byok).toBe(true);
    expect(p.legalRetentionYears).toBe(5);
  });

  it("sensitivity secret ⇒ surcharge crypto-shred + immutable", () => {
    const p = plan({ criticality: "standard" }, { sensitivity: "secret" });
    expect(p.erasurePolicy).toBe("crypto-shred");
    expect(p.immutable).toBe(true);
  });

  it("legalRetentionYears = max des régimes (valeurs sourcées)", () => {
    expect(legalRetentionYears(["hipaa"])).toBe(6);
    expect(legalRetentionYears(["aiact"])).toBe(10);
    expect(legalRetentionYears(["rgpd", "hipaa"])).toBe(6);
    expect(legalRetentionYears(["rgpd"])).toBe(0);
    expect(legalRetentionYears(["cndp", "none"])).toBe(0);
  });
});

describe("coût (§7), monotonie & sources", () => {
  it("monotonie criticité : none < standard < high < critical", () => {
    const none = plan(force("none")).monthlyCost;
    const std = plan(force("standard")).monthlyCost;
    const high = plan(force("high")).monthlyCost;
    const crit = plan(force("critical")).monthlyCost;
    expect(none).toBe(0);
    expect(std).toBeGreaterThan(none);
    expect(high).toBeGreaterThan(std);
    expect(crit).toBeGreaterThan(high);
  });

  it("monotonie copies : plus de copies ⇒ coût supérieur", () => {
    const c2 = plan({ criticality: "standard", copies: 2, vectorStrategy: "backup" }).monthlyCost;
    const c4 = plan({ criticality: "standard", copies: 4, vectorStrategy: "backup" }).monthlyCost;
    expect(c4).toBeGreaterThan(c2);
  });

  it("monotonie rétention : rétention plus longue ⇒ coût supérieur", () => {
    const r30 = plan({ criticality: "standard", retentionDays: 30, vectorStrategy: "backup" }).monthlyCost;
    const r365 = plan({ criticality: "standard", retentionDays: 365, vectorStrategy: "backup" }).monthlyCost;
    expect(r365).toBeGreaterThan(r30);
  });

  it("offsite > onsite (à paramètres égaux)", () => {
    const on = plan({ criticality: "standard", offsite: false, airgap: false, vectorStrategy: "backup" }).monthlyCost;
    const off = plan({ criticality: "standard", offsite: true, airgap: false, vectorStrategy: "backup" }).monthlyCost;
    expect(off).toBeGreaterThan(on);
  });

  it("chaque coût (criticité > none) porte une CostSource datée", () => {
    const p = plan(force("high"));
    expect(p.costSources.length).toBeGreaterThan(0);
    for (const s of p.costSources) {
      expect(s.url).toMatch(/^https:\/\//);
      expect(s.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("arbitrage vecteurs (§5)", () => {
  it("sovereign + auto (non critical) ⇒ ré-embed (vecteurs reconstructibles, coût 0)", () => {
    const p = plan({ criticality: "high" });
    expect(p.vector.strategy).toBe("reembed");
    expect(p.vector.reembedCost).toBe(0);
  });

  it("critical + auto ⇒ backup (RTO trop court pour ré-embed)", () => {
    expect(plan({ criticality: "critical" }).vector.strategy).toBe("backup");
  });

  it("vectorStrategy forcé ⇒ respecté", () => {
    expect(plan({ criticality: "high", vectorStrategy: "backup" }).vector.strategy).toBe("backup");
    expect(plan({ criticality: "standard", vectorStrategy: "reembed" }).vector.strategy).toBe("reembed");
  });

  it("ré-embed n'est pas facturé EN PLUS du backup vecteurs (pas de double-comptage)", () => {
    const reembed = plan({ criticality: "high" });
    const backup = plan({ criticality: "high", vectorStrategy: "backup" });
    expect(reembed.backupStorageGb).toBeLessThan(backup.backupStorageGb);
  });
});
