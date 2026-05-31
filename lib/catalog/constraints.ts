// Contraintes UTILISATEUR de la veille catalogue (S-072) — source de vérité unique appliquée à la
// recherche (requête), au prompt LLM ET au garde-fou `reconcileCatalog`. Décision Amine : « la
// recherche crawl4ai doit OBLIGATOIREMENT respecter les choix utilisateurs comme contrainte ABSOLUE ».
// Un composant qui viole une contrainte n'est JAMAIS retenu (repli seed `flagged`), quelle que soit sa
// pertinence. Pur, sans I/O.

import type { Profile } from "@/lib/engine/types";

export type CatalogConstraints = {
  /** Souveraineté exigée → exclut toute API tierce (`api-third-party`). */
  requireSovereign: boolean;
  /** Au moins un régime réglementaire actif (hors « none »). */
  regulated: boolean;
  /** Données non publiques (toute fuite a un impact). */
  nonPublic: boolean;
  zone: Profile["zone"];
  /** Régimes actifs (codes), pour la traçabilité + le prompt. */
  regulations: string[];
};

/** Dérive les contraintes dures du profil. `preferSovereign` (toggle utilisateur) est ABSOLU. */
export function deriveCatalogConstraints(profile: Profile): CatalogConstraints {
  const regulations = profile.regulations.filter((r) => r !== "none");
  const requireSovereign =
    profile.sensitivity === "secret" ||
    profile.preferSovereign === true ||
    regulations.some((r) => r === "secret-pro" || r === "hipaa");
  return {
    requireSovereign,
    regulated: regulations.length > 0,
    nonPublic: profile.sensitivity !== "public",
    zone: profile.zone,
    regulations,
  };
}

/**
 * Vrai si un composant VIOLE une contrainte dure (→ à rejeter, repli seed `flagged`). On ne rejette
 * QUE sur des CHOIX EXPLICITES de l'utilisateur (jamais une interprétation discutable) : souveraineté
 * exigée (`secret`/`secret-pro`/`hipaa`/toggle `preferSovereign`) ⇒ aucune API tierce. La zone est
 * respectée ailleurs (orientation de la recherche + modèle de résidence/transferts qui encadre les flux
 * hors juridiction) : le RGPD seul n'interdit pas une API tierce (transferts encadrés possibles) → pas
 * de rejet dur sur la seule présence d'un régime.
 */
export function candidateViolatesConstraints(sovereignty: string, profile: Profile): boolean {
  const c = deriveCatalogConstraints(profile);
  return c.requireSovereign && sovereignty === "api-third-party";
}

/** Suffixe de requête web orientant la recherche vers des composants conformes (anglais : moteur de recherche). */
export function constraintQueryHint(profile: Profile): string {
  const c = deriveCatalogConstraints(profile);
  const parts: string[] = [];
  if (c.requireSovereign) parts.push("self-hostable open-source sovereign");
  if (c.zone === "ue") parts.push("EU-hosted GDPR");
  else if (c.zone === "maroc") parts.push("data residency Morocco CNDP");
  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

/** Bloc de RÈGLES DURES injecté dans le prompt LLM (anglais : gabarit anglais). Le LLM doit rejeter sinon. */
export function constraintPromptBlock(profile: Profile): string {
  const c = deriveCatalogConstraints(profile);
  const rules: string[] = [`hosting zone = ${c.zone}`];
  if (c.requireSovereign) rules.push("the component MUST be self-hostable / sovereign — NO third-party API (reject api-third-party)");
  if (c.regulated) rules.push(`MUST be compatible with the regimes: ${c.regulations.join(", ")}`);
  if (c.nonPublic) rules.push("data is NOT public — exclude any option that ships data to an uncontrolled jurisdiction");
  return rules.join("; ");
}
