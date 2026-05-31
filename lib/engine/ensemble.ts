// Ensemble multi-configuration (F5).
// Analogie : prévision météo d'ensemble, on ne lance pas un seul modèle, mais
// plusieurs, et la DISPERSION de leurs sorties (le « spread ») mesure l'incertitude.
// Ici chaque « membre » de l'ensemble est le profil utilisateur biaisé vers une
// priorité différente (souveraineté / coût / délai). On passe chaque membre dans
// le moteur déterministe `recommend()` et on quantifie l'écart résultant.

import type { Catalog } from "@/lib/catalog/types";
import { NEUTRAL_BACKUP_PRICES, type BackupPriceTable } from "./backup";
import { NEUTRAL_COMPUTE_PRICES, type ComputePriceTable } from "./compute";
import { NEUTRAL_RESIDENCY_PRICES, type ResidencyPriceTable } from "./residency";
import { msg, type Message } from "./message";
import { MODULES, defaultModuleLevels } from "./modules";
import { recommend } from "./recommend";
import { NEUTRAL_LLM_PRICES, type LlmTokenPrices } from "./llm-usage";
import { NEUTRAL_MEDIA_PRICES, type MultimodalPriceTable } from "./sizing";
import {
  PRESETS,
  type ModuleId,
  type Preset,
  type Profile,
  type Recommendation,
} from "./types";

export const ENSEMBLE_VARIANT_IDS = ["sovereignty", "cost", "speed"] as const;
export type EnsembleVariantId = (typeof ENSEMBLE_VARIANT_IDS)[number];

// i18n (S-059, résiduel) : la prose des membres d'ensemble (label, intent, assumptions) et le libellé
// d'incertitude deviennent des descripteurs `Message` résolus en fr/en par la présentation. `agreement`
// reste une union (discriminant logique : tonalité de chip, branches `select` ICU), pas de la prose.
export type EnsembleVariant = {
  id: EnsembleVariantId;
  label: Message;
  /** Objectif poursuivi par ce membre de l'ensemble. */
  intent: Message;
  /** Hypothèses appliquées au profil, en clair (transparence des overrides). */
  assumptions: Message[];
  profile: Profile;
  recommendation: Recommendation;
};

/** Niveau d'accord de l'ensemble (inverse de la dispersion). Union = discriminant (logique + select ICU). */
export type EnsembleAgreement = "fort" | "modéré" | "faible";

export type EnsembleSpread = {
  count: number;
  costMin: number;
  costMax: number;
  costRange: number;
  /** Amplitude de coût rapportée au minimum, en %. */
  costRangePct: number;
  scoreMin: number;
  scoreMax: number;
  scoreRange: number;
  /** Presets distincts couverts par l'ensemble (ordre LIGHT→MEDIUM→HARD). */
  presetsSpan: Preset[];
  agreement: EnsembleAgreement;
  /** Libellé d'incertitude (descripteur i18n : valeurs chiffrées + `select` sur `agreement`). */
  uncertaintyLabel: Message;
};

export type Ensemble = {
  /** Recommandation du profil tel quel (membre de référence). */
  baseline: Recommendation;
  variants: EnsembleVariant[];
  spread: EnsembleSpread;
};

/** Construit un jeu de niveaux de modules tout au maximum ou tout désactivé. */
function modulesAt(target: "max" | "off"): Record<ModuleId, number> {
  const levels = defaultModuleLevels();
  for (const mod of MODULES) {
    levels[mod.id] = target === "max" ? mod.maxLevel : 0;
  }
  return levels;
}

/** Descripteurs i18n des hypothèses par membre (résolus en présentation). Le compte par variant doit
 *  rester aligné avec les clés `Engine.ensemble.<id>.assumption.<n>` des catalogues fr/en. */
function assumptionsOf(id: EnsembleVariantId): Message[] {
  const counts: Record<EnsembleVariantId, number> = { sovereignty: 4, cost: 3, speed: 4 };
  return Array.from({ length: counts[id] }, (_unused, n) => msg(`ensemble.${id}.assumption.${n}`));
}

/** Applique les overrides d'un membre de l'ensemble au profil de base. */
function applyVariant(
  id: EnsembleVariantId,
  base: Profile,
): { profile: Profile; assumptions: Message[] } {
  const assumptions = assumptionsOf(id);
  switch (id) {
    case "sovereignty":
      return {
        profile: {
          ...base,
          zone: base.zone === "maroc" ? "maroc" : "ue",
          sensitivity: "secret",
          audit: true,
          bitemporal: true,
          modules: modulesAt("max"),
        },
        assumptions,
      };
    case "cost":
      return {
        profile: {
          ...base,
          budget: "lt50",
          audit: false,
          bitemporal: false,
          modules: modulesAt("off"),
        },
        assumptions,
      };
    case "speed":
      return {
        profile: {
          ...base,
          techLevel: "devops",
          audit: false,
          bitemporal: false,
          budget: "lt50",
          modules: modulesAt("off"),
        },
        assumptions,
      };
  }
}

function buildVariant(
  id: EnsembleVariantId,
  base: Profile,
  prices: MultimodalPriceTable,
  backupPrices: BackupPriceTable,
  computePrices: ComputePriceTable,
  residencyPrices: ResidencyPriceTable,
  llmPrices: LlmTokenPrices,
): EnsembleVariant {
  const { profile, assumptions } = applyVariant(id, base);
  return {
    id,
    label: msg(`ensemble.${id}.label`),
    intent: msg(`ensemble.${id}.intent`),
    assumptions,
    profile,
    recommendation: recommend(profile, prices, undefined, backupPrices, computePrices, residencyPrices, llmPrices),
  };
}

function computeSpread(recommendations: Recommendation[]): EnsembleSpread {
  const costs = recommendations.map((r) => r.totalCost);
  const scores = recommendations.map((r) => r.scoreAvg);

  const costMin = Math.min(...costs);
  const costMax = Math.max(...costs);
  const costRange = costMax - costMin;
  const costRangePct = costMin > 0 ? Math.round((costRange / costMin) * 100) : 0;

  const scoreMin = Math.min(...scores);
  const scoreMax = Math.max(...scores);
  const scoreRange = Math.round((scoreMax - scoreMin) * 10) / 10;

  const presetsSpan = PRESETS.filter((p) => recommendations.some((r) => r.preset === p));

  const agreement: EnsembleAgreement =
    costRangePct <= 30 && scoreRange <= 1
      ? "fort"
      : costRangePct >= 120 || scoreRange >= 2.5
        ? "faible"
        : "modéré";

  return {
    count: recommendations.length,
    costMin,
    costMax,
    costRange,
    costRangePct,
    scoreMin,
    scoreMax,
    scoreRange,
    presetsSpan,
    agreement,
    // Descripteur i18n : valeurs chiffrées (données) + `select` sur `agreement` pour la phrase de synthèse.
    uncertaintyLabel: msg("ensemble.uncertainty", {
      count: recommendations.length,
      costMin,
      costMax,
      costRange,
      costRangePct,
      scoreMin,
      scoreMax,
      agreement,
    }),
  };
}

/**
 * Construit l'ensemble multi-configuration : la recommandation de référence + un
 * membre par priorité (souveraineté / coût / délai), et la dispersion résultante
 * (le « spread » = l'incertitude). Fonction pure et déterministe.
 */
export function buildEnsemble(
  profile: Profile,
  prices: MultimodalPriceTable = NEUTRAL_MEDIA_PRICES,
  catalog?: Catalog,
  backupPrices: BackupPriceTable = NEUTRAL_BACKUP_PRICES,
  computePrices: ComputePriceTable = NEUTRAL_COMPUTE_PRICES,
  residencyPrices: ResidencyPriceTable = NEUTRAL_RESIDENCY_PRICES,
  llmPrices: LlmTokenPrices = NEUTRAL_LLM_PRICES,
): Ensemble {
  // Le catalogue (live ou seed) s'applique à la baseline ; les variants explorent sur leur propre
  // seed (le spread coût/score n'en dépend pas — les coûts sont indépendants du choix de composant).
  // Prix backup + compute + résidence + LLM threadés partout pour que le spread reflète tous les postes.
  const baseline = recommend(profile, prices, catalog, backupPrices, computePrices, residencyPrices, llmPrices);
  const variants = ENSEMBLE_VARIANT_IDS.map((id) =>
    buildVariant(id, profile, prices, backupPrices, computePrices, residencyPrices, llmPrices),
  );
  const spread = computeSpread([baseline, ...variants.map((v) => v.recommendation)]);
  return { baseline, variants, spread };
}
