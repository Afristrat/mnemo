import type { Catalog } from "@/lib/catalog/types";
import { buildBackupPlan, NEUTRAL_BACKUP_PRICES, type BackupPriceTable } from "./backup";
import { computeSovereignCompute, NEUTRAL_COMPUTE_PRICES, type ComputePriceTable } from "./compute";
import { deriveResidencyPlan, hostingClassForProfile, NEUTRAL_RESIDENCY_PRICES, type ResidencyPriceTable } from "./residency";
import { applyBackup, applyCompute, applyLlmUsage, applyMultimodalSizing, applyResidency, costBand, layersBaseCost, profileCostFactors } from "./cost";
import { costLlmUsage, NEUTRAL_LLM_PRICES, type LlmTokenPrices } from "./llm-usage";
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

// i18n (S-058, reliquat moteur chantier b) : le verdict ne porte plus de prose. Chaque champ
// user-facing est un descripteur `Message` résolu en fr/en par la présentation (ResultsView →
// DisplayVerdict). `pain` = `select` ICU sur l'activité (`other` couvre le défaut) ; `firmPriceTier`
// reste le [PLACEHOLDER] tant que le sondage Van Westendorp n'a pas de réponses (spec §11).
function buildVerdict(profile: Profile, totalCost: number, setupCost: number, risks: Message[]): Verdict {
  return {
    // ICU n'autorise pas le tiret dans une clé de `select` → on normalise (`cabinet-regule` → `cabinet_regule`) ;
    // la branche `other` couvre l'activité « other » ET toute activité non listée (= ancien PAIN_DEFAULT).
    pain: msg("verdict.pain", { activity: profile.activity.replace(/-/g, "_") }),
    // Risque saillant = 1er risque détecté (descripteur i18n), sinon risque générique de souveraineté.
    risk: risks[0] ?? msg("verdict.defaultRisk"),
    // « Prouvé » uniquement pour « −risques » (Exit Escrow + Fiduciary livrés) ; jamais de stat inventée (spec §11).
    gain: msg("verdict.gain"),
    firmPriceTier: msg("verdict.firmPriceTier"),
    variableCostBand: costBand(totalCost),
    setupCostBand: costBand(setupCost),
    nextStep: setupCost > 0 ? msg("verdict.nextStep.withSetup") : msg("verdict.nextStep.default"),
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
  llmPrices: LlmTokenPrices = NEUTRAL_LLM_PRICES,
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
  // Coût d'inférence LLM à l'usage (S-074) : auto-hébergé (HARD/préférence souveraine) → 0 (déjà dans
  // le compute), sinon tokens × prix/1M du modèle API par défaut. Neutre par défaut → 0 (invariant).
  const llmUsage = costLlmUsage(profile, preset, llmPrices);
  const layers = applyLlmUsage(
    applyResidency(
      applyBackup(
        applyMultimodalSizing(applyCompute(buildLayers(preset, profile, catalog), compute), sizing, prices),
        backup,
      ),
      residency,
    ),
    llmUsage,
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
      // Source du prix LLM à l'usage effectivement appliqué (S-074, DÉFCON 1) — null si auto-hébergé/neutre.
      ...(llmUsage.source !== null ? [llmUsage.source] : []),
      // Sources des facteurs de dimensionnement sourcés effectivement appliqués (S-056, traçabilité).
      ...derivedParams.applied.map((a) => a.source),
    ]),
    backup,
    compute,
    residency,
    llmUsage,
    verdict: buildVerdict(profile, totalCost, setupCost, risks),
  };
}
