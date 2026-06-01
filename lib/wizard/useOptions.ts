import { useTranslations } from "next-intl";
import { jurisdictionsFor, type Continent } from "@/lib/engine";
import { JURISDICTIONS } from "@/lib/engine/geography";
import {
  ACTIVITY_OPTIONS,
  BUDGET_OPTIONS,
  CONTINENT_OPTIONS,
  CONTENT_TYPE_OPTIONS,
  DR_TIER_OPTIONS,
  GROWTH_OPTIONS,
  LATENCY_OPTIONS,
  REGION_OPTIONS,
  REGULATION_OPTIONS,
  REQ_PER_DAY_OPTIONS,
  SENSITIVITY_OPTIONS,
  TECH_LEVEL_OPTIONS,
  VOICES_OPTIONS,
  VOLUME_OPTIONS,
  ZONE_OPTIONS,
  type Option,
  type OptionDef,
} from "./options";

// i18n (S-058) : résout toutes les définitions d'options (clés) en options localisées (libellés)
// pour les composants de saisie. Un seul `useTranslations("Options")` partagé.
type LocalizedOptions = {
  activity: Option<(typeof ACTIVITY_OPTIONS)[number]["value"]>[];
  continent: Option<Continent>[];
  /** Pays/juridictions du continent sélectionné (libellés localisés). */
  countriesFor: (continent: Continent) => Option<string>[];
  /** Toutes les juridictions CONCRÈTES (hors buckets « Autre »), pour le multi-input résidence clients (S-077). */
  allCountries: Option<string>[];
  zone: Option<(typeof ZONE_OPTIONS)[number]["value"]>[];
  region: Option<(typeof REGION_OPTIONS)[number]["value"]>[];
  drTier: Option<(typeof DR_TIER_OPTIONS)[number]["value"]>[];
  volume: Option<(typeof VOLUME_OPTIONS)[number]["value"]>[];
  growth: Option<(typeof GROWTH_OPTIONS)[number]["value"]>[];
  contentType: Option<(typeof CONTENT_TYPE_OPTIONS)[number]["value"]>[];
  regulation: Option<(typeof REGULATION_OPTIONS)[number]["value"]>[];
  sensitivity: Option<(typeof SENSITIVITY_OPTIONS)[number]["value"]>[];
  techLevel: Option<(typeof TECH_LEVEL_OPTIONS)[number]["value"]>[];
  budget: Option<(typeof BUDGET_OPTIONS)[number]["value"]>[];
  reqPerDay: Option<(typeof REQ_PER_DAY_OPTIONS)[number]["value"]>[];
  latency: Option<(typeof LATENCY_OPTIONS)[number]["value"]>[];
  voices: Option<(typeof VOICES_OPTIONS)[number]["value"]>[];
};

export function useOptions(): LocalizedOptions {
  const t = useTranslations("Options");
  const loc = <T extends string>(defs: OptionDef<T>[]): Option<T>[] =>
    defs.map((d) => (d.hintKey !== undefined ? { value: d.value, label: t(d.labelKey), hint: t(d.hintKey) } : { value: d.value, label: t(d.labelKey) }));
  return {
    activity: loc(ACTIVITY_OPTIONS),
    continent: loc(CONTINENT_OPTIONS),
    countriesFor: (continent: Continent): Option<string>[] =>
      jurisdictionsFor(continent).map((j) => ({ value: j.code, label: t(j.labelKey) })),
    allCountries: JURISDICTIONS.filter((j) => !j.code.startsWith("autre-")).map((j) => ({ value: j.code, label: t(j.labelKey) })),
    zone: loc(ZONE_OPTIONS),
    region: loc(REGION_OPTIONS),
    drTier: loc(DR_TIER_OPTIONS),
    volume: loc(VOLUME_OPTIONS),
    growth: loc(GROWTH_OPTIONS),
    contentType: loc(CONTENT_TYPE_OPTIONS),
    regulation: loc(REGULATION_OPTIONS),
    sensitivity: loc(SENSITIVITY_OPTIONS),
    techLevel: loc(TECH_LEVEL_OPTIONS),
    budget: loc(BUDGET_OPTIONS),
    reqPerDay: loc(REQ_PER_DAY_OPTIONS),
    latency: loc(LATENCY_OPTIONS),
    voices: loc(VOICES_OPTIONS),
  };
}
