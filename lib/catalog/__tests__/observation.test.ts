import { describe, it, expect } from "vitest";
import type { Profile } from "@/lib/engine";
import { seedCatalog } from "@/lib/catalog/catalog-seed";
import { buildCatalogObservations } from "@/lib/catalog/observation";
import type { Catalog, ComponentCandidate, SlotId } from "@/lib/catalog/types";

const SLOT_IDS: readonly SlotId[] = ["c0", "c1", "c2", "c3", "c4", "c5", "c6"];

function prof(overrides: Partial<Profile> = {}): Profile {
  return {
    activity: "pme-startup",
    zone: "ue",
    users: 5,
    contentTypes: ["text", "images"],
    volume: "10to100",
    growth: "medium",
    regulations: ["rgpd"],
    sensitivity: "internal",
    audit: false,
    bitemporal: true,
    techLevel: "hybrid",
    budget: "200to500",
    reqPerDay: "lt1k",
    latency: "fast",
    voices: "solo",
    modules: { bisect: 0, reversal: 0, prereg: 0, mel: 0, conflict: 0 },
    ...overrides,
  };
}

/** Tous les candidats d'un catalogue (recommandés + alternatives, tous slots). */
function allCandidates(catalog: Catalog): ComponentCandidate[] {
  return SLOT_IDS.flatMap((id) => [catalog.slots[id].recommended, ...catalog.slots[id].alternatives]);
}

describe("buildCatalogObservations (audit trail pur, S-036)", () => {
  it("produit une ligne par couche (7), avec source non vide (DÉFCON 1)", () => {
    const catalog = seedCatalog("MEDIUM", prof());
    const rows = buildCatalogObservations({ catalog });
    expect(rows).toHaveLength(7);
    for (const r of rows) {
      expect(r.source_url.length).toBeGreaterThan(0);
      expect(r.assembled_at).toBe(catalog.assembledAt);
      expect(SLOT_IDS).toContain(r.slot);
    }
  });

  it("veille anonyme → circle_id et created_by nuls (collecte minimale)", () => {
    const rows = buildCatalogObservations({ catalog: seedCatalog("MEDIUM", prof()) });
    for (const r of rows) {
      expect(r.circle_id).toBeNull();
      expect(r.created_by).toBeNull();
    }
  });

  it("rattache au cercle + auteur quand fournis", () => {
    const rows = buildCatalogObservations({
      catalog: seedCatalog("MEDIUM", prof()),
      circleId: "circle-1",
      createdBy: "user-1",
    });
    expect(rows.every((r) => r.circle_id === "circle-1" && r.created_by === "user-1")).toBe(true);
  });

  it("reporte fidèlement composant / provenance / confiance du candidat retenu", () => {
    const catalog = seedCatalog("MEDIUM", prof());
    const rows = buildCatalogObservations({ catalog });
    const c4 = rows.find((r) => r.slot === "c4");
    expect(c4?.component).toBe(catalog.slots.c4.recommended.name);
    expect(c4?.provenance).toBe("seed");
    expect(c4?.confidence).toBe(catalog.slots.c4.recommended.confidence);
  });
});

describe("invariant zéro pondération vendor (S-036, acceptance §5)", () => {
  it("aucun candidat ne porte de clé de commission / affiliation / partenariat", () => {
    const catalog = seedCatalog("HARD", prof({ sensitivity: "secret" }));
    const forbidden = /commission|affiliation|kickback|sponsor|partner|referral|payout/i;
    for (const c of allCandidates(catalog)) {
      for (const key of Object.keys(c)) expect(key).not.toMatch(forbidden);
    }
  });
});
