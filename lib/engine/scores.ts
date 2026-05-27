import type { Preset, Profile, ScoreDimension } from "./types";

function hasMultimodal(p: Profile): boolean {
  return p.contentTypes.some((t) => t === "audio" || t === "video" || t === "images");
}

/**
 * Score les 8 dimensions (avant bonus modules). Fonction pure.
 * Porté du simulateur v2, règles déterministes calibrées sur les convergences cohorte.
 */
export function computeScores(preset: Preset, p: Profile, totalCost: number): ScoreDimension[] {
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

  // 4. Souveraineté
  let sov = preset === "LIGHT" ? 6 : preset === "MEDIUM" ? 8 : 10;
  if (p.zone === "ue" || p.zone === "maroc") sov = Math.min(10, sov + 1);

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
      label: "Stress-testabilité empirique (méthode Meydeey)",
      score: stress,
      why: "Dataset 7 axes × votre métier toujours applicable. Score plafonne à 9 par défaut, +1 si stack supporte les 4 adaptateurs RAG.",
    },
    {
      key: "sov",
      label: "Souveraineté & zéro vendor lock-in",
      score: sov,
      why: `Preset ${preset} ${p.zone === "ue" || p.zone === "maroc" ? "+ zone UE/Maroc" : ""}. Vault markdown source de vérité garantit la portabilité (V1+).`,
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
  ];
}
