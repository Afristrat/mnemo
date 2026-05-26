// Chemin 90 s (S-021) : traduit 4 réponses qualitatives orientées « douleur » en un `Profile`
// complet, par DÉFAUTS INTELLIGENTS DOCUMENTÉS. Fonction pure et déterministe (testée). L'utilisateur
// peut ensuite « Affiner » dans le configurateur — le `Profile` produit est la même source de vérité
// (`useWizardProfile` / localStorage). Aucun défaut n'est « orienté » : ils sont prudents et explicités.

import { defaultModuleLevels, type Profile } from "@/lib/engine";

/** Qui pilote la mémoire ? */
export type QuickWho = "solo" | "team" | "regulated" | "research";
/** Nature des données (douleur conformité / confidentialité). */
export type QuickData = "public" | "internal" | "sensitive" | "secret";
/** Priorité dominante assumée par l'utilisateur. */
export type QuickPriority = "sovereignty" | "cost" | "speed";
/** Y a-t-il des médias (au-delà du texte) ? */
export type QuickMedia = "text" | "media";

export type QuickAnswers = {
  who: QuickWho;
  data: QuickData;
  priority: QuickPriority;
  media: QuickMedia;
};

/** Réponses par défaut (entrée la plus neutre — petite structure, données internes, priorité souveraineté, texte). */
export const DEFAULT_QUICK_ANSWERS: QuickAnswers = {
  who: "solo",
  data: "internal",
  priority: "sovereignty",
  media: "text",
};

const ACTIVITY_BY_WHO: Record<QuickWho, Profile["activity"]> = {
  solo: "freelance",
  team: "pme-startup",
  regulated: "cabinet-regule",
  research: "recherche",
};

const SENSITIVITY_BY_DATA: Record<QuickData, Profile["sensitivity"]> = {
  public: "public",
  internal: "internal",
  sensitive: "confidential",
  secret: "secret",
};

/**
 * Traduit les réponses 90 s en `Profile`. Chaque défaut est PRUDENT (jamais sous-dimensionné sur la
 * conformité/sécurité) et documenté ci-dessous ; l'utilisateur ajuste tout au configurateur.
 */
export function mapQuickAnswersToProfile(answers: QuickAnswers): Profile {
  const { who, data, priority, media } = answers;

  // Conformité : RGPD par défaut (UE) ; cabinet régulé → ajoute le secret professionnel.
  const regulations: Profile["regulations"] = who === "regulated" ? ["rgpd", "secret-pro"] : ["rgpd"];

  // Audit / bitemporel : exigés par défaut dès que c'est régulé OU secret (prudence, jamais l'inverse).
  const strict = who === "regulated" || data === "secret";

  // Budget : la priorité « coût » serre la ceinture ; sinon palier intermédiaire raisonnable.
  const budget: Profile["budget"] = priority === "cost" ? "50to200" : "200to500";

  // Compétences : la priorité « rapidité » suppose un démarrage managé/outillé.
  const techLevel: Profile["techLevel"] = priority === "speed" ? "devops" : "hybrid";

  // Contenus : « media » ajoute audio/vidéo/images au texte (détaillable ensuite au bloc Médias).
  const contentTypes: Profile["contentTypes"] =
    media === "media" ? ["text", "audio", "video", "images"] : ["text"];

  return {
    activity: ACTIVITY_BY_WHO[who],
    // Souveraineté = conséquence des contraintes : zone UE par défaut (rapatriable au Maroc au besoin).
    zone: "ue",
    users: who === "team" ? 8 : who === "regulated" ? 5 : 1,
    contentTypes,
    volume: "1to10",
    growth: "medium",
    regulations,
    sensitivity: SENSITIVITY_BY_DATA[data],
    audit: strict,
    bitemporal: strict,
    techLevel,
    budget,
    reqPerDay: "lt100",
    latency: "fast",
    voices: who === "team" ? "multi" : who === "research" ? "multi" : "solo",
    modules: defaultModuleLevels(),
    freeNotes: {},
  };
}
