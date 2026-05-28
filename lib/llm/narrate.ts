// Narration LLM (S-039). Le LLM RÉÉCRIT des textes narratifs (verdict, « pourquoi ce preset ») pour
// les rendre spécifiques au profil — il NE TOUCHE JAMAIS AUX CHIFFRES (DÉFCON 1). Double garde-fou :
// (1) la narration ne porte QUE des champs texte (les montants/scores sont rendus ailleurs, à partir
// de la recommandation déterministe) ; (2) `parseNarration` REJETTE tout champ qui réintroduit un
// montant/score (€, euros, /10, %) → repli sur le texte statique. `mergeVerdictNarration` ne réécrit
// que les 4 textes du verdict : les bandes de coût restent celles de la reco (invariant prouvé en test).
// Module PUR (aucun appel réseau) ; la route `app/api/llm/narrate` orchestre callLLM.

import type { Verdict } from "@/lib/engine";
import type { LlmMessage } from "./types";

/** Textes narratifs de base (repli) + contexte de profil pour personnaliser le ton. */
export type NarrationContext = {
  activity?: string;
  preset?: string;
  sensitivity?: string;
  zone?: string;
  regulations?: string[];
  /** Textes statiques actuels : base à améliorer et repli garanti par champ. */
  base: NarrationTexts;
};

export type NarrationTexts = {
  pain: string;
  risk: string;
  gain: string;
  nextStep: string;
  presetReason: string;
};

const NARRATION_KEYS: (keyof NarrationTexts)[] = ["pain", "risk", "gain", "nextStep", "presetReason"];

// Rejette toute réintroduction de montant/score dans un texte narratif (garde-fou DÉFCON 1).
const FORBIDDEN_FIGURE = /€|\beuros?\b|\/\s?10\b|%|\$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Un texte narratif est propre s'il ne réintroduit aucun montant/score chiffré. */
export function isCleanNarration(text: string): boolean {
  return text.trim().length > 0 && !FORBIDDEN_FIGURE.test(text);
}

function extractJsonObject(content: string): Record<string, unknown> | null {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const parsed: unknown = JSON.parse(content.slice(start, end + 1));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Compose le prompt de narration. Le système interdit explicitement les chiffres (les montants/scores
 * sont affichés ailleurs), interdit d'inventer un gain chiffré, et impose un français soigné neutre.
 */
export function buildNarrateMessages(ctx: NarrationContext): LlmMessage[] {
  const profile = [
    ctx.activity !== undefined ? `activité : ${ctx.activity}` : null,
    ctx.preset !== undefined ? `preset : ${ctx.preset}` : null,
    ctx.sensitivity !== undefined ? `sensibilité : ${ctx.sensitivity}` : null,
    ctx.zone !== undefined ? `zone : ${ctx.zone}` : null,
    ctx.regulations !== undefined && ctx.regulations.length > 0 ? `régimes : ${ctx.regulations.join(", ")}` : null,
  ]
    .filter((x): x is string => x !== null)
    .join(" · ");

  const system = [
    "Tu personnalises les textes d'un verdict d'infrastructure mémorielle pour un profil donné.",
    "Réécris CHAQUE texte fourni pour le rendre spécifique et concret au profil, en français soigné",
    "(accents sur les majuscules), ton neutre et factuel — jamais une injonction d'achat.",
    "",
    "RÈGLES STRICTES :",
    "- N'écris AUCUN chiffre, montant, pourcentage ni score (ils sont affichés ailleurs).",
    "- N'invente AUCUN gain chiffré : le seul gain prouvé est « −risques » (Exit Escrow + charte fiduciaire).",
    "- Reste fidèle au sens du texte d'origine ; ne promets rien que les faits ne soutiennent pas.",
    "",
    `Profil : ${profile === "" ? "non précisé" : profile}`,
    "",
    "Textes à réécrire (conserve EXACTEMENT ces clés) :",
    JSON.stringify(ctx.base, null, 2),
    "",
    "Réponds par un objet JSON avec les mêmes clés (pain, risk, gain, nextStep, presetReason), valeurs texte seulement.",
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: "Réécris les textes pour ce profil." },
  ];
}

/**
 * Valide la réponse du LLM : par champ, garde le texte réécrit s'il est non vide ET ne réintroduit
 * aucun chiffre, sinon repli sur le texte de base. Renvoie toujours les 5 textes (jamais vides).
 * Fonction pure.
 */
export function parseNarration(content: string, base: NarrationTexts): NarrationTexts {
  const obj = extractJsonObject(content);
  if (obj === null) return { ...base };
  const out: NarrationTexts = { ...base };
  for (const key of NARRATION_KEYS) {
    const value = obj[key];
    if (typeof value === "string" && isCleanNarration(value)) out[key] = value.trim();
  }
  return out;
}

/**
 * Applique la narration au verdict : ne réécrit QUE les 4 textes ; les bandes de coût, le prix ferme
 * et tout champ numérique restent ceux de la recommandation (invariant DÉFCON 1, prouvé en test).
 */
export function mergeVerdictNarration(verdict: Verdict, texts: NarrationTexts): Verdict {
  return {
    ...verdict,
    pain: texts.pain,
    risk: texts.risk,
    gain: texts.gain,
    nextStep: texts.nextStep,
  };
}
