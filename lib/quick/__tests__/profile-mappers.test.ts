import { describe, it, expect } from "vitest";
import { recommend } from "@/lib/engine";
import { DEFAULT_QUICK_ANSWERS, mapQuickAnswersToProfile, type QuickAnswers } from "@/lib/quick/profile-mappers";

function answers(overrides: Partial<QuickAnswers> = {}): QuickAnswers {
  return { ...DEFAULT_QUICK_ANSWERS, ...overrides };
}

describe("mapQuickAnswersToProfile", () => {
  it("produit un Profile valide consommable par recommend()", () => {
    const r = recommend(mapQuickAnswersToProfile(DEFAULT_QUICK_ANSWERS));
    expect(r.layers).toHaveLength(7);
    expect(r.scores).toHaveLength(10);
  });

  it("mappe « qui » vers l'activité + le nombre d'utilisateurs", () => {
    expect(mapQuickAnswersToProfile(answers({ who: "solo" })).activity).toBe("freelance");
    expect(mapQuickAnswersToProfile(answers({ who: "team" })).activity).toBe("pme-startup");
    expect(mapQuickAnswersToProfile(answers({ who: "regulated" })).activity).toBe("cabinet-regule");
    expect(mapQuickAnswersToProfile(answers({ who: "research" })).activity).toBe("recherche");
    expect(mapQuickAnswersToProfile(answers({ who: "team" })).users).toBeGreaterThan(1);
  });

  it("profession régulée → secret pro + audit & bitemporel exigés (prudence)", () => {
    const p = mapQuickAnswersToProfile(answers({ who: "regulated" }));
    expect(p.regulations).toContain("secret-pro");
    expect(p.audit).toBe(true);
    expect(p.bitemporal).toBe(true);
  });

  it("données secret → sensibilité secret + audit/bitemporel", () => {
    const p = mapQuickAnswersToProfile(answers({ data: "secret" }));
    expect(p.sensitivity).toBe("secret");
    expect(p.audit).toBe(true);
    expect(p.bitemporal).toBe(true);
  });

  it("données internes par défaut → pas d'exigence stricte d'audit", () => {
    const p = mapQuickAnswersToProfile(answers({ who: "solo", data: "internal" }));
    expect(p.audit).toBe(false);
    expect(p.bitemporal).toBe(false);
  });

  it("priorité coût serre le budget ; rapidité suppose des compétences DevOps", () => {
    expect(mapQuickAnswersToProfile(answers({ priority: "cost" })).budget).toBe("50to200");
    expect(mapQuickAnswersToProfile(answers({ priority: "speed" })).techLevel).toBe("devops");
    expect(mapQuickAnswersToProfile(answers({ priority: "sovereignty" })).zone).toBe("ue");
  });

  it("« media » ajoute audio/vidéo/images ; « text » reste au texte", () => {
    expect(mapQuickAnswersToProfile(answers({ media: "media" })).contentTypes).toEqual([
      "text",
      "audio",
      "video",
      "images",
    ]);
    expect(mapQuickAnswersToProfile(answers({ media: "text" })).contentTypes).toEqual(["text"]);
  });

  it("est déterministe", () => {
    const a = answers({ who: "team", data: "sensitive", priority: "cost", media: "media" });
    expect(JSON.stringify(mapQuickAnswersToProfile(a))).toBe(JSON.stringify(mapQuickAnswersToProfile(a)));
  });
});
