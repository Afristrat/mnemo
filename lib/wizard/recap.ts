// Récap des choix sous le budget-mètre (S-050) : synthèse PURE de toutes les options du profil avec
// leur valeur EFFECTIVE (dont les dérivées : preset retenu, criticité de sauvegarde, nb de serveurs)
// et un marqueur de transparence (influe DIRECTEMENT sur le coût mensuel, ou oriente seulement la
// stack / les scores / la conformité). Aucune dépendance UI ni I/O → testable.

import type { Profile, Recommendation } from "@/lib/engine";
import {
  ACTIVITY_OPTIONS,
  BUDGET_OPTIONS,
  CONTENT_TYPE_OPTIONS,
  GROWTH_OPTIONS,
  LATENCY_OPTIONS,
  REGULATION_OPTIONS,
  REQ_PER_DAY_OPTIONS,
  SENSITIVITY_OPTIONS,
  TECH_LEVEL_OPTIONS,
  VOICES_OPTIONS,
  VOLUME_OPTIONS,
  ZONE_OPTIONS,
  type Option,
} from "./options";

export type RecapItem = { label: string; value: string; impactsCost: boolean };
export type RecapGroup = { heading: string; items: RecapItem[] };

function labelOf<T extends string>(options: Option<T>[], value: T): string {
  return options.find((o) => o.value === value)?.label ?? value;
}
function labelsOf<T extends string>(options: Option<T>[], values: T[]): string {
  return values.length === 0 ? "—" : values.map((v) => labelOf(options, v)).join(", ");
}

const MODALITY_LABEL = { audio: "Audio", video: "Vidéo", images: "Images" } as const;

function mediaSummary(profile: Profile): string {
  const needs = (profile.mediaNeeds ?? []).filter((n) => n.ingest.tier !== "none" || n.generate.tier !== "none");
  if (needs.length === 0) return "Aucun besoin média actif";
  return needs.map((n) => `${MODALITY_LABEL[n.modality]} (${n.mode === "sovereign" ? "souverain" : "API"})`).join(", ");
}

function modulesSummary(reco: Recommendation): string {
  if (reco.activeModules.length === 0) return "Aucun module activé";
  return reco.activeModules.map((m) => `${m.name} (niv. ${m.level}/${m.maxLevel})`).join(", ");
}

/**
 * Récap structuré des choix avec valeurs effectives + marqueur d'impact coût. Pur.
 * `impactsCost` = pilote DIRECTEMENT une ligne de coût mensuel ; les choix de souveraineté /
 * conformité / gouvernance (zone, régimes, sensibilité, audit, bitemporel, compétences, voix, budget)
 * orientent la stack/les scores mais n'ajoutent pas de ligne de coût directe → `false` (transparence).
 */
export function buildChoiceRecap(profile: Profile, reco: Recommendation): RecapGroup[] {
  const serverCount = reco.compute.instances.reduce((sum, i) => sum + i.count, 0);
  return [
    {
      heading: "Résultat",
      items: [
        { label: "Preset retenu", value: reco.preset, impactsCost: true },
        { label: "Serveurs dimensionnés", value: serverCount > 0 ? String(serverCount) : "managé", impactsCost: true },
        {
          label: "Sauvegarde",
          value: `criticité ${reco.backup.criticality}, ${reco.backup.copies} copie(s)`,
          impactsCost: reco.backup.criticality !== "none",
        },
      ],
    },
    {
      heading: "Profil & conformité",
      items: [
        { label: "Activité", value: labelOf(ACTIVITY_OPTIONS, profile.activity), impactsCost: false },
        { label: "Zone d'hébergement", value: labelOf(ZONE_OPTIONS, profile.zone), impactsCost: false },
        { label: "Sensibilité", value: labelOf(SENSITIVITY_OPTIONS, profile.sensitivity), impactsCost: false },
        { label: "Régimes", value: labelsOf(REGULATION_OPTIONS, profile.regulations), impactsCost: false },
        { label: "Audit", value: profile.audit ? "Oui" : "Non", impactsCost: false },
        { label: "Bitemporel", value: profile.bitemporal ? "Oui" : "Non", impactsCost: false },
      ],
    },
    {
      heading: "Charge & échelle",
      items: [
        { label: "Utilisateurs", value: String(profile.users), impactsCost: true },
        { label: "Volume de données", value: labelOf(VOLUME_OPTIONS, profile.volume), impactsCost: true },
        { label: "Croissance", value: labelOf(GROWTH_OPTIONS, profile.growth), impactsCost: true },
        { label: "Requêtes / jour", value: labelOf(REQ_PER_DAY_OPTIONS, profile.reqPerDay), impactsCost: true },
        { label: "Latence visée", value: labelOf(LATENCY_OPTIONS, profile.latency), impactsCost: true },
        { label: "Compétences techniques", value: labelOf(TECH_LEVEL_OPTIONS, profile.techLevel), impactsCost: false },
        { label: "Budget (plafond)", value: labelOf(BUDGET_OPTIONS, profile.budget), impactsCost: false },
      ],
    },
    {
      heading: "Usage & contenu",
      items: [
        { label: "Types de contenu", value: labelsOf(CONTENT_TYPE_OPTIONS, profile.contentTypes), impactsCost: true },
        { label: "Voix / perspectives", value: labelOf(VOICES_OPTIONS, profile.voices), impactsCost: false },
        { label: "Médias", value: mediaSummary(profile), impactsCost: true },
        { label: "Modules", value: modulesSummary(reco), impactsCost: reco.activeModules.length > 0 },
      ],
    },
  ];
}
