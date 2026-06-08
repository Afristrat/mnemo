// Composition du SLA paramétrique (moat #5). Modèle HONNÊTE (DÉFCON) :
//  - Une base mémorielle auto-hébergée fait tourner ses couches (LiteLLM, Postgres, Qdrant, app, vault) sur
//    la MÊME infrastructure → ces couches PARTAGENT le sort de l'infra ; multiplier 7 SLA « en série »
//    surestimerait l'indisponibilité (hypothèse d'indépendance fausse). La disponibilité plancher du
//    système = celle de l'IaaS sous-jacent.
//  - On ne PROMET rien : on RAPPORTE les SLA PUBLIÉS des fournisseurs de la classe d'hébergement retenue
//    (spectre complet, sourcé), traduits en minutes d'indisponibilité/mois, avec la variante applicable
//    (instance unique vs redondé) déduite du plan de résidence.
//  - Auto-hébergé sur matériel propre = AUCUN SLA tiers → la disponibilité dépend de VOTRE exploitation
//    (on fournit l'instrument, pas une promesse). On expose alors les SLA des IaaS managés en RÉFÉRENCE.

import type { DrTier, HostingClass, Profile, Recommendation } from "@/lib/engine";
import { hostingClassForProfile } from "@/lib/engine";
import { providersForClass, type SlaProvider } from "./sla-seed";

/** Minutes par mois de référence (30 jours) — base de traduction des % en indisponibilité. */
export const MINUTES_PER_MONTH = 30 * 24 * 60; // 43 200

export type SlaMode = "single" | "ha";

export type ProviderSla = {
  id: string;
  name: string;
  service: string;
  /** % applicable retenu selon la variante (ou null si le fournisseur ne publie pas la variante demandée). */
  pct: number | null;
  mode: SlaMode;
  /** Minutes d'indisponibilité tolérées/mois pour ce % (arrondi 0,1), ou null. */
  downtimeMinutes: number | null;
  sourceUrl: string;
  asOf: string;
  confidence: "high" | "medium";
  note: string | null;
};

export type SlaAssessment = {
  hostingClass: HostingClass;
  /** Auto-hébergé : pas de SLA tiers → disponibilité portée par l'exploitation du client. */
  selfHosted: boolean;
  /** Variante de SLA appliquée, déduite du plan de résidence (redondance multi-zone ↔ « ha »). */
  mode: SlaMode;
  /** SLA publiés des fournisseurs de la classe retenue (spectre, jamais un référent unique). */
  providers: ProviderSla[];
  /** Pour l'auto-hébergé : SLA des IaaS managés en RÉFÉRENCE (ce sur quoi vous POURRIEZ héberger). */
  reference: ProviderSla[];
  /** Fourchette de disponibilité publiée sur la classe (min/max des % connus), ou null si aucun. */
  range: { minPct: number; maxPct: number } | null;
  /** Couches co-localisées sur l'infra (partagent sa disponibilité) — libellés issus de la reco. */
  coLocatedLayers: string[];
};

function downtimeMinutes(pct: number): number {
  return Math.round((1 - pct / 100) * MINUTES_PER_MONTH * 10) / 10;
}

/** Variante de SLA à retenir : redondance (active-active ou DR « hot ») → « ha », sinon « single ». */
export function slaModeForResidency(residency: { activeActive: boolean; drTier: DrTier }): SlaMode {
  return residency.activeActive || residency.drTier === "hot" ? "ha" : "single";
}

function toProviderSla(p: SlaProvider, requestedMode: SlaMode): ProviderSla {
  // Variante demandée d'abord ; repli sur l'autre variante publiée, en signalant le mode réellement retenu.
  const requested = requestedMode === "ha" ? p.haPct : p.singlePct;
  const otherMode: SlaMode = requestedMode === "ha" ? "single" : "ha";
  const other = requestedMode === "ha" ? p.singlePct : p.haPct;
  const pct = requested ?? other;
  const mode = requested !== null ? requestedMode : other !== null ? otherMode : requestedMode;
  return {
    id: p.id,
    name: p.name,
    service: p.service,
    pct,
    mode,
    downtimeMinutes: pct === null ? null : downtimeMinutes(pct),
    sourceUrl: p.sourceUrl,
    asOf: p.asOf,
    confidence: p.confidence,
    note: p.note,
  };
}

function rangeOf(list: ProviderSla[]): { minPct: number; maxPct: number } | null {
  const pcts = list.map((p) => p.pct).filter((v): v is number => v !== null);
  if (pcts.length === 0) return null;
  return { minPct: Math.min(...pcts), maxPct: Math.max(...pcts) };
}

/** Classes managées proposées en référence à un déploiement auto-hébergé (spectre souverain → hyperscaler). */
const REFERENCE_CLASSES: readonly HostingClass[] = ["sovereign-eu", "secnumcloud", "hyperscaler"];

/** Évalue le SLA paramétrique du profil/reco. Pur, sourcé, sans promesse fabriquée. */
export function computeSlaAssessment(profile: Profile, recommendation: Recommendation): SlaAssessment {
  const hostingClass = hostingClassForProfile(profile);
  const mode = slaModeForResidency(recommendation.residency);
  const selfHosted = hostingClass === "self-hosted";

  const providers = providersForClass(hostingClass).map((p) => toProviderSla(p, mode));
  const reference = selfHosted
    ? REFERENCE_CLASSES.flatMap((c) => providersForClass(c).map((p) => toProviderSla(p, mode)))
    : [];

  return {
    hostingClass,
    selfHosted,
    mode,
    providers,
    reference,
    range: rangeOf(selfHosted ? reference : providers),
    // `choice` = produit retenu (donnée, chaîne) ; `name` est un descripteur i18n non résoluble ici (pur).
    coLocatedLayers: recommendation.layers.map((l) => l.choice),
  };
}
