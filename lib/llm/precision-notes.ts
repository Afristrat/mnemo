// Notes de CONTEXTE pour le LLM (S-064) : les précisions libres « Autre » (activité / zone / région)
// saisies au configurateur, préfixées pour que le LLM sache à quel champ elles se rapportent. Canal
// CONTEXTE-seulement (jamais un chiffre — le garde-fou `isCleanNarration` rejette tout montant/score).
//
// Vit dans la couche LLM (pas dans la vue) : ces préfixes alimentent le prompt de narration, ils ne
// sont JAMAIS rendus à l'écran. Leur localisation suit celle de la couche LLM (S-059), pas l'UI.

import type { Profile } from "@/lib/engine";

/** Construit les notes de précision « Autre » à greffer au contexte LLM (vide si aucune saisie). Pure. */
export function buildOtherPrecisionNotes(profile: Profile): string[] {
  const notes: string[] = [];
  const activityOther = profile.otherText?.activity?.trim();
  if (profile.activity === "other" && activityOther !== undefined && activityOther.length > 0) {
    notes.push(`Activité (précision « Autre ») : ${activityOther}`);
  }
  const zoneOther = profile.otherText?.zone?.trim();
  if (profile.zone === "other" && zoneOther !== undefined && zoneOther.length > 0) {
    notes.push(`Zone d'hébergement (précision « Autre ») : ${zoneOther}`);
  }
  const regionOther = profile.otherText?.region?.trim();
  const regionIsOther =
    profile.residency?.primaryRegion === "other" || (profile.residency?.allowedRegions ?? []).includes("other");
  if (regionIsOther && regionOther !== undefined && regionOther.length > 0) {
    notes.push(`Région(s) (précision « Autre ») : ${regionOther}`);
  }
  return notes;
}
