import { describe, it, expect } from "vitest";
import {
  CONTINENTS,
  JURISDICTIONS,
  continentForCountry,
  defaultCountryFor,
  deriveZone,
  geographyFromZone,
  jurisdictionsFor,
} from "@/lib/engine";

describe("géographie continent → pays (S-076)", () => {
  it("chaque continent a au moins une juridiction (default non vide)", () => {
    for (const c of CONTINENTS) {
      const list = jurisdictionsFor(c);
      expect(list.length).toBeGreaterThan(0);
      expect(defaultCountryFor(c)).toBe(list[0].code);
      expect(list.every((j) => j.continent === c)).toBe(true);
    }
  });

  it("deriveZone : UE/Maroc/US précis, tout le reste conservateur 'other'", () => {
    expect(deriveZone("union-europeenne")).toBe("ue");
    expect(deriveZone("maroc")).toBe("maroc");
    expect(deriveZone("etats-unis")).toBe("us");
    // tout autre pays (y compris souverains hors UE/Maroc/US) → bucket conservateur
    expect(deriveZone("kenya")).toBe("other");
    expect(deriveZone("japon")).toBe("other");
    expect(deriveZone("bresil")).toBe("other");
    expect(deriveZone("canada")).toBe("other");
    expect(deriveZone("inconnu-xyz")).toBe("other"); // total
  });

  it("un seul pays par bucket précis (pas de fabrication de statut légal ailleurs)", () => {
    expect(JURISDICTIONS.filter((j) => j.zone === "ue").map((j) => j.code)).toEqual(["union-europeenne"]);
    expect(JURISDICTIONS.filter((j) => j.zone === "maroc").map((j) => j.code)).toEqual(["maroc"]);
    expect(JURISDICTIONS.filter((j) => j.zone === "us").map((j) => j.code)).toEqual(["etats-unis"]);
  });

  it("continentForCountry retrouve le continent (défaut europe si inconnu)", () => {
    expect(continentForCountry("maroc")).toBe("africa");
    expect(continentForCountry("japon")).toBe("apac");
    expect(continentForCountry("inconnu")).toBe("europe");
  });

  it("geographyFromZone (profil legacy) : zone → géographie cohérente, deriveZone réciproque", () => {
    for (const zone of ["ue", "maroc", "us", "other"] as const) {
      const g = geographyFromZone(zone);
      expect(CONTINENTS).toContain(g.continent);
      // la zone dérivée du pays choisi correspond (sauf 'other' qui mappe vers un pays 'other')
      expect(deriveZone(g.country)).toBe(zone === "other" ? "other" : zone);
    }
  });

  it("tous les codes pays sont uniques", () => {
    const codes = JURISDICTIONS.map((j) => j.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
