import { describe, it, expect } from "vitest";
import { recommend, type Profile } from "@/lib/engine";
import { buildChoiceRecap, type RecapItem } from "@/lib/wizard/recap";

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
    const groups = buildChoiceRecap(p, reco, (k) => k);
    const labels = allItems(groups).map((i) => i.label);
    for (const expected of ["Preset retenu", "Volume de données", "Croissance", "Latence visée", "Sauvegarde", "Modules", "Médias"]) {
      expect(labels).toContain(expected);
    }
    expect(item(groups, "Preset retenu")?.value).toBe(reco.preset);
  });

  it("marque la transparence coût : charge = ●, souveraineté/conformité = ○", () => {
    const groups = buildChoiceRecap(prof(), recommend(prof()), (k) => k);
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
    const groups = buildChoiceRecap(prof(), recommend(prof()), (k) => k);
    expect(item(groups, "Modules")?.value).toBe("Aucun module activé");
    expect(item(groups, "Médias")?.value).toBe("Aucun besoin média actif");
  });

  it("reporte les modules actifs et leur niveau", () => {
    const p = prof({ modules: { bisect: 0, reversal: 1, prereg: 0, mel: 0, conflict: 0 } });
    const reco = recommend(p);
    const value = item(buildChoiceRecap(p, reco, (k) => k), "Modules")?.value ?? "";
    expect(value).not.toBe("Aucun module activé");
    expect(value).toContain(reco.activeModules[0]?.name ?? "—");
  });
});
