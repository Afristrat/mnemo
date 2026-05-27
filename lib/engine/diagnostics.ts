import type { KMCheck, Preset, Profile } from "./types";

/** Actions de conformité déclenchées par les régimes cochés. Fonction pure. */
export function computeCompliance(p: Profile): string[] {
  const actions: string[] = [];
  if (p.regulations.includes("rgpd")) {
    actions.push("📄 Rédiger une AIPD (Analyse d'Impact Protection Données)");
    actions.push("📋 Cartographier les sous-processors (LLM API, hébergeur, vector DB) et signer un DPA RGPD Art. 28 avec chacun");
    actions.push("🔁 Implémenter la procédure droit à l'oubli scriptée (re-embedding)");
    actions.push("📚 Tenir le registre Art. 30 RGPD à jour (traitements + finalités)");
    actions.push("📜 Mettre à jour la politique de confidentialité (traitement IA + base mémorielle)");
  }
  if (p.regulations.includes("cndp")) {
    actions.push("🇲🇦 Déclaration CNDP (Loi 09-08 Maroc), formulaire F211 via cndp.ma");
    actions.push("👤 Désigner un correspondant CNDP (équivalent DPO)");
    actions.push("📞 Documenter droits d'accès et de rectification (Art. 7-8 Loi 09-08), SLA 10 jours min.");
  }
  if (p.regulations.includes("aiact")) {
    actions.push("🤖 Classer le système IA selon l'AI Act : risque limité (transparency) ou haut risque (Art. 9-15)");
    actions.push("✅ Si déployeur Art. 26-29 : checklist de conformité");
    actions.push("📢 Si haut risque : gestion des risques + supervision humaine + cyber + log automatique");
  }
  if (p.regulations.includes("hipaa")) {
    actions.push("🇺🇸 Business Associate Agreement (BAA) avec tous les sous-processors qui touchent du PHI");
    actions.push("🔐 Chiffrement AES-256 au repos ET en transit, audit log immuable");
  }
  if (p.regulations.includes("secret-pro")) {
    actions.push("🔒 Verrouillage accès par RLS Postgres (champ `circle`), chaque dossier client = un circle distinct");
    actions.push("✍ Audit trail signé append-only (PL/pgSQL triggers)");
    actions.push("👤 Anonymisation k-anonymity k=5 minimum sur tout export hors périmètre dossier");
  }
  if (p.sensitivity === "secret" || p.regulations.includes("secret-pro")) {
    actions.push("🚫 Bannir la mémoire propriétaire des éditeurs (Memory ChatGPT/Claude) pour toute décision structurante");
  }
  return actions;
}

/** Risques et incohérences détectés dans le profil. Fonction pure. */
export function computeRisks(preset: Preset, p: Profile, totalCost: number): string[] {
  const risks: string[] = [];
  if (p.techLevel === "none" && preset === "HARD") {
    risks.push("⚠️ Preset HARD avec compétences non-techniques : nécessite un partenaire DevOps, ou redimensionner en MEDIUM managé.");
  }
  if (p.audit && preset === "LIGHT") {
    risks.push("🚨 Audit obligatoire incompatible avec LIGHT (pas d'audit trail signé). Passer en MEDIUM minimum.");
  }
  if (p.bitemporal && preset === "LIGHT") {
    risks.push("🚨 Bitemporalité obligatoire impossible en LIGHT. Basculer en MEDIUM (Postgres+AGE ou Graphiti).");
  }
  if (p.volume === "gt1000" && preset === "LIGHT") {
    risks.push("⚠️ Volume > 1 TB avec LIGHT : la free tier saturera en 1-3 mois. Provisionner MEDIUM dès le départ.");
  }
  if (p.contentTypes.includes("audio") && p.contentTypes.length === 1 && preset !== "LIGHT") {
    risks.push("📌 Audio seul : prévoir pipeline Whisper large-v3 (diarisation) en amont. +50-100 €/mois si self-host GPU.");
  }
  if (p.contentTypes.includes("video") && preset === "LIGHT") {
    risks.push("⚠️ Vidéo détectée mais preset LIGHT : transcription + frames + embedding vidéo coûte du GPU. Évaluer MEDIUM.");
  }
  if (p.zone === "maroc" && p.regulations.includes("rgpd") && !p.regulations.includes("cndp")) {
    risks.push("🇲🇦 Zone Maroc avec RGPD mais sans CNDP : la CNDP s'applique en plus. Vérifier.");
  }
  if (p.users > 50 && preset === "LIGHT") {
    risks.push(`⚠️ ${p.users} utilisateurs avec LIGHT : pas de multi-tenancy stricte (RLS). Basculer MEDIUM (RLS + champ circle).`);
  }
  if (p.voices === "many" && preset === "LIGHT") {
    risks.push("⚠️ Multi-perspective avec LIGHT : pas de gouvernance des voices. Passer en MEDIUM ou V1+ rapidement.");
  }
  if (p.budget === "lt50" && totalCost > 80) {
    risks.push(`💰 Budget < 50 € mais coût estimé ${totalCost} € : dépassement de ${totalCost - 50} €. Réduire le scope ou augmenter le budget.`);
  }
  if (p.contentTypes.length >= 4 && preset === "LIGHT") {
    risks.push("🔄 4+ types de contenu en LIGHT : la complexité d'ingestion dépasse ce que LIGHT supporte. Basculer MEDIUM.");
  }
  if (p.reqPerDay === "gt10k" && preset === "LIGHT") {
    risks.push("📈 > 10k requêtes/jour : LIGHT API direct coûte cher. Self-host vLLM (MEDIUM/HARD) rentabilise.");
  }
  if (p.regulations.length === 1 && p.regulations[0] === "none" && p.sensitivity !== "public") {
    risks.push("⚖️ Aucun régime juridique coché mais sensibilité non publique : presque toujours une erreur (RGPD s'applique dès qu'il y a des données personnelles).");
  }
  return risks;
}

/** Vérification des 7 causes d'échec d'une base mémorielle (KM checks). Fonction pure. */
export function computeKMChecks(preset: Preset, p: Profile): KMCheck[] {
  const wantsBitemp = p.bitemporal;
  return [
    {
      cause: "1. Fausse prémisse « stocker = savoir »",
      coverage: "Frontmatter qualifie chaque atome (Xavier v1.0.0) + types décision/méthode/postmortem",
      ok: true,
      warn: false,
    },
    {
      cause: "2. Rigidité des instantanés figés",
      coverage: wantsBitemp
        ? "Bitemporel actif sur faits (Chris/Xavier), V1+ ajoute bi-temp sur arêtes"
        : "Pas de bitemporel demandé → archive plate, risque de figer",
      ok: wantsBitemp,
      warn: false,
    },
    {
      cause: "3. Décrochage opérationnel (la base n'est pas maintenue)",
      coverage: "Vault markdown = écriture = ingestion (doctrine Amine). Pas de saisie séparée à entretenir.",
      ok: true,
      warn: false,
    },
    {
      cause: "4. Silos défensifs (rétention du savoir)",
      coverage:
        p.voices === "solo"
          ? "Solo : non applicable. Si croissance équipe → V1+ multi-voix"
          : "Multi-voix actif → délégation auditée append-only à prévoir (V1+)",
      ok: p.voices === "solo" || preset !== "LIGHT",
      warn: p.voices !== "solo" && preset === "LIGHT",
    },
    {
      cause: "5. Approche tech-first (outil ≠ usage)",
      coverage: "DoD orientés usage métier (questionnaire profil, pas critères techniques)",
      ok: true,
      warn: false,
    },
    {
      cause: "6. Perte de contexte stratégique",
      coverage:
        preset === "LIGHT"
          ? "Transclusion basique (markdown links). Limité pour archives complexes"
          : "Transclusion + use cases ancrés possible (MasterNote pattern Amine)",
      ok: preset !== "LIGHT",
      warn: preset === "LIGHT",
    },
    {
      cause: "7. Cycles répétitifs d'échec (KM jeté tous les 5 ans)",
      coverage: "Vault markdown portable + ADR figés → zéro vendor lock-in. Stack remplaçable sans perdre la matière.",
      ok: true,
      warn: false,
    },
  ];
}
