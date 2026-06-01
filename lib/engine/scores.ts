import { type BackupCore, deriveBackupPlan } from "./backup";
import { msg, type Message } from "./message";
import { deriveResidencyPlan } from "./residency";
import type { BackupCriticality, Preset, Profile, ResidencyPlan, ScoreDimension } from "./types";

function hasMultimodal(p: Profile): boolean {
  return p.contentTypes.some((t) => t === "audio" || t === "video" || t === "images");
}

const RESILIENCE_BASE: Record<BackupCriticality, number> = { none: 1, standard: 5, high: 7, critical: 8 };

/**
 * 9ᵉ dimension `resilience` (spec n°1 §8). Pure, dérivée du `BackupCore` (criticité + 3-2-1-1-0 +
 * restauration testée + immutabilité + érasure conforme), avec **pénalité** si RPO/RTO sont incohérents
 * avec la criticité déclarée (override expert trop laxiste). Synergie « Plan de panne » = pendant
 * opérationnel (non scoré ici, le module reste indépendant). Échelle 0-10.
 * i18n (S-058) : renvoie un descripteur `Message` (ICU), pas de prose ; le suffixe DR est fusionné
 * dans les `values` par `computeScores` (clé `dr`). Discriminants `select` = chaînes "yes"/"no"/énum.
 */
function resilienceScore(core: BackupCore): { score: number; why: Message } {
  if (core.criticality === "none") {
    return {
      score: RESILIENCE_BASE.none,
      why: msg("scores.resilience.whyNone", { dr: "no" }),
    };
  }

  let s = RESILIENCE_BASE[core.criticality];
  if (core.threeTwoOne.copies >= 3) s += 0.5;
  if (core.offsite) s += 0.5;
  if (core.airgap) s += 0.5;
  if (core.immutable) s += 0.5;
  if (core.restoreTestsPerYear > 0) s += 1;
  if (core.erasurePolicy === "crypto-shred") s += 0.5;

  // Pénalité : RPO/RTO relâchés au-delà de ce qu'implique la criticité affichée (incohérence expert).
  const incoherent =
    (core.criticality === "critical" && (core.rpoMinutes > 60 || core.rtoMinutes > 120)) ||
    (core.criticality === "high" && (core.rpoMinutes > 240 || core.rtoMinutes > 480));
  if (incoherent) s -= 2;

  const score = Math.max(0, Math.min(10, s));
  const why = msg("scores.resilience.whyActive", {
    crit: core.criticality,
    copies: core.copies,
    offsite: core.offsite ? "yes" : "no",
    airgap: core.airgap ? "yes" : "no",
    immutable: core.immutable ? "yes" : "no",
    tested: core.restoreTestsPerYear > 0 ? "yes" : "no",
    restoreTests: core.restoreTestsPerYear,
    cryptoShred: core.erasurePolicy === "crypto-shred" ? "yes" : "no",
    incoherent: incoherent ? "yes" : "no",
    dr: "no",
  });
  return { score, why };
}

/**
 * Score les 10 dimensions (avant bonus modules). Fonction pure.
 * Porté du simulateur v2, règles déterministes ; 9ᵉ `resilience` (S-027) ; 10ᵉ `geosov` (S-045).
 * `backupCore` et `residencyPlan` sont INJECTÉS (défauts = dérivés du profil) — recommend passe les
 * plans déjà calculés (S-028 backup, S-046 residency). `geosov` = `residencyPlan.geoSovScore` ;
 * `resilience` intègre le DR régional ; `sov` est recadrée (le géographique est dans `geosov`).
 */
export function computeScores(
  preset: Preset,
  p: Profile,
  totalCost: number,
  backupCore: BackupCore = deriveBackupPlan(p),
  residencyPlan: ResidencyPlan = deriveResidencyPlan(p),
): ScoreDimension[] {
  const wantsMultimodal = hasMultimodal(p);

  // 1. Conformité
  let conf = 6;
  if (p.regulations.includes("rgpd")) conf += 1;
  if (p.regulations.includes("lgpd")) conf += 1; // régime data-protection structurant (S-077, T5)
  if (p.regulations.includes("appi")) conf += 1; // régime data-protection structurant (S-077, T5)
  if (p.regulations.includes("aiact")) conf += 1;
  if (preset === "HARD") conf = 10;
  else if (preset === "MEDIUM") conf = Math.min(9, conf + 1);
  if (p.audit && preset === "LIGHT") conf = Math.max(3, conf - 3);

  // 2. Auditabilité bitemporelle (binaire Oui/Non depuis S-015)
  let audit = 5;
  if (p.bitemporal && preset !== "LIGHT") audit = 10;

  // 3. Stress-testabilité
  const stress = preset === "LIGHT" ? 7 : 9;

  // 4. Souveraineté (recadrée S-045 : zéro vendor lock-in & portabilité ; le géographique → `geosov`)
  const sov = preset === "LIGHT" ? 6 : preset === "MEDIUM" ? 8 : 10;

  // 5. Adaptativité multi-métier
  const voiceBonus = p.voices === "many" ? 2 : p.voices === "multi" ? 1 : 0;
  const adapt = Math.min(10, 5 + (p.contentTypes.length >= 3 ? 2 : 0) + voiceBonus);

  // 6. Time-to-V1
  let ttv = preset === "LIGHT" ? 9 : preset === "MEDIUM" ? 7 : 4;
  if (p.techLevel === "none" && preset !== "LIGHT") ttv = Math.max(2, ttv - 3);
  else if (p.techLevel === "devops") ttv = Math.min(10, ttv + 1);

  // 7. Multimodalité
  const mm = wantsMultimodal ? (preset === "LIGHT" ? 6 : 9) : 5;

  // 8. Coût (inverse)
  let cost = 10;
  if (totalCost > 100) cost = 8;
  if (totalCost > 300) cost = 6;
  if (totalCost > 800) cost = 4;
  if (totalCost > 2000) cost = 2;

  const regCount = p.regulations.filter((r) => r !== "none").length;
  const multimodalTypes = p.contentTypes.filter((t) => t === "audio" || t === "video" || t === "images");

  // 9. Résilience : sauvegarde (spec n°1) + DR régional (spec n°2, S-045). Bonus warm/hot/actif-actif.
  const resilienceBase = resilienceScore(backupCore);
  const drBonus = residencyPlan.activeActive ? 1.5 : residencyPlan.drTier === "hot" ? 1 : residencyPlan.drTier === "warm" ? 0.5 : 0;
  const resilienceScoreFinal = Math.max(0, Math.min(10, resilienceBase.score + drBonus));
  const resilienceWhy: Message =
    drBonus > 0
      ? {
          id: resilienceBase.why.id,
          values: {
            ...resilienceBase.why.values,
            dr: "yes",
            drKind: residencyPlan.activeActive ? "active" : residencyPlan.drTier,
            rto: residencyPlan.rtoMinutes,
          },
        }
      : resilienceBase.why;

  return [
    {
      key: "conf",
      label: msg("scores.conf.label"),
      score: conf,
      why: msg("scores.conf.why", { regCount, auditWarn: preset === "LIGHT" && p.audit ? "yes" : "no" }),
    },
    {
      key: "audit",
      label: msg("scores.audit.label"),
      score: audit,
      why: msg("scores.audit.why", {
        bitemporal: p.bitemporal ? "yes" : "no",
        incompat: preset === "LIGHT" && p.bitemporal ? "yes" : "no",
      }),
    },
    {
      key: "stress",
      label: msg("scores.stress.label"),
      score: stress,
      why: msg("scores.stress.why"),
    },
    {
      key: "sov",
      label: msg("scores.sov.label"),
      score: sov,
      why: msg("scores.sov.why", { preset }),
    },
    {
      key: "adapt",
      label: msg("scores.adapt.label"),
      score: adapt,
      why: msg("scores.adapt.why", { count: p.contentTypes.length, voices: p.voices }),
    },
    {
      key: "ttv",
      label: msg("scores.ttv.label"),
      score: ttv,
      why: msg("scores.ttv.why", { techLevel: p.techLevel, preset }),
    },
    {
      key: "mm",
      label: msg("scores.mm.label"),
      score: mm,
      why: msg("scores.mm.why", {
        wants: wantsMultimodal ? "yes" : "no",
        types: multimodalTypes.join(" / "),
        preset,
      }),
    },
    {
      key: "cost",
      label: msg("scores.cost.label"),
      score: cost,
      why: msg("scores.cost.why", {
        totalCost,
        band: cost >= 8 ? "sustainable" : cost >= 6 ? "watch" : "notable",
      }),
    },
    {
      key: "resilience",
      label: msg("scores.resilience.label"),
      score: resilienceScoreFinal,
      why: resilienceWhy,
    },
    {
      key: "geosov",
      label: msg("scores.geosov.label"),
      score: residencyPlan.geoSovScore,
      why: msg("scores.geosov.why", {
        region: residencyPlan.primaryRegion,
        transferCount: residencyPlan.transfers.length,
        conflict: residencyPlan.conflict.hasConflict ? "yes" : "no",
      }),
    },
  ];
}
