import { describe, it, expect } from "vitest";
import { REGULATIONS } from "@/lib/engine";
import { JURISDICTIONS } from "@/lib/engine/geography";
import { regimesSeedFor, regimesSeedForCountries, type RegimeScope } from "@/lib/legal/regime-seed";

// S-077 tranche 1 : seed des régimes notoires par pays = repli DATÉ + SOURCÉ (DÉFCON 1). On vérifie que
// chaque entrée est sourcée (URL officielle + date), que le `code` reste dans l'énum moteur ou null, et
// que l'union multi-pays (cible + résidences clients) dédoublonne.

const VALID_SCOPES: RegimeScope[] = ["data-protection", "ai", "sector", "other"];
// Pays concrets du catalogue géographie (hors buckets génériques `autre-*`).
const CONCRETE_COUNTRIES = JURISDICTIONS.map((j) => j.code).filter((c) => !c.startsWith("autre-"));

describe("regimesSeedFor (S-077, seed sourcé)", () => {
  it("chaque entrée seed est sourcée (URL https + date) et bien formée (DÉFCON 1)", () => {
    let total = 0;
    for (const country of CONCRETE_COUNTRIES) {
      for (const regime of regimesSeedFor(country)) {
        total += 1;
        expect(regime.name.trim().length).toBeGreaterThan(0);
        expect(VALID_SCOPES).toContain(regime.scope);
        expect(regime.country).toBe(country);
        expect(regime.provenance).toBe("seed");
        expect(regime.source.url).toMatch(/^https:\/\//);
        expect(regime.source.label.trim().length).toBeGreaterThan(0);
        expect(regime.source.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        // `code` mappé ⇒ valeur valide de l'énum moteur ; sinon null (régime libre).
        if (regime.code !== null) expect(REGULATIONS).toContain(regime.code);
      }
    }
    expect(total).toBeGreaterThanOrEqual(15); // couverture multi-continent
  });

  it("mappe les régimes modélisés sur l'énum moteur, laisse les autres en libre (null)", () => {
    const ue = regimesSeedFor("union-europeenne");
    expect(ue.map((x) => x.code)).toEqual(expect.arrayContaining(["rgpd", "aiact"]));
    expect(regimesSeedFor("maroc").some((x) => x.code === "cndp")).toBe(true);
    expect(regimesSeedFor("etats-unis").some((x) => x.code === "hipaa")).toBe(true);
    // Régimes phares hors-UE modélisés (S-077, T5) → code mappé + sourcé.
    const br = regimesSeedFor("bresil");
    expect(br).toHaveLength(1);
    expect(br[0].code).toBe("lgpd");
    expect(br[0].name).toContain("LGPD");
    expect(regimesSeedFor("japon").some((x) => x.code === "appi")).toBe(true);
    // Régime non modélisé (POPIA, Afrique du Sud) → reste libre (null), affichage-seul.
    expect(regimesSeedFor("afrique-sud").every((x) => x.code === null)).toBe(true);
  });

  it("couvre les continents hors Europe (Afrique/LATAM/APAC/Moyen-Orient)", () => {
    for (const country of ["maroc", "nigeria", "kenya", "afrique-sud", "bresil", "japon", "coree-sud", "inde", "emirats", "arabie-saoudite"]) {
      expect(regimesSeedFor(country).length).toBeGreaterThan(0);
    }
  });

  it("pays inconnu ou bucket générique → [] (repli veille + défaut conservateur)", () => {
    expect(regimesSeedFor("autre-afrique")).toEqual([]);
    expect(regimesSeedFor("atlantide")).toEqual([]);
  });
});

describe("regimesSeedForCountries (union cible + résidences clients)", () => {
  it("cumule plusieurs pays et dédoublonne par (pays, nom)", () => {
    const merged = regimesSeedForCountries(["union-europeenne", "bresil", "union-europeenne"]);
    // UE (2) + Brésil (1), sans doublon malgré l'UE répétée.
    expect(merged).toHaveLength(3);
    const names = merged.map((x) => x.name);
    expect(names).toContain("RGPD");
    expect(names).toContain("AI Act");
    expect(names.some((n) => n.includes("LGPD"))).toBe(true);
  });

  it("liste vide si aucun pays connu", () => {
    expect(regimesSeedForCountries(["autre-europe", "atlantide"])).toEqual([]);
  });
});
