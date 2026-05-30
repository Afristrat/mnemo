import { createTranslator } from "next-intl";
import { describe, it, expect } from "vitest";
import frMessages from "@/messages/fr.json";
import enMessages from "@/messages/en.json";
import { MODULES, defaultModuleLevels, formatModuleTask, recommend, type EngineResolver, type Profile } from "@/lib/engine";

// S-058 (reliquat moteur, chantier a) : la prose des modules est désormais i18n (descripteurs Message
// résolus en fr/en). On vérifie : (1) parité anti-drift entre le `select` ICU de `scores.moduleBonus`
// et `modules.<id>.name` ; (2) rendu ICU réel de `formatModuleTask` ; (3) bonus modules localisé.

const LOCALES = [
  { locale: "fr", messages: frMessages },
  { locale: "en", messages: enMessages },
] as const;

/** Résolveur de descripteurs moteur via next-intl (équivalent test de `useEngineText`). */
function engineResolver(locale: string, messages: Record<string, unknown>): EngineResolver {
  const t = createTranslator({ locale, messages, namespace: "Engine" });
  return (m) => t(m.id, m.values);
}

function profile(): Profile {
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
    modules: defaultModuleLevels(),
  };
}

describe("Modules i18n (S-058)", () => {
  it("chaque module a une clé de nom/justification/tâche + niveaux résolvables en fr ET en", () => {
    for (const { locale, messages } of LOCALES) {
      const resolve = engineResolver(locale, messages);
      for (const mod of MODULES) {
        expect(resolve(mod.name).length).toBeGreaterThan(0);
        expect(resolve(mod.why).length).toBeGreaterThan(0);
        expect(resolve(mod.baseTask).length).toBeGreaterThan(0);
        expect(mod.levels).toHaveLength(mod.maxLevel + 1);
        for (const level of mod.levels) {
          expect(resolve(level.label).length).toBeGreaterThan(0);
          expect(resolve(level.desc).length).toBeGreaterThan(0);
        }
      }
    }
  });

  // Anti-drift : le `select` ICU de moduleBonus embarque le nom inline (ICU ne peut référencer une
  // autre clé). On garantit qu'il reste identique à `modules.<id>.name` dans les DEUX langues.
  it("le nom dans le select scores.moduleBonus correspond à modules.<id>.name (parité, fr ET en)", () => {
    for (const { locale, messages } of LOCALES) {
      const t = createTranslator({ locale, messages, namespace: "Engine" });
      for (const mod of MODULES) {
        const rendered = t("scores.moduleBonus", { modId: mod.id, level: 2, maxLevel: 3, bonus: "0.5" });
        const name = t(`modules.${mod.id}.name`);
        expect(rendered).toContain(name);
      }
    }
  });

  it("formatModuleTask compose le plan d'action via le gabarit (parties résolues, fr ET en)", () => {
    for (const { locale, messages } of LOCALES) {
      const resolve = engineResolver(locale, messages);
      const mod = MODULES.find((m) => m.id === "mel");
      expect(mod).toBeDefined();
      if (!mod) return;
      const task = formatModuleTask(
        { level: 2, maxLevel: mod.maxLevel, levelLabel: mod.levels[2].label, levelDesc: mod.levels[2].desc, baseTask: mod.baseTask },
        resolve,
      );
      // Le gabarit contient le niveau, le libellé du niveau, la tâche de base et la description.
      expect(task).toContain("2/4");
      expect(task).toContain(resolve(mod.levels[2].label));
      expect(task).toContain(resolve(mod.baseTask));
      expect(task).toContain(resolve(mod.levels[2].desc));
    }
  });

  it("les bonus de scores des modules actifs se rendent avec le nom localisé (pas d'id brut)", () => {
    const reco = recommend(profile());
    const resolve = engineResolver("en", enMessages);
    const bonuses = reco.scores.flatMap((s) => s.bonuses ?? []);
    expect(bonuses.length).toBeGreaterThan(0);
    for (const b of bonuses) {
      const rendered = resolve(b);
      // Aucun identifiant technique de module ne fuit dans la chaîne rendue.
      expect(rendered).not.toContain("modId");
      expect(rendered).not.toMatch(/\bbisect\b|\breversal\b|\bprereg\b/);
    }
  });
});
