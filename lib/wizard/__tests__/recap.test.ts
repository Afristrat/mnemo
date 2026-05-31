import { describe, it, expect } from "vitest";
import { recommend, type EngineResolver, type Profile } from "@/lib/engine";
import { buildChoiceRecap, type RecapItem, type RecapLabel } from "@/lib/wizard/recap";

// Stub de résolution des descripteurs Message du moteur (S-058) : on renvoie l'`id` (assez pour
// vérifier que le nom du module est bien injecté ; la localisation réelle est testée côté i18n).
const stubEngine: EngineResolver = (m) => m.id;
// Stub du chrome du récap (S-059) : renvoie la clé i18n, en réinjectant `name` pour la ligne module
// (pour vérifier que le nom du module est bien composé). La localisation réelle est testée côté messages.
const stubRecap: RecapLabel = (k, v) => (v !== undefined && "name" in v ? String(v.name) : k);

function prof(over: Partial<Profile> = {}): Profile {
  return {
    activity: "pme-startup",
    continent: "europe",
    country: "union-europeenne",
    zone: "ue",
    users: 5,
    contentTypes: ["text"],
    volume: "10to100",
    growth: "medium",
    regulations: ["rgpd"],
    sensitivity: "internal",
    audit: false,
    bitemporal: false,
    techLevel: "hybrid",
    budget: "200to500",
    reqPerDay: "lt1k",
    latency: "fast",
    voices: "solo",
    modules: { bisect: 0, reversal: 0, prereg: 0, mel: 0, conflict: 0 },
    ...over,
  };
}

function allItems(groups: ReturnType<typeof buildChoiceRecap>): RecapItem[] {
  return groups.flatMap((g) => g.items);
}
function item(groups: ReturnType<typeof buildChoiceRecap>, label: string): RecapItem | undefined {
  return allItems(groups).find((i) => i.label === label);
}

describe("buildChoiceRecap (S-050)", () => {
  it("couvre les champs clés + valeurs effectives dérivées (preset, serveurs, sauvegarde)", () => {
    const p = prof();
    const reco = recommend(p);
    const groups = buildChoiceRecap(p, reco, (k) => k, stubEngine, stubRecap);
    const labels = allItems(groups).map((i) => i.label);
    for (const expected of ["label.preset", "label.volume", "label.growth", "label.latency", "label.backup", "label.modules", "label.media"]) {
      expect(labels).toContain(expected);
    }
    expect(item(groups, "label.preset")?.value).toBe(reco.preset);
  });

  it("marque la transparence coût : charge = ●, souveraineté/conformité = ○", () => {
    const groups = buildChoiceRecap(prof(), recommend(prof()), (k) => k, stubEngine, stubRecap);
    // Influencent directement le coût mensuel
    for (const l of ["label.users", "label.volume", "label.growth", "label.latency"]) {
      expect(item(groups, l)?.impactsCost).toBe(true);
    }
    // Orientent la stack/scores/conformité mais pas une ligne de coût directe
    for (const l of ["label.geography", "label.audit", "label.bitemporal", "label.voices", "label.budget"]) {
      expect(item(groups, l)?.impactsCost).toBe(false);
    }
  });

  it("résume modules et médias inactifs sans rien inventer", () => {
    const groups = buildChoiceRecap(prof(), recommend(prof()), (k) => k, stubEngine, stubRecap);
    expect(item(groups, "label.modules")?.value).toBe("value.modulesNone");
    expect(item(groups, "label.media")?.value).toBe("value.mediaNone");
  });

  it("reporte les modules actifs et leur niveau", () => {
    const p = prof({ modules: { bisect: 0, reversal: 1, prereg: 0, mel: 0, conflict: 0 } });
    const reco = recommend(p);
    const value = item(buildChoiceRecap(p, reco, (k) => k, stubEngine, stubRecap), "label.modules")?.value ?? "";
    expect(value).not.toBe("value.modulesNone");
    const firstModule = reco.activeModules[0];
    expect(firstModule).toBeDefined();
    if (firstModule) expect(value).toContain(stubEngine(firstModule.name));
  });

  describe("précision « Autre » (S-064 / S-076)", () => {
    it("intègre la précision libre : activity = other, pays = autre-* (otherText.zone)", () => {
      const p = prof({
        activity: "other",
        continent: "europe",
        country: "autre-europe",
        otherText: { activity: "Coopérative agricole", zone: "Andorre" },
      });
      const groups = buildChoiceRecap(p, recommend(p), (k) => k, stubEngine, stubRecap);
      expect(item(groups, "label.activity")?.value).toContain("Coopérative agricole");
      // La ligne géographie montre « continent · pays : précision ».
      expect(item(groups, "label.geography")?.value).toContain("Andorre");
    });

    it("ne montre pas la précision quand la valeur n'est pas other (texte résiduel ignoré)", () => {
      const p = prof({ activity: "pme-startup", otherText: { activity: "texte résiduel" } });
      const groups = buildChoiceRecap(p, recommend(p), (k) => k, stubEngine, stubRecap);
      expect(item(groups, "label.activity")?.value ?? "").not.toContain("texte résiduel");
    });

    it("invariant : pays « autre-* » sans otherText → libellé géographie sans précision accolée", () => {
      const p = prof({ activity: "other", continent: "europe", country: "autre-europe" });
      const groups = buildChoiceRecap(p, recommend(p), (k) => k, stubEngine, stubRecap);
      expect(item(groups, "label.activity")?.value).toBe("activity.other");
      // Traducteur identité : « continent.europe · country.autre-europe », sans précision.
      expect(item(groups, "label.geography")?.value).toBe("continent.europe · country.autre-europe");
    });
  });
});
