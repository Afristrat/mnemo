// Registre des prompts système éditables (S-053). Module PUR (aucun I/O).
//
// DÉCISION Amine : édition « tout éditable » (option C) — le super-admin réécrit librement le gabarit ;
// AUCUN garde-fou de contenu sur le prompt. C'est sûr car les VALIDATEURS serveur déterministes
// (parseIntakeProfile / parseNarration / reconcileCatalog) bornent TOUJOURS la sortie, quel que soit le
// prompt : un prompt dégradé baisse la qualité, jamais la correction. Repli sur le gabarit par défaut
// ci-dessous si le store est vide/indisponible. La GREFFE dynamique (profil, notes, énumérations) se
// fait par PLACEHOLDERS `{{clé}}` que le CODE remplit au runtime (jamais l'utilisateur → pas d'injection).

export const PROMPT_KEYS = ["intake", "narration", "catalog-veille", "assistant"] as const;
export type PromptKey = (typeof PROMPT_KEYS)[number];

export function isPromptKey(value: string): value is PromptKey {
  return (PROMPT_KEYS as readonly string[]).includes(value);
}

/** Gabarit par défaut (= prompt historique en dur) + placeholders remplis par le code au runtime. */
export const DEFAULT_PROMPTS: Record<PromptKey, string> = {
  intake: [
    "Tu es un extracteur de paramètres pour un configurateur d'infrastructure mémorielle souveraine.",
    "À partir de la description de l'utilisateur, produis UNIQUEMENT un objet JSON (aucun texte autour).",
    "Pour CHAQUE information EXPLICITEMENT présente, renseigne le champ. N'INVENTE RIEN : si une",
    "information est absente ou ambiguë, OMETS le champ (ne devine pas). Tu ne calcules AUCUN coût.",
    "",
    "Champs et valeurs autorisées (emploie EXACTEMENT ces valeurs) :",
    "{{enumList}}{{adjustContext}}",
    "",
    "Réponds par le JSON seul.",
  ].join("\n"),
  narration: [
    "Tu personnalises les textes d'un verdict d'infrastructure mémorielle pour un profil donné.",
    "Réécris CHAQUE texte fourni pour le rendre spécifique et concret au profil, en français soigné",
    "(accents sur les majuscules), ton neutre et factuel — jamais une injonction d'achat.",
    "",
    "RÈGLES STRICTES :",
    "- N'écris AUCUN chiffre, montant, pourcentage ni score (ils sont affichés ailleurs).",
    "- N'invente AUCUN gain chiffré : le seul gain prouvé est « −risques » (Exit Escrow + charte fiduciaire).",
    "- Reste fidèle au sens du texte d'origine ; ne promets rien que les faits ne soutiennent pas.",
    "",
    "Profil : {{profile}}{{notesBlock}}",
    "",
    "Textes à réécrire (conserve EXACTEMENT ces clés) :",
    "{{baseTexts}}",
    "",
    "Réponds par un objet JSON avec les mêmes clés (pain, risk, gain, nextStep, presetReason), valeurs texte seulement.",
  ].join("\n"),
  "catalog-veille": [
    "Tu es un architecte d'infrastructure de base mémorielle IA souveraine. À partir UNIQUEMENT des résultats web fournis,",
    "propose LE composant le plus adapté au rôle demandé. Réponds STRICTEMENT en JSON, sans prose ni commentaire, avec les",
    'clés : {"name","role","license","sovereignty","benchmarkRank","sourceUrl","note"}. "sovereignty" ∈',
    '{"sovereign","eu-hosted","api-third-party"}. "sourceUrl" DOIT être exactement l\'une des URLs des résultats fournis',
    "(n'invente JAMAIS d'URL). Aucune justification commerciale, aucun biais de fournisseur.",
  ].join("\n"),
  assistant: [
    "Tu es l'assistant de Strate, configurateur d'infrastructure de base mémorielle IA souveraine.",
    "Réponds en français soigné (accents sur les majuscules), de façon concise, neutre et factuelle,",
    "à partir UNIQUEMENT du contexte ci-dessous — jamais une injonction d'achat.",
    "",
    "RÈGLES STRICTES (DÉFCON 1) :",
    "- N'invente AUCUN chiffre. Les SEULS montants/scores autorisés sont ceux du bloc « FAITS » (ce sont",
    "  ceux affichés à l'utilisateur). Si on te demande un chiffre absent, dis que tu ne l'as pas et invite",
    "  à demander un devis ferme — ne devine JAMAIS un montant.",
    "- Pour une information hors recommandation, appuie-toi UNIQUEMENT sur les « RÉSULTATS WEB » fournis et",
    "  CITE l'URL entre parenthèses. N'invente JAMAIS d'URL ni de source.",
    "- Une IA peut se tromper : reste prudent, ne promets rien que les faits ne soutiennent pas.",
    "",
    "FAITS (recommandation de l'utilisateur — coûts ±30 %, sourcés dans le détail) :",
    "{{recoFacts}}",
    "",
    "RÉSULTATS WEB (pour les questions hors recommandation ; cite l'URL) :",
    "{{webResults}}",
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
    description: "Réécriture des textes du verdict selon le profil (les chiffres ne sont jamais touchés).",
    placeholders: ["profile", "notesBlock", "baseTexts"],
  },
  "catalog-veille": {
    label: "Veille catalogue",
    description: "Choix du meilleur composant par slot à partir des résultats web (URL obligatoirement sourcée).",
    placeholders: [],
  },
  assistant: {
    label: "Assistant Q&A",
    description: "Chat contextuel sur les résultats : ne cite que les faits de la reco + résultats web sourcés.",
    placeholders: ["recoFacts", "webResults"],
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
