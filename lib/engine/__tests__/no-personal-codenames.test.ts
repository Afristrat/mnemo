import { describe, it, expect } from "vitest";
import type { Preset, Profile } from "@/lib/engine/types";
import { seedCatalog } from "@/lib/catalog";
import frMessages from "@/messages/fr.json";

/** Aplati récursivement toutes les feuilles chaîne d'un objet de messages i18n. */
function stringLeaves(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const v of Object.values(value)) stringLeaves(v, out);
  }
}

// S-063, garde DÉFCON 1 : aucun codename perso/interne (« Xavier », « Chris », « Meydeey », « Amine »)
// ne doit fuiter dans une chaîne user-facing (catalogue recommandé, labels de score, diagnostics KM).
// Un composant proposé doit être RECONNAISSABLE + sourcé, pas un nom privé gravé.

const PERSONAL_CODENAMES = /\bXavier\b|\bChris\b|\bMeydeey\b|\bAmine\b/i;

function prof(overrides: Partial<Profile> = {}): Profile {
  return {
    activity: "freelance",
    continent: "europe",
    country: "union-europeenne",
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

// Variantes pour exercer toutes les branches conditionnelles (preset × multimodal × bitemporel × régulé).
const PROFILES: Profile[] = [
  prof(),
  prof({ contentTypes: ["text", "audio"], bitemporal: true }),
  prof({ contentTypes: ["text", "video"], sensitivity: "secret", bitemporal: true, voices: "multi" }),
];
const PRESETS: Preset[] = ["LIGHT", "MEDIUM", "HARD"];

function catalogStrings(preset: Preset, p: Profile): string[] {
  const out: string[] = [];
  for (const slot of Object.values(seedCatalog(preset, p).slots)) {
    const push = (c: { name: string; role: string; note?: string }): void => {
      out.push(c.name, c.role);
      if (c.note !== undefined) out.push(c.note);
    };
    push(slot.recommended);
    slot.alternatives.forEach(push);
  }
  return out;
}

// i18n (S-058) : le texte des scores, des actions de conformité, des risques et des KM checks ne vit
// plus dans le moteur (descripteurs Message) mais dans le catalogue — scanné séparément ci-dessous
// (2ᵉ cas). Ici : restent les chaînes brutes hors-i18n = noms/notes des composants du catalogue seed.
function userFacingStrings(preset: Preset, p: Profile): string[] {
  return catalogStrings(preset, p);
}

describe("garde anti-codename perso (S-063)", () => {
  it("aucune chaîne user-facing (catalogue, scores, diagnostics) ne contient de codename perso", () => {
    for (const preset of PRESETS) {
      for (const p of PROFILES) {
        for (const s of userFacingStrings(preset, p)) {
          expect(s, `codename perso détecté dans : « ${s} »`).not.toMatch(PERSONAL_CODENAMES);
        }
      }
    }
  });

  it("aucun message i18n du moteur (catalogue fr) ne contient de codename perso (S-058)", () => {
    const leaves: string[] = [];
    stringLeaves(frMessages.Engine, leaves);
    expect(leaves.length).toBeGreaterThan(0);
    for (const s of leaves) {
      expect(s, `codename perso détecté dans : « ${s} »`).not.toMatch(PERSONAL_CODENAMES);
    }
  });

  it("le composant C0 (contrat de métadonnées) est générique et reconnaissable", () => {
    const c0 = seedCatalog("MEDIUM", prof()).slots.c0.recommended;
    expect(c0.name).not.toMatch(PERSONAL_CODENAMES);
    expect(c0.name).toMatch(/frontmatter|métadonnées/i);
  });
});
