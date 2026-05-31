import { describe, it, expect } from "vitest";
import { CONTINENTS, coveredContinents, providersByContinent, type Continent } from "@/lib/engine";
import { SOVEREIGN_PROVIDERS_SEED } from "@/lib/pricing/sovereign-providers-seed";

describe("annuaire fournisseurs souverains (S-073, tranche 1)", () => {
  it("couvre TOUS les continents (vision « présence mondiale »)", () => {
    const covered = coveredContinents(SOVEREIGN_PROVIDERS_SEED);
    expect([...covered].sort()).toEqual([...CONTINENTS].sort());
  });

  it("permet la redondance multi-fournisseur : ≥ 1 continent avec ≥ 2 fournisseurs", () => {
    const counts = CONTINENTS.map((c) => providersByContinent(SOVEREIGN_PROVIDERS_SEED, c).length);
    expect(counts.some((n) => n >= 2)).toBe(true);
  });

  it("DÉFCON 1 : chaque fournisseur porte une source datée (URL https + checkedAt ISO) — jamais de prix gravé", () => {
    for (const p of SOVEREIGN_PROVIDERS_SEED) {
      expect(p.source.url).toMatch(/^https:\/\//);
      expect(p.source.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.source.label.length).toBeGreaterThan(0);
      expect(p.country.length).toBeGreaterThan(0);
      // Le contrat n'expose aucun champ de prix : la grille egress reste hors annuaire (devis/veille).
      expect(p).not.toHaveProperty("price");
    }
  });

  it("providersByContinent filtre correctement (et renvoie tout si omis)", () => {
    expect(providersByContinent(SOVEREIGN_PROVIDERS_SEED).length).toBe(SOVEREIGN_PROVIDERS_SEED.length);
    const africa = providersByContinent(SOVEREIGN_PROVIDERS_SEED, "africa");
    expect(africa.length).toBeGreaterThan(0);
    expect(africa.every((p) => p.continent === "africa")).toBe(true);
  });

  it("toute classe de souveraineté est dans l'union attendue", () => {
    const allowed = new Set(["sovereign", "eu-hosted", "hyperscaler"]);
    for (const p of SOVEREIGN_PROVIDERS_SEED) expect(allowed.has(p.sovereignty)).toBe(true);
  });

  it("aucun continent inconnu", () => {
    const known = new Set<Continent>(CONTINENTS);
    for (const p of SOVEREIGN_PROVIDERS_SEED) expect(known.has(p.continent)).toBe(true);
  });
});
