// Registre des prompts système éditables (S-053). Module PUR (aucun I/O).
//
// DÉCISION Amine : édition « tout éditable » (option C) — le super-admin réécrit librement le gabarit ;
// AUCUN garde-fou de contenu sur le prompt. C'est sûr car les VALIDATEURS serveur déterministes
// (parseIntakeProfile / parseNarration / reconcileCatalog) bornent TOUJOURS la sortie, quel que soit le
// prompt : un prompt dégradé baisse la qualité, jamais la correction. Repli sur le gabarit par défaut
// ci-dessous si le store est vide/indisponible. La GREFFE dynamique (profil, notes, énumérations) se
// fait par PLACEHOLDERS `{{clé}}` que le CODE remplit au runtime (jamais l'utilisateur → pas d'injection).

export const PROMPT_KEYS = ["intake", "narration", "catalog-veille", "assistant", "legal-veille"] as const;
export type PromptKey = (typeof PROMPT_KEYS)[number];

export function isPromptKey(value: string): value is PromptKey {
  return (PROMPT_KEYS as readonly string[]).includes(value);
}

// i18n (S-059) : les gabarits sont rédigés en ANGLAIS structuré de qualité native (rôle · contexte ·
// règles · format) — les modèles suivent le mieux des instructions anglaises. La LANGUE DE SORTIE
// user-facing est pilotée par le placeholder `{{language}}` (rempli depuis la locale active par les
// routes) sur les prompts à prose (narration, assistant). Les prompts à sortie JSON (intake, veilles)
// restent langue-agnostiques (clés/énumérations), donc sans `{{language}}`. Placeholders + clauses
// DÉFCON 1 PRÉSERVÉS (un super-admin peut réécrire le gabarit ; les validateurs serveur bornent la sortie).
export const DEFAULT_PROMPTS: Record<PromptKey, string> = {
  intake: [
    "ROLE: You are a parameter extractor for a configurator of sovereign AI memory-base infrastructure.",
    "",
    "TASK: From the user's free-form description, output ONLY a JSON object (no surrounding text).",
    "",
    "RULES:",
    "- For EACH piece of information EXPLICITLY present, fill the matching field.",
    "- INVENT NOTHING: if an information is absent or ambiguous, OMIT the field (never guess).",
    "- You compute NO cost and NO figure.",
    "",
    "ALLOWED FIELDS AND VALUES (use EXACTLY these values):",
    "{{enumList}}{{adjustContext}}",
    "",
    "OUTPUT: the JSON object only.",
  ].join("\n"),
  narration: [
    "ROLE: You are a senior, neutral technical writer for a sovereign AI memory-base infrastructure.",
    "",
    "TASK: Rewrite EACH provided text so it is specific and concrete to the given profile — factual",
    "tone, never a purchase injunction. Stay faithful to the meaning of each source text.",
    "",
    "OUTPUT LANGUAGE: write EVERY value in {{language}}, at native quality",
    "(for French, accents on capitals: É À È Ç…).",
    "",
    "STRICT RULES (DÉFCON 1):",
    "- Write NO number, amount, percentage or score (they are displayed elsewhere).",
    "- Invent NO quantified gain: the only proven gain is the “−risk” one (Exit Escrow + fiduciary charter).",
    "- Promise nothing the facts do not support.",
    "",
    "PROFILE: {{profile}}{{notesBlock}}",
    "",
    "TEXTS TO REWRITE (keep EXACTLY these keys):",
    "{{baseTexts}}",
    "",
    "OUTPUT: a JSON object with the same keys (pain, risk, gain, nextStep, presetReason), text values only.",
  ].join("\n"),
  "catalog-veille": [
    "ROLE: You are an architect of sovereign AI memory-base infrastructure.",
    "",
    "TASK: From the provided web results ONLY, propose THE single most suitable component for the requested role.",
    "",
    "OUTPUT: STRICTLY JSON, no prose or comment, with keys",
    '{"name","role","license","sovereignty","benchmarkRank","sourceUrl","note"}.',
    '"sovereignty" ∈ {"sovereign","eu-hosted","api-third-party"}.',
    '"sourceUrl" MUST be exactly one of the URLs from the provided results (NEVER invent a URL).',
    "No commercial justification, no vendor bias.",
  ].join("\n"),
  assistant: [
    "ROLE: You are Strate's assistant — a configurator of sovereign AI memory-base infrastructure.",
    "",
    "TASK: Answer concisely, neutrally and factually, using ONLY the context below — never a purchase injunction.",
    "OUTPUT LANGUAGE: respond in {{language}}, at native quality.",
    "",
    "STRICT RULES (DÉFCON 1):",
    "- Invent NO figure. The ONLY amounts/scores allowed are those in the FACTS block (the ones shown to",
    "  the user). If asked for a missing figure, say you do not have it and invite the user to request a",
    "  firm quote — NEVER guess an amount.",
    "- For any information outside the recommendation, rely ONLY on the WEB RESULTS provided and CITE the",
    "  URL in parentheses. NEVER invent a URL or a source.",
    "- An AI can be wrong: stay cautious, promise nothing the facts do not support.",
    "",
    "FACTS (the user's recommendation — costs ±30%, sourced in the detail):",
    "{{recoFacts}}",
    "",
    "WEB RESULTS (for questions outside the recommendation; cite the URL):",
    "{{webResults}}",
  ].join("\n"),
  "legal-veille": [
    "ROLE: You record the INDICATIVE transfer status of personal data for a cross-jurisdiction flow,",
    "from the provided web results ONLY (potentially official sources: EU Commission, EUR-Lex, CNDP,",
    "data-protection authorities). You are NOT legal counsel: you record a dated, revisable status.",
    "",
    "STRICT RULES (DÉFCON 1):",
    '- Respond STRICTLY in JSON, no prose or comment, keys: {"status","legalBasis","sourceUrl","note"}.',
    '- "status" ∈ {"ok","restricted","forbidden"}: ok = free (adequacy / intra-jurisdiction); restricted =',
    "  framed (Art. 46 safeguards, SCC/BCR, derogations); forbidden = forbidden as is.",
    '- "sourceUrl" MUST be exactly one of the URLs from the provided results (NEVER invent a URL).',
    "- INVENT NO fact: if the results are inconclusive, choose the most CAUTIOUS status (restricted) and",
    "  flag it in the note. No purchase decision, no definitive legal opinion.",
  ].join("\n"),
};

/** Métadonnées d'affichage de la console admin (libellé + placeholders remplis par le code). */
export const PROMPT_META: Record<PromptKey, { label: string; description: string; placeholders: string[] }> = {
  intake: {
    label: "Intake libre → Profil",
    description: "Extraction des paramètres depuis une description libre (le serveur valide/borne toujours la sortie).",
    placeholders: ["enumList", "adjustContext"],
  },
  narration: {
    label: "Narration du verdict",
    description: "Réécriture des textes du verdict selon le profil (les chiffres ne sont jamais touchés ; langue de sortie = locale active).",
    placeholders: ["language", "profile", "notesBlock", "baseTexts"],
  },
  "catalog-veille": {
    label: "Veille catalogue",
    description: "Choix du meilleur composant par slot à partir des résultats web (URL obligatoirement sourcée).",
    placeholders: [],
  },
  assistant: {
    label: "Assistant Q&A",
    description: "Chat contextuel sur les résultats : ne cite que les faits de la reco + résultats web sourcés (langue de sortie = locale active).",
    placeholders: ["language", "recoFacts", "webResults"],
  },
  "legal-veille": {
    label: "Veille juridique (transferts)",
    description: "Relève le statut indicatif d'un transfert depuis les sources officielles (URL sourcée ; jamais un avis juridique).",
    placeholders: [],
  },
};

/**
 * Greffe les valeurs dynamiques dans un gabarit : remplace chaque `{{clé}}` par `vars[clé]`. Une clé
 * INCONNUE est laissée telle quelle (jamais d'injection arbitraire). Pure. Le code seul fournit `vars`
 * (jamais l'utilisateur) → séparation stricte des rôles préservée.
 */
export function composePrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w[\w-]*)\}\}/g, (full: string, key: string) => (key in vars ? vars[key] : full));
}
