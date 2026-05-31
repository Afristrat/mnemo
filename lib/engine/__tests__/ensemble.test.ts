import { describe, it, expect } from "vitest";
import {
  buildEnsemble,
  ENSEMBLE_VARIANT_IDS,
  recommend,
  type EnsembleVariantId,
  type Profile,
} from "@/lib/engine";

function baseProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    activity: "freelance",
    zone: "ue",
    users: 1,
    contentTypes: ["text"],
    volume: "1to10",
    growth: "medium",
    regulations: ["rgpd"],
    sensitivity: "internal",
    audit: false,
    bitemporal: false,
    techLevel: "hybrid",
    budget: "50to200",
    reqPerDay: "lt100",
    latency: "fast",
    voices: "solo",
    modules: { bisect: 0, reversal: 0, prereg: 0, mel: 0, conflict: 0 },
    ...overrides,
  };
}

function variant(profile: Profile, id: EnsembleVariantId) {
  const found = buildEnsemble(profile).variants.find((v) => v.id === id);
  if (found === undefined) throw new Error(`membre ${id} introuvable`);
  return found;
}

describe("buildEnsemble, génération des membres", () => {
  it("produit exactement les 3 membres attendus (souveraineté / coût / délai)", () => {
    const { variants } = buildEnsemble(baseProfile());
    expect(variants.map((v) => v.id)).toEqual([...ENSEMBLE_VARIANT_IDS]);
    expect(variants).toHaveLength(3);
  });

  it("la baseline est la recommandation du profil tel quel", () => {
    const profile = baseProfile();
    expect(buildEnsemble(profile).baseline).toEqual(recommend(profile));
  });

  it("chaque membre expose des hypothèses explicites non vides", () => {
    for (const v of buildEnsemble(baseProfile()).variants) {
      expect(v.assumptions.length).toBeGreaterThan(0);
      // Descripteurs i18n (S-059) : on asserte l'id du Message, pas la prose.
      expect(v.intent.id).toBe(`ensemble.${v.id}.intent`);
      expect(v.assumptions.every((a) => a.id.startsWith(`ensemble.${v.id}.assumption.`))).toBe(true);
    }
  });

  it("le membre « souveraineté max » force le preset HARD", () => {
    expect(variant(baseProfile(), "sovereignty").recommendation.preset).toBe("HARD");
  });

  it("« souveraineté max » coûte plus cher que « coût minimal »", () => {
    const sov = variant(baseProfile(), "sovereignty").recommendation.totalCost;
    const cheap = variant(baseProfile(), "cost").recommendation.totalCost;
    expect(sov).toBeGreaterThan(cheap);
  });

  it("« coût minimal » désactive tous les modules", () => {
    const profile = baseProfile({ modules: { bisect: 3, reversal: 3, prereg: 3, mel: 4, conflict: 4 } });
    const cheap = variant(profile, "cost");
    expect(Object.values(cheap.profile.modules).every((lvl) => lvl === 0)).toBe(true);
    expect(cheap.recommendation.moduleCost).toBe(0);
  });

  it("ne mute pas le profil d'entrée", () => {
    const profile = baseProfile();
    const snapshot = JSON.stringify(profile);
    buildEnsemble(profile);
    expect(JSON.stringify(profile)).toBe(snapshot);
  });
});

describe("buildEnsemble, spread (= incertitude)", () => {
  it("l'écart de coût est cohérent (range = max − min, % rapporté au min)", () => {
    const { spread } = buildEnsemble(baseProfile());
    expect(spread.count).toBe(4);
    expect(spread.costMax).toBeGreaterThanOrEqual(spread.costMin);
    expect(spread.costRange).toBe(spread.costMax - spread.costMin);
    expect(spread.costRangePct).toBe(Math.round((spread.costRange / spread.costMin) * 100));
  });

  it("l'écart de score est cohérent et arrondi au dixième", () => {
    const { spread } = buildEnsemble(baseProfile());
    expect(spread.scoreMax).toBeGreaterThanOrEqual(spread.scoreMin);
    expect(spread.scoreRange).toBe(Math.round((spread.scoreMax - spread.scoreMin) * 10) / 10);
  });

  it("couvre plusieurs presets distincts quand les priorités divergent", () => {
    const { spread } = buildEnsemble(baseProfile());
    expect(spread.presetsSpan).toContain("HARD");
    expect(spread.presetsSpan.length).toBeGreaterThanOrEqual(2);
  });

  it("produit un descripteur d'incertitude portant les bornes chiffrées + l'accord (S-059)", () => {
    const { spread } = buildEnsemble(baseProfile());
    // Descripteur i18n : l'id + les valeurs (bornes chiffrées) sont asserties, la prose est en fr/en.
    expect(spread.uncertaintyLabel.id).toBe("ensemble.uncertainty");
    expect(spread.uncertaintyLabel.values?.costMin).toBe(spread.costMin);
    expect(spread.uncertaintyLabel.values?.costMax).toBe(spread.costMax);
    expect(spread.uncertaintyLabel.values?.agreement).toBe(spread.agreement);
    expect(["fort", "modéré", "faible"]).toContain(spread.agreement);
  });

  it("converge (accord fort) quand la sensibilité force le lourd partout", () => {
    // En « secret » + cabinet régulé, tous les membres tombent en HARD → faible dispersion.
    const { spread } = buildEnsemble(
      baseProfile({ activity: "cabinet-regule", sensitivity: "secret", audit: true, bitemporal: true }),
    );
    expect(spread.presetsSpan).toEqual(["HARD"]);
  });
});

describe("buildEnsemble, déterminisme", () => {
  it("renvoie un résultat stable pour un même profil", () => {
    const profile = baseProfile();
    expect(buildEnsemble(profile)).toEqual(buildEnsemble(profile));
  });
});
