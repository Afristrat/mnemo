import type { Catalog } from "@/lib/catalog/types";
import { applyMultimodalSizing, costBand, layersBaseCost, profileCostFactors } from "./cost";
import { computeCompliance, computeKMChecks, computeRisks } from "./diagnostics";
import { buildLayers } from "./layers";
import { MODULES } from "./modules";
import { decidePreset } from "./preset";
import { computeScores } from "./scores";
import {
  computeSetupCost,
  costMultimodalSizing,
  mediaCostSources,
  NEUTRAL_MEDIA_PRICES,
  type MultimodalPriceTable,
} from "./sizing";
import {
  SCORE_KEYS,
  type ActiveModule,
  type Activity,
  type Profile,
  type Recommendation,
  type Verdict,
} from "./types";

function computeActiveModules(profile: Profile): ActiveModule[] {
  const active: ActiveModule[] = [];
  for (const mod of MODULES) {
    const rawLevel = profile.modules[mod.id] ?? 0;
    if (rawLevel <= 0) continue;
    const level = Math.min(Math.max(Math.round(rawLevel), 0), mod.maxLevel);
    const fraction = level / mod.maxLevel;
    const levelMeta = mod.levels[level];
    active.push({
      id: mod.id,
      name: mod.name,
      level,
      maxLevel: mod.maxLevel,
      levelLabel: levelMeta.label,
      levelDesc: levelMeta.desc,
      fraction,
      cost: Math.round(mod.costFull * fraction),
      task: `[Niveau ${level}/${mod.maxLevel}, ${levelMeta.label}] ${mod.baseTask} Spécificité du niveau : ${levelMeta.desc}`,
      bonusFull: mod.bonusFull,
    });
  }
  return active;
}

// Prix de vente du service Strate : volontairement non figé tant que le sondage Van Westendorp
// n'a pas de réponses (spec §11). Emplacement d'injection centralisé.
const FIRM_PRICE_TIER_PLACEHOLDER = "[PLACEHOLDER], prix de vente du service Strate (sondage en cours)";

const PAIN_BY_ACTIVITY: Partial<Record<Activity, string>> = {
  "cabinet-regule":
    "Reconstituer « qui a décidé quoi, et quand » coûte cher et vous expose en cas de contrôle ; vos dossiers sensibles transitent par des mémoires que vous ne maîtrisez pas.",
  "pme-startup":
    "Le savoir de l'équipe se disperse (conversations, docs, têtes) ; chaque départ ou pivot fait perdre le contexte des décisions.",
  recherche:
    "Vos corpus et l'historique de vos hypothèses sont éclatés ; impossible de rejouer « ce que l'on savait » à une date donnée.",
  agence:
    "Le contexte client se reconstruit à chaque mission ; la mémoire des comptes vit dans des outils tiers non souverains.",
  freelance:
    "Votre mémoire de travail dépend d'outils propriétaires ; vous ne pouvez ni l'auditer ni l'emporter.",
  particulier:
    "Vos notes et souvenirs sont dispersés et dépendants d'un éditeur ; aucune garantie de portabilité.",
};

const PAIN_DEFAULT =
  "Votre mémoire d'organisation est dispersée et dépend d'outils que vous ne maîtrisez pas (souveraineté, portabilité, auditabilité).";

function buildVerdict(profile: Profile, totalCost: number, setupCost: number, risks: string[]): Verdict {
  return {
    pain: PAIN_BY_ACTIVITY[profile.activity] ?? PAIN_DEFAULT,
    risk:
      risks[0] ??
      "Sans base mémorielle souveraine : dépendance aux mémoires propriétaires (ChatGPT/Claude) et risque de verrouillage.",
    // « Prouvé » uniquement pour « −risques » (Exit Escrow + Fiduciary livrés) ; jamais de stat inventée (spec §11).
    gain:
      "« −Risques » prouvé : Exit Escrow (bundle reproductible, zéro verrouillage) + charte fiduciaire (zéro commission cachée). Gains de productivité : à mesurer sur votre propre corpus, jamais affirmés à l'aveugle.",
    firmPriceTier: FIRM_PRICE_TIER_PLACEHOLDER,
    variableCostBand: costBand(totalCost),
    setupCostBand: costBand(setupCost),
    nextStep:
      setupCost > 0
        ? "Validez les volumes médias (mémoriser + créer + backlog) et demandez un devis ferme avant le go."
        : "Affinez le profil dans le configurateur, puis demandez un devis ferme avant le go.",
  };
}

/**
 * Moteur principal : profil → recommandation complète (preset, stack, coûts, scores, diagnostics,
 * dimensionnement multimédia, setup, verdict). Fonction pure et déterministe.
 *
 * `prices` (table de prix médias **normalisée en €**) est INJECTÉE pour préserver la pureté du
 * moteur (zéro import `lib/pricing`). Défaut = `NEUTRAL_MEDIA_PRICES` (coûts multimédias nuls) ;
 * les appelants réels injectent `getMediaPricesEur()` pour un chiffrage effectif des couches.
 */
export function recommend(
  profile: Profile,
  prices: MultimodalPriceTable = NEUTRAL_MEDIA_PRICES,
  catalog?: Catalog,
): Recommendation {
  const { preset, reason } = decidePreset(profile);
  const sizing = costMultimodalSizing(profile, prices);

  // Les choix de composants viennent du `catalog` injecté (défaut seed = sortie identique, spec n°3) ;
  // les coûts multimédias sont injectés DANS les couches C4/C5/C6 (jamais en ligne séparée).
  const layers = applyMultimodalSizing(buildLayers(preset, profile, catalog), sizing, prices);
  const baseCost = layersBaseCost(layers) + profileCostFactors(profile);
  const activeModules = computeActiveModules(profile);
  const moduleCost = activeModules.reduce((sum, m) => sum + m.cost, 0);
  const totalCost = baseCost + moduleCost;

  const scores = computeScores(preset, profile, totalCost);

  // Bonus modules, proportionnels au niveau d'intensité choisi.
  for (const mod of activeModules) {
    for (const key of SCORE_KEYS) {
      const fullBonus = mod.bonusFull[key];
      if (fullBonus === undefined) continue;
      const dim = scores.find((s) => s.key === key);
      if (dim === undefined) continue;
      const bonusAmount = fullBonus * mod.fraction;
      const previous = dim.score;
      dim.score = Math.min(10, Math.round((dim.score + bonusAmount) * 10) / 10);
      if (dim.score > previous || bonusAmount >= 0.3) {
        dim.why += ` · « ${mod.name} » niv. ${mod.level}/${mod.maxLevel} (+${bonusAmount.toFixed(1)})`;
      }
    }
  }
  for (const dim of scores) dim.score = Math.round(dim.score);
  const scoreAvg = Number((scores.reduce((sum, x) => sum + x.score, 0) / scores.length).toFixed(1));

  const setupCost = computeSetupCost(profile, prices);
  const risks = computeRisks(preset, profile, totalCost);

  return {
    preset,
    presetReason: reason,
    layers,
    baseCost,
    moduleCost,
    totalCost,
    scores,
    scoreAvg,
    activeModules,
    compliance: computeCompliance(profile),
    risks,
    kmChecks: computeKMChecks(preset, profile),
    sizing,
    setupCost,
    costSources: mediaCostSources(profile, sizing, prices),
    verdict: buildVerdict(profile, totalCost, setupCost, risks),
  };
}
