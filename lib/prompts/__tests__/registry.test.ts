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
  it("intake : interdiction d'inventer + de chiffrer", () => {
    expect(DEFAULT_PROMPTS.intake).toContain("N'INVENTE RIEN");
    expect(DEFAULT_PROMPTS.intake).toContain("AUCUN coût");
    expect(DEFAULT_PROMPTS.intake).toContain("{{enumList}}");
  });
  it("narration : aucun chiffre + gain prouvé seulement", () => {
    expect(DEFAULT_PROMPTS.narration).toContain("AUCUN chiffre");
    expect(DEFAULT_PROMPTS.narration).toContain("−risques");
    expect(DEFAULT_PROMPTS.narration).toContain("{{baseTexts}}");
  });
  it("veille : URL obligatoirement issue des résultats web", () => {
    expect(DEFAULT_PROMPTS["catalog-veille"]).toContain("n'invente JAMAIS d'URL");
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
    expect(messages[0].content).not.toContain("Tu es un extracteur"); // le défaut n'est PAS utilisé
  });

  it("buildNarrateMessages utilise le gabarit fourni + greffe les textes de base", () => {
    const base = { pain: "P.", risk: "R.", gain: "G.", nextStep: "N.", presetReason: "PR." };
    const messages = buildNarrateMessages({ activity: "agence", base }, "TON ADMIN\n{{baseTexts}}");
    expect(messages[0].content).toContain("TON ADMIN");
    expect(messages[0].content).toContain("P."); // baseTexts greffé
    expect(messages[0].content).not.toContain("Tu personnalises"); // le défaut n'est PAS utilisé
  });
});
