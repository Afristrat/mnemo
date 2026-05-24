import { layersBaseCost, profileCostFactors } from "./cost";
import { computeCompliance, computeKMChecks, computeRisks } from "./diagnostics";
import { buildLayers } from "./layers";
import { MODULES } from "./modules";
import { decidePreset } from "./preset";
import { computeScores } from "./scores";
import { SCORE_KEYS, type ActiveModule, type Profile, type Recommendation } from "./types";

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
      task: `[Niveau ${level}/${mod.maxLevel} — ${levelMeta.label}] ${mod.baseTask} Spécificité du niveau : ${levelMeta.desc}`,
      bonusFull: mod.bonusFull,
    });
  }
  return active;
}

/**
 * Moteur principal : profil → recommandation complète (preset, stack, coût, scores, diagnostics).
 * Fonction pure et déterministe.
 */
export function recommend(profile: Profile): Recommendation {
  const { preset, reason } = decidePreset(profile);
  const layers = buildLayers(preset, profile);
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
    risks: computeRisks(preset, profile, totalCost),
    kmChecks: computeKMChecks(preset, profile),
  };
}
