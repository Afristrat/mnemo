import { describe, it, expect } from "vitest";
import { vectorsForContinent, vectorsForClass, NEUTRAL_RESIDENCY_PRICES, type Continent } from "@/lib/engine";
import { RESIDENCY_PRICE_SEED } from "@/lib/pricing/residency-seed";

describe("egress par continent (S-073, tranche 2)", () => {
  it("les vecteurs egress sourcés portent un continent + un pays", () => {
    for (const v of RESIDENCY_PRICE_SEED.egressVectors) {
      expect(v.continent).toBeDefined();
      expect((v.country ?? "").length).toBeGreaterThan(0);
    }
  });

  it("vectorsForContinent filtre les vecteurs chiffrés rattachés au continent", () => {
    const europe = vectorsForContinent(RESIDENCY_PRICE_SEED, "europe");
    expect(europe.length).toBeGreaterThan(0);
    expect(europe.every((v) => v.continent === "europe")).toBe(true);
    expect(europe.map((v) => v.provider)).toContain("OVHcloud");

    const na = vectorsForContinent(RESIDENCY_PRICE_SEED, "north-america");
    expect(na.every((v) => v.continent === "north-america")).toBe(true);
    expect(na.some((v) => v.sovereign === false)).toBe(true); // hyperscalers (repère)
  });

  it("continent non couvert par les vecteurs chiffrés → [] (pas d'erreur ; prix = devis/veille)", () => {
    const absent: Continent[] = ["africa", "middle-east", "apac", "latam"];
    for (const c of absent) expect(vectorsForContinent(RESIDENCY_PRICE_SEED, c)).toEqual([]);
  });

  it("additif : la table neutre (vecteurs non annotés) reste valide — continent optionnel", () => {
    expect(vectorsForContinent(NEUTRAL_RESIDENCY_PRICES, "europe")).toEqual([]);
    // l'ancien sélecteur par classe n'est pas affecté
    expect(vectorsForClass(NEUTRAL_RESIDENCY_PRICES, "sovereign-eu").length).toBeGreaterThan(0);
  });
});
