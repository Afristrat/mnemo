import { describe, it, expect } from "vitest";
import { composePrompt, DEFAULT_PROMPTS, isPromptKey, PROMPT_KEYS } from "@/lib/prompts/registry";
import { buildIntakeMessages } from "@/lib/llm/intake";
import { buildNarrateMessages } from "@/lib/llm/narrate";

// S-053 : prompts éditables (option C). Le code greffe les valeurs dynamiques par placeholders ;
// l'admin réécrit le reste. Garanties préservées par les validateurs serveur, pas par le prompt.

describe("composePrompt", () => {
  it("remplace les placeholders connus et laisse les inconnus intacts (pas d'injection)", () => {
    expect(composePrompt("a {{x}} b {{y}}", { x: "1" })).toBe("a 1 b {{y}}");
  });

  it("une valeur vide remplace bien le placeholder", () => {
    expect(composePrompt("[{{a}}]", { a: "" })).toBe("[]");
  });

  it("ne re-traite pas une valeur contenant elle-même un placeholder (passe unique)", () => {
    expect(composePrompt("{{x}}", { x: "{{y}}" })).toBe("{{y}}");
  });
});

describe("DEFAULT_PROMPTS (les clauses DÉFCON 1 sont dans le gabarit par défaut)", () => {
  // S-059 : gabarits réécrits en anglais natif structuré — les clauses DÉFCON 1 sont préservées (en EN).
  it("intake : interdiction d'inventer + de chiffrer", () => {
    expect(DEFAULT_PROMPTS.intake).toContain("INVENT NOTHING");
    expect(DEFAULT_PROMPTS.intake).toContain("NO cost");
    expect(DEFAULT_PROMPTS.intake).toContain("{{enumList}}");
  });
  it("narration : aucun chiffre + gain prouvé seulement + langue de sortie pilotée", () => {
    expect(DEFAULT_PROMPTS.narration).toContain("NO number");
    expect(DEFAULT_PROMPTS.narration).toContain("−risk");
    expect(DEFAULT_PROMPTS.narration).toContain("{{baseTexts}}");
    expect(DEFAULT_PROMPTS.narration).toContain("{{language}}");
  });
  it("assistant : aucun chiffre inventé + langue de réponse pilotée", () => {
    expect(DEFAULT_PROMPTS.assistant).toContain("Invent NO figure");
    expect(DEFAULT_PROMPTS.assistant).toContain("{{language}}");
    expect(DEFAULT_PROMPTS.assistant).toContain("{{recoFacts}}");
  });
  it("veille : URL obligatoirement issue des résultats web", () => {
    expect(DEFAULT_PROMPTS["catalog-veille"]).toContain("NEVER invent a URL");
  });
  it("veille juridique : statut sourcé, jamais un avis juridique, URL non inventée (S-062)", () => {
    expect(DEFAULT_PROMPTS["legal-veille"]).toContain("NOT legal counsel");
    expect(DEFAULT_PROMPTS["legal-veille"]).toContain("NEVER invent a URL");
    expect(DEFAULT_PROMPTS["legal-veille"]).toContain("INVENT NO fact");
  });
});

describe("isPromptKey", () => {
  it("ne reconnaît que les clés enregistrées", () => {
    for (const k of PROMPT_KEYS) expect(isPromptKey(k)).toBe(true);
    expect(isPromptKey("inconnue")).toBe(false);
  });
});

describe("les builders consomment un gabarit personnalisé (override admin)", () => {
  it("buildIntakeMessages utilise le gabarit fourni + greffe l'énumération", () => {
    const messages = buildIntakeMessages("salut", undefined, "PERSONA ADMIN\n{{enumList}}");
    expect(messages[0].content).toContain("PERSONA ADMIN");
    expect(messages[0].content).toContain("cabinet-regule"); // enumList greffé par le code
    expect(messages[0].content).not.toContain("You are a parameter extractor"); // le défaut n'est PAS utilisé
  });

  it("buildNarrateMessages utilise le gabarit fourni + greffe les textes de base", () => {
    const base = { pain: "P.", risk: "R.", gain: "G.", nextStep: "N.", presetReason: "PR." };
    const messages = buildNarrateMessages({ activity: "agence", base }, "TON ADMIN\n{{baseTexts}}");
    expect(messages[0].content).toContain("TON ADMIN");
    expect(messages[0].content).toContain("P."); // baseTexts greffé
    expect(messages[0].content).not.toContain("senior, neutral technical writer"); // le défaut n'est PAS utilisé
  });
});
