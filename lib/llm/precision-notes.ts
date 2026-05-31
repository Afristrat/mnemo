// Notes de CONTEXTE pour le LLM (S-064) : les précisions libres « Autre » (activité / zone / région)
// saisies au configurateur, préfixées pour que le LLM sache à quel champ elles se rapportent. Canal
// CONTEXTE-seulement (jamais un chiffre — le garde-fou `isCleanNarration` rejette tout montant/score).
//
// Vit dans la couche LLM (pas dans la vue) : ces préfixes alimentent le prompt de narration (rédigé en
// ANGLAIS, S-059), ils ne sont JAMAIS rendus à l'écran → préfixes en anglais pour la cohérence du prompt
// (le texte libre de l'utilisateur est conservé tel quel ; la langue de SORTIE est pilotée par {{language}}).

import type { Profile } from "@/lib/engine";

/** Construit les notes de précision « Autre » à greffer au contexte LLM (vide si aucune saisie). Pure. */
export function buildOtherPrecisionNotes(profile: Profile): string[] {
  const notes: string[] = [];
  const activityOther = profile.otherText?.activity?.trim();
  if (profile.activity === "other" && activityOther !== undefined && activityOther.length > 0) {
    notes.push(`Activity (“Other” detail): ${activityOther}`);
  }
  const zoneOther = profile.otherText?.zone?.trim();
  if (profile.zone === "other" && zoneOther !== undefined && zoneOther.length > 0) {
    notes.push(`Hosting zone (“Other” detail): ${zoneOther}`);
  }
  const regionOther = profile.otherText?.region?.trim();
  const regionIsOther =
    profile.residency?.primaryRegion === "other" || (profile.residency?.allowedRegions ?? []).includes("other");
  if (regionIsOther && regionOther !== undefined && regionOther.length > 0) {
    notes.push(`Region(s) (“Other” detail): ${regionOther}`);
  }
  return notes;
}
