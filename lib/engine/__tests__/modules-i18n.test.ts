import { describe, it, expect } from "vitest";
import frMessages from "@/messages/fr.json";
import enMessages from "@/messages/en.json";
import { MODULES, defaultModuleLevels, formatModuleTask, msg, recommend, type EngineResolver, type Profile } from "@/lib/engine";

// S-058 (reliquat moteur, chantier a) : la prose des modules est i18n (descripteurs Message résolus
// en fr/en). On vérifie sans monter next-intl : (1) chaque clé de message existe en fr ET en ;
// (2) parité anti-drift entre le `select` ICU de `scores.moduleBonus` et `modules.<id>.name` ;
// (3) `formatModuleTask` câble bien les parties dans le gabarit ; (4) les bonus ne fuient aucun id brut.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Lit une chaîne à un chemin pointé dans un catalogue de messages (vide si absente / non-chaîne). */
function lookup(root: unknown, path: string): string {
  let cur: unknown = root;
  for (const part of path.split(".")) {
    if (!isRecord(cur)) return "";
    cur = cur[part];
  }
  return typeof cur === "string" ? cur : "";
}

const CATALOGS = [
  { locale: "fr", messages: frMessages },
  { locale: "en", messages: enMessages },
] as const;

function profile(): Profile {
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
    modules: defaultModuleLevels(),
  };
}

describe("Modules i18n (S-058)", () => {
  it("chaque clé de nom/justification/tâche + niveaux existe en fr ET en", () => {
    for (const { messages } of CATALOGS) {
      for (const mod of MODULES) {
        expect(lookup(messages, `Engine.${mod.name.id}`).length).toBeGreaterThan(0);
        expect(lookup(messages, `Engine.${mod.why.id}`).length).toBeGreaterThan(0);
        expect(lookup(messages, `Engine.${mod.baseTask.id}`).length).toBeGreaterThan(0);
        expect(mod.levels).toHaveLength(mod.maxLevel + 1);
        for (const level of mod.levels) {
          expect(lookup(messages, `Engine.${level.label.id}`).length).toBeGreaterThan(0);
          expect(lookup(messages, `Engine.${level.desc.id}`).length).toBeGreaterThan(0);
        }
      }
      expect(lookup(messages, "Engine.modules.taskTemplate").length).toBeGreaterThan(0);
    }
  });

  // Anti-drift : le `select` ICU de moduleBonus embarque le nom inline (ICU ne peut référencer une
  // autre clé). On garantit que chaque branche reste identique à `modules.<id>.name`, fr ET en.
  it("le select scores.moduleBonus contient exactement modules.<id>.name (parité, fr ET en)", () => {
    for (const { messages } of CATALOGS) {
      const bonus = lookup(messages, "Engine.scores.moduleBonus");
      expect(bonus).toContain("{modId, select,");
      for (const mod of MODULES) {
        const name = lookup(messages, `Engine.modules.${mod.id}.name`);
        expect(name.length).toBeGreaterThan(0);
        // La branche du select est « <id> {<name>} » → le nom apparaît littéralement dans le gabarit.
        expect(bonus).toContain(`${mod.id} {${name}}`);
      }
    }
  });

  it("formatModuleTask compose le gabarit avec les parties résolues (niveau + label + tâche + desc)", () => {
    const resolve: EngineResolver = (m) => {
      if (m.id === "modules.taskTemplate" && m.values) {
        return `[${m.values.level}/${m.values.maxLevel} ${m.values.label}] ${m.values.baseTask} ::: ${m.values.desc}`;
      }
      return m.id; // un descripteur simple → renvoie son id (stub)
    };
    const task = formatModuleTask(
      { level: 2, maxLevel: 4, levelLabel: msg("LBL"), levelDesc: msg("DSC"), baseTask: msg("BASE") },
      resolve,
    );
    expect(task).toBe("[2/4 LBL] BASE ::: DSC");
  });

  it("les bonus de scores des modules actifs portent un modId connu (pas de prose, pas de fuite d'id)", () => {
    const reco = recommend(profile());
    const ids = new Set<string>(MODULES.map((m) => m.id));
    const bonuses = reco.scores.flatMap((s) => s.bonuses ?? []);
    expect(bonuses.length).toBeGreaterThan(0);
    for (const b of bonuses) {
      expect(b.id).toBe("scores.moduleBonus");
      const modId = b.values?.modId;
      expect(typeof modId).toBe("string");
      if (typeof modId === "string") expect(ids.has(modId)).toBe(true);
    }
  });
});
