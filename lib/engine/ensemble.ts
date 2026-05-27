// Ensemble multi-configuration (F5).
// Analogie : prévision météo d'ensemble, on ne lance pas un seul modèle, mais
// plusieurs, et la DISPERSION de leurs sorties (le « spread ») mesure l'incertitude.
// Ici chaque « membre » de l'ensemble est le profil utilisateur biaisé vers une
// priorité différente (souveraineté / coût / délai). On passe chaque membre dans
// le moteur déterministe `recommend()` et on quantifie l'écart résultant.

import { MODULES, defaultModuleLevels } from "./modules";
import { recommend } from "./recommend";
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

export type EnsembleVariant = {
  id: EnsembleVariantId;
  label: string;
  /** Objectif poursuivi par ce membre de l'ensemble. */
  intent: string;
  /** Hypothèses appliquées au profil, en clair (transparence des overrides). */
  assumptions: string[];
  profile: Profile;
  recommendation: Recommendation;
};

/** Niveau d'accord de l'ensemble (inverse de la dispersion). */
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
  /** Libellé d'incertitude explicite, prêt à afficher. */
  uncertaintyLabel: string;
};

export type Ensemble = {
  /** Recommandation du profil tel quel (membre de référence). */
  baseline: Recommendation;
  variants: EnsembleVariant[];
  spread: EnsembleSpread;
};

const VARIANT_META: Record<EnsembleVariantId, { label: string; intent: string }> = {
  sovereignty: {
    label: "Souveraineté maximale",
    intent: "Verrouille la souveraineté et la gouvernance au maximum ; coût et délai passent au second plan.",
  },
  cost: {
    label: "Coût minimal",
    intent: "Comprime le coût mensuel : budget serré, options de gouvernance et modules désactivés.",
  },
  speed: {
    label: "Time-to-V1 minimal",
    intent: "Démarre le plus vite possible : stack légère, compétences DevOps, zéro module bloquant.",
  },
};

/** Construit un jeu de niveaux de modules tout au maximum ou tout désactivé. */
function modulesAt(target: "max" | "off"): Record<ModuleId, number> {
  const levels = defaultModuleLevels();
  for (const mod of MODULES) {
    levels[mod.id] = target === "max" ? mod.maxLevel : 0;
  }
  return levels;
}

/** Applique les overrides d'un membre de l'ensemble au profil de base. */
function applyVariant(
  id: EnsembleVariantId,
  base: Profile,
): { profile: Profile; assumptions: string[] } {
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
        assumptions: [
          "Hébergement en zone UE / Maroc",
          "Sensibilité traitée comme « secret »",
          "Audit et bitemporel rendus obligatoires",
          "Modules de gouvernance poussés au maximum",
        ],
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
        assumptions: [
          "Budget plafonné sous 50 €/mois",
          "Audit et bitemporel désactivés",
          "Modules avancés désactivés",
        ],
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
        assumptions: [
          "Compétences DevOps disponibles",
          "Audit et bitemporel désactivés",
          "Budget plafonné sous 50 €/mois",
          "Modules avancés désactivés",
        ],
      };
  }
}

function buildVariant(id: EnsembleVariantId, base: Profile, prices: MultimodalPriceTable): EnsembleVariant {
  const meta = VARIANT_META[id];
  const { profile, assumptions } = applyVariant(id, base);
  return {
    id,
    label: meta.label,
    intent: meta.intent,
    assumptions,
    profile,
    recommendation: recommend(profile, prices),
  };
}

function describeUncertainty(
  count: number,
  costMin: number,
  costMax: number,
  costRange: number,
  costRangePct: number,
  scoreMin: number,
  scoreMax: number,
  agreement: EnsembleAgreement,
): string {
  const head =
    `Les ${count} configurations s'étalent de ${costMin} à ${costMax} €/mois ` +
    `(écart ${costRange} €, soit ${costRangePct} %) et de ${scoreMin} à ${scoreMax}/10 de score global. ` +
    `Accord de l'ensemble : ${agreement}. `;
  const tail =
    agreement === "fort"
      ? "Les membres convergent : la recommandation est robuste et peu sensible aux arbitrages."
      : agreement === "modéré"
        ? "Un arbitrage souveraineté / coût / délai reste à trancher selon votre priorité."
        : "Forte divergence : la décision dépend fortement de la priorité retenue, tranchez explicitement souveraineté vs coût vs délai.";
  return head + tail;
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
    uncertaintyLabel: describeUncertainty(
      recommendations.length,
      costMin,
      costMax,
      costRange,
      costRangePct,
      scoreMin,
      scoreMax,
      agreement,
    ),
  };
}

/**
 * Construit l'ensemble multi-configuration : la recommandation de référence + un
 * membre par priorité (souveraineté / coût / délai), et la dispersion résultante
 * (le « spread » = l'incertitude). Fonction pure et déterministe.
 */
export function buildEnsemble(profile: Profile, prices: MultimodalPriceTable = NEUTRAL_MEDIA_PRICES): Ensemble {
  const baseline = recommend(profile, prices);
  const variants = ENSEMBLE_VARIANT_IDS.map((id) => buildVariant(id, profile, prices));
  const spread = computeSpread([baseline, ...variants.map((v) => v.recommendation)]);
  return { baseline, variants, spread };
}
