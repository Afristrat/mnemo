import type { Catalog } from "@/lib/catalog/types";
import { buildBackupPlan, NEUTRAL_BACKUP_PRICES, type BackupPriceTable } from "./backup";
import { computeSovereignCompute, NEUTRAL_COMPUTE_PRICES, type ComputePriceTable } from "./compute";
import { deriveResidencyPlan, hostingClassForProfile, NEUTRAL_RESIDENCY_PRICES, type ResidencyPriceTable } from "./residency";
import { applyBackup, applyCompute, applyMultimodalSizing, applyResidency, costBand, layersBaseCost, profileCostFactors } from "./cost";
import { computeCompliance, computeKMChecks, computeRisks } from "./diagnostics";
import { buildLayers } from "./layers";
import { msg, type Message } from "./message";
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
import { deriveSizingParams } from "./sizing-params";
import {
  SCORE_KEYS,
  type ActiveModule,
  type Activity,
  type CostSource,
  type Profile,
  type Recommendation,
  type Verdict,
} from "./types";

/** Dédoublonne des sources par URL (préserve l'ordre d'apparition). */
function dedupeSources(sources: CostSource[]): CostSource[] {
  const seen = new Set<string>();
  const out: CostSource[] = [];
  for (const s of sources) {
    if (!seen.has(s.url)) {
      seen.add(s.url);
      out.push(s);
    }
  }
  return out;
}

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
      baseTask: mod.baseTask,
      fraction,
      cost: Math.round(mod.costFull * fraction),
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

function buildVerdict(profile: Profile, totalCost: number, setupCost: number, risks: Message[]): Verdict {
  return {
    pain: PAIN_BY_ACTIVITY[profile.activity] ?? PAIN_DEFAULT,
    // Risque saillant = 1er risque détecté (descripteur i18n), sinon risque générique de souveraineté.
    risk: risks[0] ?? msg("verdict.defaultRisk"),
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
  backupPrices: BackupPriceTable = NEUTRAL_BACKUP_PRICES,
  computePrices: ComputePriceTable = NEUTRAL_COMPUTE_PRICES,
  residencyPrices: ResidencyPriceTable = NEUTRAL_RESIDENCY_PRICES,
): Recommendation {
  const { preset, reason } = decidePreset(profile);
  // Paramètres de dimensionnement « vivants » (S-056) : un composant sourcé du catalogue (C6 GPU,
  // C5 stockage) peut moduler les heuristiques baseline (garde-fou de bornes, sinon repli baseline).
  const derivedParams = deriveSizingParams(catalog);
  const sizing = costMultimodalSizing(profile, prices, derivedParams.params);
  // Plan de sauvegarde déduit du profil (criticité none → plan neutre, coûts 0 → invariant préservé).
  const backup = buildBackupPlan(profile, sizing, prices.storagePerGbMonth, backupPrices);
  // Serveurs souverains dimensionnés (remplacent le forfait C6 si prix injectés ; sinon neutre → forfait).
  const compute = computeSovereignCompute(profile, preset, computePrices);
  // Plan résidence/DR (spec n°2) : none + mono-région (ou prix neutres) → plan neutre, coûts 0 (invariant).
  // hostingClass dérivée de la zone (S-048) → sélectionne le vecteur d'egress sourcé correspondant.
  const residency = deriveResidencyPlan(
    profile,
    residencyPrices,
    computePrices,
    preset,
    hostingClassForProfile(profile),
  );

  // Choix des composants = `catalog` injecté (défaut seed = sortie identique, spec n°3). Coûts dans les
  // couches : compute remplace le forfait C6, puis GPU/stockage multimédias (C4/C5/C6), puis backup (C6),
  // puis résidence/DR (réplication + régions en attente, C6).
  const layers = applyResidency(
    applyBackup(
      applyMultimodalSizing(applyCompute(buildLayers(preset, profile, catalog), compute), sizing, prices),
      backup,
    ),
    residency,
  );
  const baseCost = layersBaseCost(layers) + profileCostFactors(profile);
  const activeModules = computeActiveModules(profile);
  const moduleCost = activeModules.reduce((sum, m) => sum + m.cost, 0);
  const totalCost = baseCost + moduleCost;

  // Le plan backup alimente `resilience` (S-027) ; le plan résidence alimente `geosov` + étend
  // `resilience` au DR régional (S-045), de façon cohérente avec les coûts injectés.
  const scores = computeScores(preset, profile, totalCost, backup, residency);

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
        // `modName` ne peut plus être passé en valeur ICU (mod.name est désormais un descripteur
        // Message, pas une chaîne) : on transmet `modId` et le catalogue résout le nom via un
        // `select` ICU (parité avec `Engine.modules.<id>.name` garantie par un test anti-drift).
        (dim.bonuses ??= []).push(
          msg("scores.moduleBonus", {
            modId: mod.id,
            level: mod.level,
            maxLevel: mod.maxLevel,
            bonus: bonusAmount.toFixed(1),
          }),
        );
      }
    }
  }
  for (const dim of scores) dim.score = Math.round(dim.score);
  const scoreAvg = Number((scores.reduce((sum, x) => sum + x.score, 0) / scores.length).toFixed(1));

  // Mise en route = backlog multimédia + premier full de sauvegarde + amorçage des réplicas (one-time).
  const setupCost = computeSetupCost(profile, prices) + Math.round(backup.setupCost) + Math.round(residency.setupCost);
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
    costSources: dedupeSources([
      ...mediaCostSources(profile, sizing, prices),
      ...backup.costSources,
      ...compute.sources,
      ...residency.costSources,
      // Sources des facteurs de dimensionnement sourcés effectivement appliqués (S-056, traçabilité).
      ...derivedParams.applied.map((a) => a.source),
    ]),
    backup,
    compute,
    residency,
    verdict: buildVerdict(profile, totalCost, setupCost, risks),
  };
}
