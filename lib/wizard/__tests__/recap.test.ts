import { describe, it, expect } from "vitest";
import { recommend, type EngineResolver, type Profile } from "@/lib/engine";
import { buildChoiceRecap, type RecapItem } from "@/lib/wizard/recap";

// Stub de résolution des descripteurs Message du moteur (S-058) : on renvoie l'`id` (assez pour
// vérifier que le nom du module est bien injecté ; la localisation réelle est testée côté i18n).
const stubEngine: EngineResolver = (m) => m.id;

function prof(over: Partial<Profile> = {}): Profile {
  return {
    activity: "pme-startup",
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
    const groups = buildChoiceRecap(p, reco, (k) => k, stubEngine);
    const labels = allItems(groups).map((i) => i.label);
    for (const expected of ["Preset retenu", "Volume de données", "Croissance", "Latence visée", "Sauvegarde", "Modules", "Médias"]) {
      expect(labels).toContain(expected);
    }
    expect(item(groups, "Preset retenu")?.value).toBe(reco.preset);
  });

  it("marque la transparence coût : charge = ●, souveraineté/conformité = ○", () => {
    const groups = buildChoiceRecap(prof(), recommend(prof()), (k) => k, stubEngine);
    // Influencent directement le coût mensuel
    for (const l of ["Utilisateurs", "Volume de données", "Croissance", "Latence visée"]) {
      expect(item(groups, l)?.impactsCost).toBe(true);
    }
    // Orientent la stack/scores/conformité mais pas une ligne de coût directe
    for (const l of ["Zone d'hébergement", "Audit", "Bitemporel", "Voix / perspectives", "Budget (plafond)"]) {
      expect(item(groups, l)?.impactsCost).toBe(false);
    }
  });

  it("résume modules et médias inactifs sans rien inventer", () => {
    const groups = buildChoiceRecap(prof(), recommend(prof()), (k) => k, stubEngine);
    expect(item(groups, "Modules")?.value).toBe("Aucun module activé");
    expect(item(groups, "Médias")?.value).toBe("Aucun besoin média actif");
  });

  it("reporte les modules actifs et leur niveau", () => {
    const p = prof({ modules: { bisect: 0, reversal: 1, prereg: 0, mel: 0, conflict: 0 } });
    const reco = recommend(p);
    const value = item(buildChoiceRecap(p, reco, (k) => k, stubEngine), "Modules")?.value ?? "";
    expect(value).not.toBe("Aucun module activé");
    const firstModule = reco.activeModules[0];
    expect(firstModule).toBeDefined();
    if (firstModule) expect(value).toContain(stubEngine(firstModule.name));
  });

  describe("précision « Autre » (S-064)", () => {
    it("intègre la précision libre dans le libellé quand activity/zone = other", () => {
      const p = prof({
        activity: "other",
        zone: "other",
        otherText: { activity: "Coopérative agricole", zone: "Suisse" },
      });
      const groups = buildChoiceRecap(p, recommend(p), (k) => k, stubEngine);
      expect(item(groups, "Activité")?.value).toContain("Coopérative agricole");
      expect(item(groups, "Zone d'hébergement")?.value).toContain("Suisse");
    });

    it("ne montre pas la précision quand la valeur n'est pas other (texte résiduel ignoré)", () => {
      const p = prof({ activity: "pme-startup", otherText: { activity: "texte résiduel" } });
      const groups = buildChoiceRecap(p, recommend(p), (k) => k, stubEngine);
      expect(item(groups, "Activité")?.value ?? "").not.toContain("texte résiduel");
    });

    it("invariant : sans otherText, le libellé reste celui de l'énum (other → « Autre » muet)", () => {
      const withOther = prof({ activity: "other", zone: "other" });
      const groups = buildChoiceRecap(withOther, recommend(withOther), (k) => k, stubEngine);
      // Avec le traducteur identité (k) => k, « other » résout sur sa clé, sans précision accolée.
      expect(item(groups, "Activité")?.value).toBe("activity.other");
      expect(item(groups, "Zone d'hébergement")?.value).toBe("zone.other");
    });
  });
});
