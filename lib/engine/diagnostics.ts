import { msg, type Message } from "./message";
import type { KMCheck, Preset, Profile } from "./types";

/**
 * Actions de conformité déclenchées par les régimes cochés. Fonction pure.
 * i18n (S-058) : renvoie des descripteurs `Message` (clés `Engine.diagnostics.compliance.*`),
 * jamais de prose — la couche de présentation les résout en fr/en.
 */
export function computeCompliance(p: Profile): Message[] {
  const actions: Message[] = [];
  const add = (key: string): void => {
    actions.push(msg(`diagnostics.compliance.${key}`));
  };
  if (p.regulations.includes("rgpd")) {
    add("rgpdAipd");
    add("rgpdDpa");
    add("rgpdErasure");
    add("rgpdRegistry");
    add("rgpdPrivacyPolicy");
  }
  if (p.regulations.includes("cndp")) {
    add("cndpDeclaration");
    add("cndpCorrespondent");
    add("cndpRights");
  }
  if (p.regulations.includes("aiact")) {
    add("aiactClassify");
    add("aiactDeployer");
    add("aiactHighRisk");
  }
  if (p.regulations.includes("hipaa")) {
    add("hipaaBaa");
    add("hipaaEncryption");
  }
  if (p.regulations.includes("secret-pro")) {
    add("secretProRls");
    add("secretProAuditTrail");
    add("secretProAnonymization");
  }
  if (p.sensitivity === "secret" || p.regulations.includes("secret-pro")) {
    add("banProprietaryMemory");
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
  if (p.latency === "fast" && preset === "LIGHT") {
    risks.push("⚡ Latence faible attendue mais preset LIGHT (API managé tierce, aucune garantie de latence) : passer en MEDIUM (self-host pour maîtriser la latence).");
  }
  if (p.growth === "high" && preset === "LIGHT") {
    risks.push("🌱 Croissance forte anticipée mais LIGHT : provisionner MEDIUM dès le départ pour absorber la montée en charge sans migration en urgence.");
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
      coverage: "Frontmatter qualifie chaque atome (contrat de métadonnées) + types décision/méthode/postmortem",
      ok: true,
      warn: false,
    },
    {
      cause: "2. Rigidité des instantanés figés",
      coverage: wantsBitemp
        ? "Bitemporel actif sur faits, V1+ ajoute bi-temp sur arêtes"
        : "Pas de bitemporel demandé → archive plate, risque de figer",
      ok: wantsBitemp,
      warn: false,
    },
    {
      cause: "3. Décrochage opérationnel (la base n'est pas maintenue)",
      coverage: "Vault markdown = écriture = ingestion. Pas de saisie séparée à entretenir.",
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
          : "Transclusion + use cases ancrés possible (pattern note-maîtresse)",
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
