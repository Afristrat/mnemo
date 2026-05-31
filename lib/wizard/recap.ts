// Récap des choix sous le budget-mètre (S-050) : synthèse PURE de toutes les options du profil avec
// leur valeur EFFECTIVE (dont les dérivées : preset retenu, criticité de sauvegarde, nb de serveurs)
// et un marqueur de transparence (influe DIRECTEMENT sur le coût mensuel, ou oriente seulement la
// stack / les scores / la conformité). Aucune dépendance UI ni I/O → testable.

import { jurisdictionFor, type EngineResolver, type Profile, type Recommendation } from "@/lib/engine";
import {
  ACTIVITY_OPTIONS,
  BUDGET_OPTIONS,
  CONTINENT_OPTIONS,
  CONTENT_TYPE_OPTIONS,
  GROWTH_OPTIONS,
  LATENCY_OPTIONS,
  optionLabelKey,
  REGULATION_OPTIONS,
  REQ_PER_DAY_OPTIONS,
  SENSITIVITY_OPTIONS,
  TECH_LEVEL_OPTIONS,
  VOICES_OPTIONS,
  VOLUME_OPTIONS,
  type OptionDef,
} from "./options";

export type RecapItem = { label: string; value: string; impactsCost: boolean };
export type RecapGroup = { heading: string; items: RecapItem[] };

/** Résout la clé de libellé d'une option (namespace `Options`) — injecté par l'appelant (UI/test). */
export type OptionLabel = (key: string) => string;

/** Traducteur du chrome du récap (namespace `Wizard.recap`, S-059) — injecté (UI) ou stub (tests). */
export type RecapLabel = (key: string, values?: Record<string, string | number>) => string;

function labelOf<T extends string>(defs: OptionDef<T>[], value: T, optionLabel: OptionLabel): string {
  return optionLabel(optionLabelKey(defs, value));
}

/**
 * Libellé d'un champ borné, en intégrant la précision libre « Autre » quand la valeur est `other`
 * ET qu'un texte a été saisi (S-064). Forme : « Autre : <précision> » → le récap montre la précision
 * au lieu d'un « Autre » muet. Aucune précision ⇒ libellé inchangé (invariant préservé).
 */
function labelWithOther<T extends string>(
  defs: OptionDef<T>[],
  value: T,
  optionLabel: OptionLabel,
  otherText: string | undefined,
): string {
  const base = labelOf(defs, value, optionLabel);
  const precise = otherText?.trim();
  if (value === "other" && precise !== undefined && precise.length > 0) return `${base} : ${precise}`;
  return base;
}
function labelsOf<T extends string>(defs: OptionDef<T>[], values: T[], optionLabel: OptionLabel): string {
  return values.length === 0 ? "—" : values.map((v) => labelOf(defs, v, optionLabel)).join(", ");
}

/** Libellé géographie (S-076) : « <continent> · <pays> », avec précision libre si pays « Autre ». */
function geographyValue(profile: Profile, optionLabel: OptionLabel): string {
  const continent = labelOf(CONTINENT_OPTIONS, profile.continent, optionLabel);
  let country = optionLabel(jurisdictionFor(profile.country)?.labelKey ?? "country.autre-europe");
  const precise = profile.otherText?.zone?.trim();
  if (profile.country.startsWith("autre-") && precise !== undefined && precise.length > 0) {
    country = `${country} : ${precise}`;
  }
  return `${continent} · ${country}`;
}

function mediaSummary(profile: Profile, t: RecapLabel): string {
  const needs = (profile.mediaNeeds ?? []).filter((n) => n.ingest.tier !== "none" || n.generate.tier !== "none");
  if (needs.length === 0) return t("value.mediaNone");
  return needs
    .map((n) => `${t("value.modality", { modality: n.modality })} (${t("value.mode", { mode: n.mode })})`)
    .join(", ");
}

function modulesSummary(reco: Recommendation, resolveEngine: EngineResolver, t: RecapLabel): string {
  if (reco.activeModules.length === 0) return t("value.modulesNone");
  return reco.activeModules
    .map((m) => t("value.moduleItem", { name: resolveEngine(m.name), level: m.level, max: m.maxLevel }))
    .join(", ");
}

/**
 * Récap structuré des choix avec valeurs effectives + marqueur d'impact coût. Pur.
 * `impactsCost` = pilote DIRECTEMENT une ligne de coût mensuel ; les choix de souveraineté /
 * conformité / gouvernance (zone, régimes, sensibilité, audit, bitemporel, compétences, voix, budget)
 * orientent la stack/les scores mais n'ajoutent pas de ligne de coût directe → `false` (transparence).
 */
export function buildChoiceRecap(
  profile: Profile,
  reco: Recommendation,
  optionLabel: OptionLabel,
  resolveEngine: EngineResolver,
  recapText: RecapLabel,
): RecapGroup[] {
  const t = recapText;
  const serverCount = reco.compute.instances.reduce((sum, i) => sum + i.count, 0);
  const yesNo = (v: boolean): string => t(v ? "value.yes" : "value.no");
  return [
    {
      heading: t("heading.result"),
      items: [
        { label: t("label.preset"), value: reco.preset, impactsCost: true },
        { label: t("label.servers"), value: serverCount > 0 ? String(serverCount) : t("value.managed"), impactsCost: true },
        {
          label: t("label.backup"),
          value: t("value.backup", { criticality: reco.backup.criticality, copies: reco.backup.copies }),
          impactsCost: reco.backup.criticality !== "none",
        },
      ],
    },
    {
      heading: t("heading.profile"),
      items: [
        { label: t("label.activity"), value: labelWithOther(ACTIVITY_OPTIONS, profile.activity, optionLabel, profile.otherText?.activity), impactsCost: false },
        { label: t("label.geography"), value: geographyValue(profile, optionLabel), impactsCost: false },
        { label: t("label.sensitivity"), value: labelOf(SENSITIVITY_OPTIONS, profile.sensitivity, optionLabel), impactsCost: false },
        { label: t("label.regulations"), value: labelsOf(REGULATION_OPTIONS, profile.regulations, optionLabel), impactsCost: false },
        { label: t("label.audit"), value: yesNo(profile.audit), impactsCost: false },
        { label: t("label.bitemporal"), value: yesNo(profile.bitemporal), impactsCost: false },
      ],
    },
    {
      heading: t("heading.load"),
      items: [
        { label: t("label.users"), value: String(profile.users), impactsCost: true },
        { label: t("label.volume"), value: labelOf(VOLUME_OPTIONS, profile.volume, optionLabel), impactsCost: true },
        { label: t("label.growth"), value: labelOf(GROWTH_OPTIONS, profile.growth, optionLabel), impactsCost: true },
        { label: t("label.reqPerDay"), value: labelOf(REQ_PER_DAY_OPTIONS, profile.reqPerDay, optionLabel), impactsCost: true },
        { label: t("label.latency"), value: labelOf(LATENCY_OPTIONS, profile.latency, optionLabel), impactsCost: true },
        { label: t("label.techLevel"), value: labelOf(TECH_LEVEL_OPTIONS, profile.techLevel, optionLabel), impactsCost: false },
        { label: t("label.budget"), value: labelOf(BUDGET_OPTIONS, profile.budget, optionLabel), impactsCost: false },
      ],
    },
    {
      heading: t("heading.usage"),
      items: [
        { label: t("label.contentTypes"), value: labelsOf(CONTENT_TYPE_OPTIONS, profile.contentTypes, optionLabel), impactsCost: true },
        { label: t("label.voices"), value: labelOf(VOICES_OPTIONS, profile.voices, optionLabel), impactsCost: false },
        { label: t("label.media"), value: mediaSummary(profile, t), impactsCost: true },
        { label: t("label.modules"), value: modulesSummary(reco, resolveEngine, t), impactsCost: reco.activeModules.length > 0 },
      ],
    },
  ];
}
