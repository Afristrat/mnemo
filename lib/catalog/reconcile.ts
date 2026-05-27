// Garde-fou du catalogue vivant (S-035, jumeau de `lib/pricing/reconcile`).
//
// Un candidat proposé par la veille live (Firecrawl + LLM, S-036) peut dérailler : nom vide, source
// absente (anti-DÉFCON 1), ou souveraineté incompatible avec un profil régulé/secret. `reconcileCatalog`
// valide le candidat live ; sinon il **replie sur le seed** en marquant `provenance: "flagged"` +
// `confidence: "low"` (on signale la dégradation, on n'invente rien). Fonction PURE, sans réseau.

import type { Profile } from "@/lib/engine/types";
import type { ComponentCandidate } from "./types";

/** Un profil régulé « dur » ou `secret` exige un composant souverain (pas d'API tierce). */
function requiresSovereign(profile: Profile): boolean {
  return (
    profile.sensitivity === "secret" ||
    profile.regulations.some((r) => r === "secret-pro" || r === "hipaa")
  );
}

/**
 * Valide un candidat live vs le seed (baseline de plausibilité), selon le profil. Live retenu
 * (`provenance: "live"`) s'il a un nom, une source (URL non vide, DÉFCON 1) et une souveraineté
 * compatible avec le profil ; sinon repli **seed** marqué `flagged` + `confidence: "low"`. Pur.
 */
export function reconcileCatalog(
  live: ComponentCandidate,
  seed: ComponentCandidate,
  profile: Profile,
): ComponentCandidate {
  const hasName = live.name.trim().length > 0;
  const hasSource = live.source.url.trim().length > 0;
  const sovereignOk = !(requiresSovereign(profile) && live.sovereignty === "api-third-party");

  if (hasName && hasSource && sovereignOk) {
    return { ...live, provenance: "live" };
  }
  return { ...seed, provenance: "flagged", confidence: "low" };
}
