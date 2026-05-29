import { type BackupCore, deriveBackupPlan } from "./backup";
import { deriveResidencyPlan } from "./residency";
import type { BackupCriticality, Preset, Profile, ResidencyPlan, ScoreDimension } from "./types";

function hasMultimodal(p: Profile): boolean {
  return p.contentTypes.some((t) => t === "audio" || t === "video" || t === "images");
}

const CRITICALITY_LABEL: Record<BackupCriticality, string> = {
  none: "aucune",
  standard: "standard",
  high: "élevée",
  critical: "critique",
};

const RESILIENCE_BASE: Record<BackupCriticality, number> = { none: 1, standard: 5, high: 7, critical: 8 };

/**
 * 9ᵉ dimension `resilience` (spec n°1 §8). Pure, dérivée du `BackupCore` (criticité + 3-2-1-1-0 +
 * restauration testée + immutabilité + érasure conforme), avec **pénalité** si RPO/RTO sont incohérents
 * avec la criticité déclarée (override expert trop laxiste). Synergie « Plan de panne » = pendant
 * opérationnel (non scoré ici, le module reste indépendant). Échelle 0-10.
 */
function resilienceScore(core: BackupCore): { score: number; why: string } {
  if (core.criticality === "none") {
    return {
      score: RESILIENCE_BASE.none,
      why: "Aucune sauvegarde modélisée — risque de perte de données et de non-conformité. Définissez une criticité dans le Bloc ② Infra.",
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
  const parts = [`${core.copies} copie${core.copies > 1 ? "s" : ""}`];
  if (core.offsite) parts.push("hors-site");
  if (core.airgap) parts.push("air-gap");
  if (core.immutable) parts.push("immuable (WORM)");
  const why = `Criticité « ${CRITICALITY_LABEL[core.criticality]} » : ${parts.join(", ")}. Restauration ${
    core.restoreTestsPerYear > 0 ? `testée ${core.restoreTestsPerYear}×/an` : "non testée"
  }${core.erasurePolicy === "crypto-shred" ? ", érasure crypto-shred" : ""}.${
    incoherent ? " ⚠️ RPO/RTO incohérents avec la criticité déclarée." : ""
  }`;
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
  const resilienceWhy =
    drBonus > 0
      ? `${resilienceBase.why} + DR régional ${residencyPlan.activeActive ? "actif-actif" : residencyPlan.drTier} (RTO ${residencyPlan.rtoMinutes} min).`
      : resilienceBase.why;

  return [
    {
      key: "conf",
      label: "Conformité juridique (RGPD/CNDP/AI Act)",
      score: conf,
      why: `Couvre les ${regCount} régimes cochés. ${preset === "LIGHT" && p.audit ? "⚠️ Audit obligatoire mal couvert en LIGHT." : ""}`.trim(),
    },
    {
      key: "audit",
      label: "Auditabilité bitemporelle (qui savait quoi quand)",
      score: audit,
      why: `Choix bitemporel : ${p.bitemporal ? "Oui" : "Non"}. ${preset === "LIGHT" && p.bitemporal ? "Incompatible, passer en MEDIUM." : "OK"}`,
    },
    {
      key: "stress",
      label: "Stress-testabilité empirique",
      score: stress,
      why: "Dataset 7 axes × votre métier toujours applicable. Score plafonne à 9 par défaut, +1 si stack supporte les 4 adaptateurs RAG.",
    },
    {
      key: "sov",
      label: "Souveraineté & zéro vendor lock-in (portabilité)",
      score: sov,
      why: `Preset ${preset}. Vault markdown + bundle Exit Escrow = portabilité, zéro lock-in (la résidence géographique est notée séparément).`,
    },
    {
      key: "adapt",
      label: "Adaptativité multi-métier / multi-perspective",
      score: adapt,
      why: `${p.contentTypes.length} type${p.contentTypes.length > 1 ? "s" : ""} de contenu, ${p.voices === "solo" ? "solo" : p.voices === "multi" ? "multi (2-5)" : "many (>5) voices"}. Plus c'est varié, plus la combinatoire 12 vecteurs (V1+) paie.`,
    },
    {
      key: "ttv",
      label: "Time-to-V1 (mise en route)",
      score: ttv,
      why: `Compétences ${p.techLevel}. Preset ${preset}. ${preset === "LIGHT" ? "Démarrable en 1 jour." : preset === "MEDIUM" ? "Démarrable en 1 semaine." : "Démarrable en 1 mois (POC)."}`,
    },
    {
      key: "mm",
      label: "Multimodalité native (texte + audio + image)",
      score: mm,
      why: wantsMultimodal
        ? `${multimodalTypes.join(" / ")} détectés. ${preset !== "LIGHT" ? "Embeddings multimodaux unifiés." : "API multimodale, OK pour démarrer."}`
        : "Texte uniquement. Score moyen par défaut.",
    },
    {
      key: "cost",
      label: "Coût opérationnel mensuel",
      score: cost,
      why: `≈ ${totalCost} €/mois. ${cost >= 8 ? "Très soutenable." : cost >= 6 ? "Soutenable, surveiller la croissance." : "Investissement notable, vérifier ROI."}`,
    },
    {
      key: "resilience",
      label: "Résilience & continuité (sauvegarde + DR régional)",
      score: resilienceScoreFinal,
      why: resilienceWhy,
    },
    {
      key: "geosov",
      label: "Souveraineté géographique (résidence & transferts conformes)",
      score: residencyPlan.geoSovScore,
      why: `Données en « ${residencyPlan.primaryRegion} ». ${
        residencyPlan.transfers.length === 0
          ? "Aucun transfert inter-juridiction."
          : `${residencyPlan.transfers.length} flux inter-région (voir conformité des transferts).`
      }${residencyPlan.conflict.hasConflict ? " ⚠️ Conflit résidence × DR à arbitrer." : ""}`,
    },
  ];
}
