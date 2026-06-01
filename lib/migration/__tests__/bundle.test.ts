import { describe, it, expect } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { recommend, type Profile } from "@/lib/engine";
import { buildMigrationBundle, zipMigrationBundle } from "@/lib/migration/bundle";

// S-085 (Lot 3 F14) : bundle de migration In-Switch (double-run + critères de bascule + rollback).
// Cohérence bundle ↔ reco ; rejouabilité du ZIP.

function prof(over: Partial<Profile> = {}): Profile {
  return {
    activity: "pme-startup",
    continent: "europe",
    country: "union-europeenne",
    zone: "ue",
    users: 10,
    contentTypes: ["text"],
    volume: "10to100",
    growth: "medium",
    regulations: ["rgpd"],
    sensitivity: "confidential",
    audit: false,
    bitemporal: false,
    techLevel: "devops",
    budget: "500to2k",
    reqPerDay: "lt1k",
    latency: "acceptable",
    voices: "multi",
    modules: { bisect: 0, reversal: 0, prereg: 0, mel: 0, conflict: 0 },
    ...over,
  };
}

describe("buildMigrationBundle (S-085)", () => {
  it("contient le runbook, les scripts cutover/rollback et le manifest", () => {
    const p = prof();
    const b = buildMigrationBundle(p, recommend(p), { generatedAt: "2026-06-01" });
    expect(Object.keys(b.files).sort()).toEqual(["MIGRATION.md", "manifest.json", "scripts/cutover.sh", "scripts/rollback.sh"]);
  });

  it("le runbook couvre double-run, critères de bascule et rollback garanti", () => {
    const p = prof();
    const runbook = buildMigrationBundle(p, recommend(p), { generatedAt: "2026-06-01" }).files["MIGRATION.md"];
    expect(runbook).toContain("Double-run");
    expect(runbook).toContain("Critères de bascule");
    expect(runbook).toContain("Rollback garanti");
  });

  it("le manifest reflète la reco (preset, rollback garanti, cibles)", () => {
    const p = prof();
    const reco = recommend(p);
    const manifest = JSON.parse(buildMigrationBundle(p, reco, { generatedAt: "2026-06-01" }).files["manifest.json"]);
    expect(manifest.preset).toBe(reco.preset);
    expect(manifest.rollbackGuaranteed).toBe(true);
    expect(Array.isArray(manifest.targets)).toBe(true);
    expect(manifest.targets.length).toBeGreaterThan(0);
  });

  it("les composants cibles de la reco apparaissent dans le runbook (cohérence)", () => {
    const p = prof();
    const reco = recommend(p);
    const runbook = buildMigrationBundle(p, reco, { generatedAt: "2026-06-01" }).files["MIGRATION.md"];
    const firstChoice = reco.layers.find((l) => l.choice.trim() !== "")?.choice ?? "";
    expect(firstChoice.length).toBeGreaterThan(0);
    expect(runbook).toContain(firstChoice);
  });

  it("le ZIP se dézippe en restituant les fichiers à l'identique", () => {
    const p = prof();
    const bundle = buildMigrationBundle(p, recommend(p), { generatedAt: "2026-06-01" });
    const unzipped = unzipSync(zipMigrationBundle(bundle));
    expect(strFromU8(unzipped["MIGRATION.md"])).toBe(bundle.files["MIGRATION.md"]);
    expect(strFromU8(unzipped["scripts/rollback.sh"])).toBe(bundle.files["scripts/rollback.sh"]);
  });
});
