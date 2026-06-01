import type {
  Activity,
  Budget,
  Continent,
  ContentType,
  DrTier,
  Growth,
  Latency,
  Region,
  Regulation,
  ReqPerDay,
  Sensitivity,
  TechLevel,
  Voices,
  Volume,
  Zone,
} from "@/lib/engine";

// i18n (S-058) : les options portent désormais des CLÉS de traduction (namespace `Options`),
// pas de libellés en dur. `OptionDef` = source (clé) ; `Option` = forme résolue (label) consommée
// par RadioCards/CheckboxCards. Côté UI : `useOptions()` (hook) résout via next-intl. Côté pur
// (export, recap) : `optionLabelKey(defs, value)` donne la clé, résolue par un traducteur injecté.

/** Option résolue (libellé localisé) — consommée par les composants de saisie. */
export type Option<T extends string> = { value: T; label: string; hint?: string };
/** Définition source d'une option : valeur + clés de traduction. */
export type OptionDef<T extends string> = { value: T; labelKey: string; hintKey?: string };

export const ACTIVITY_OPTIONS: OptionDef<Activity>[] = [
  { value: "freelance", labelKey: "activity.freelance" },
  { value: "cabinet-regule", labelKey: "activity.cabinet-regule", hintKey: "activity.cabinet-reguleHint" },
  { value: "particulier", labelKey: "activity.particulier" },
  { value: "agence", labelKey: "activity.agence" },
  { value: "pme-startup", labelKey: "activity.pme-startup" },
  { value: "recherche", labelKey: "activity.recherche" },
  { value: "other", labelKey: "activity.other" },
];

export const ZONE_OPTIONS: OptionDef<Zone>[] = [
  { value: "ue", labelKey: "zone.ue" },
  { value: "maroc", labelKey: "zone.maroc" },
  { value: "us", labelKey: "zone.us" },
  { value: "other", labelKey: "zone.other" },
];

/** Continents (axe géographique homogène, S-076). Le pays se choisit ensuite via `jurisdictionsFor`. */
export const CONTINENT_OPTIONS: OptionDef<Continent>[] = [
  { value: "europe", labelKey: "continent.europe" },
  { value: "north-america", labelKey: "continent.north-america" },
  { value: "latam", labelKey: "continent.latam" },
  { value: "africa", labelKey: "continent.africa" },
  { value: "middle-east", labelKey: "continent.middle-east" },
  { value: "apac", labelKey: "continent.apac" },
];

/** Régions (juridictions) pour la résidence + le DR multi-région (S-048, finding C4). */
export const REGION_OPTIONS: OptionDef<Region>[] = [
  { value: "eu", labelKey: "region.eu" },
  { value: "maroc", labelKey: "region.maroc" },
  { value: "us", labelKey: "region.us" },
  { value: "other", labelKey: "region.other" },
];

/** Paliers de continuité régionale (DR/failover, spec n°2 §3). */
export const DR_TIER_OPTIONS: OptionDef<DrTier>[] = [
  { value: "none", labelKey: "drTier.none", hintKey: "drTier.noneHint" },
  { value: "warm", labelKey: "drTier.warm", hintKey: "drTier.warmHint" },
  { value: "hot", labelKey: "drTier.hot", hintKey: "drTier.hotHint" },
];

export const VOLUME_OPTIONS: OptionDef<Volume>[] = [
  { value: "lt1", labelKey: "volume.lt1", hintKey: "volume.lt1Hint" },
  { value: "1to10", labelKey: "volume.1to10", hintKey: "volume.1to10Hint" },
  { value: "10to100", labelKey: "volume.10to100", hintKey: "volume.10to100Hint" },
  { value: "100to1000", labelKey: "volume.100to1000", hintKey: "volume.100to1000Hint" },
  { value: "gt1000", labelKey: "volume.gt1000", hintKey: "volume.gt1000Hint" },
];

export const GROWTH_OPTIONS: OptionDef<Growth>[] = [
  { value: "low", labelKey: "growth.low", hintKey: "growth.lowHint" },
  { value: "medium", labelKey: "growth.medium", hintKey: "growth.mediumHint" },
  { value: "high", labelKey: "growth.high", hintKey: "growth.highHint" },
];

export const CONTENT_TYPE_OPTIONS: OptionDef<ContentType>[] = [
  { value: "text", labelKey: "contentType.text" },
  { value: "audio", labelKey: "contentType.audio", hintKey: "contentType.audioHint" },
  { value: "video", labelKey: "contentType.video" },
  { value: "images", labelKey: "contentType.images" },
  { value: "code", labelKey: "contentType.code" },
  { value: "structured", labelKey: "contentType.structured" },
];

export const REGULATION_OPTIONS: OptionDef<Regulation>[] = [
  { value: "rgpd", labelKey: "regulation.rgpd", hintKey: "regulation.rgpdHint" },
  { value: "cndp", labelKey: "regulation.cndp", hintKey: "regulation.cndpHint" },
  { value: "aiact", labelKey: "regulation.aiact", hintKey: "regulation.aiactHint" },
  { value: "hipaa", labelKey: "regulation.hipaa", hintKey: "regulation.hipaaHint" },
  { value: "secret-pro", labelKey: "regulation.secret-pro" },
  { value: "lgpd", labelKey: "regulation.lgpd", hintKey: "regulation.lgpdHint" },
  { value: "appi", labelKey: "regulation.appi", hintKey: "regulation.appiHint" },
  { value: "none", labelKey: "regulation.none" },
];

export const SENSITIVITY_OPTIONS: OptionDef<Sensitivity>[] = [
  { value: "public", labelKey: "sensitivity.public", hintKey: "sensitivity.publicHint" },
  { value: "internal", labelKey: "sensitivity.internal", hintKey: "sensitivity.internalHint" },
  { value: "confidential", labelKey: "sensitivity.confidential", hintKey: "sensitivity.confidentialHint" },
  { value: "secret", labelKey: "sensitivity.secret", hintKey: "sensitivity.secretHint" },
];

export const TECH_LEVEL_OPTIONS: OptionDef<TechLevel>[] = [
  { value: "none", labelKey: "techLevel.none" },
  { value: "dev", labelKey: "techLevel.dev" },
  { value: "hybrid", labelKey: "techLevel.hybrid", hintKey: "techLevel.hybridHint" },
  { value: "devops", labelKey: "techLevel.devops" },
];

export const BUDGET_OPTIONS: OptionDef<Budget>[] = [
  { value: "lt50", labelKey: "budget.lt50" },
  { value: "50to200", labelKey: "budget.50to200" },
  { value: "200to500", labelKey: "budget.200to500" },
  { value: "500to2k", labelKey: "budget.500to2k" },
  { value: "gt2k", labelKey: "budget.gt2k" },
];

export const REQ_PER_DAY_OPTIONS: OptionDef<ReqPerDay>[] = [
  { value: "lt100", labelKey: "reqPerDay.lt100" },
  { value: "lt1k", labelKey: "reqPerDay.lt1k" },
  { value: "lt10k", labelKey: "reqPerDay.lt10k" },
  { value: "gt10k", labelKey: "reqPerDay.gt10k" },
];

export const LATENCY_OPTIONS: OptionDef<Latency>[] = [
  { value: "fast", labelKey: "latency.fast", hintKey: "latency.fastHint" },
  { value: "acceptable", labelKey: "latency.acceptable", hintKey: "latency.acceptableHint" },
  { value: "relaxed", labelKey: "latency.relaxed", hintKey: "latency.relaxedHint" },
];

export const VOICES_OPTIONS: OptionDef<Voices>[] = [
  { value: "solo", labelKey: "voices.solo", hintKey: "voices.soloHint" },
  { value: "multi", labelKey: "voices.multi", hintKey: "voices.multiHint" },
  { value: "many", labelKey: "voices.many", hintKey: "voices.manyHint" },
];

/** Clé de traduction du libellé d'une option (pour le code pur : export, recap). Repli = la valeur. */
export function optionLabelKey<T extends string>(defs: OptionDef<T>[], value: T): string {
  return defs.find((o) => o.value === value)?.labelKey ?? value;
}
