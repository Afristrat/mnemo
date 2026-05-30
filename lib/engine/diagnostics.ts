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

/**
 * Risques et incohérences détectés dans le profil. Fonction pure.
 * i18n (S-058) : descripteurs `Message` (`Engine.diagnostics.risks.*`), valeurs d'interpolation
 * (users, totalCost…) portées par le descripteur.
 */
export function computeRisks(preset: Preset, p: Profile, totalCost: number): Message[] {
  const risks: Message[] = [];
  const add = (key: string, values?: Record<string, number>): void => {
    risks.push(msg(`diagnostics.risks.${key}`, values));
  };
  if (p.techLevel === "none" && preset === "HARD") add("noTechHard");
  if (p.audit && preset === "LIGHT") add("auditLight");
  if (p.bitemporal && preset === "LIGHT") add("bitemporalLight");
  if (p.volume === "gt1000" && preset === "LIGHT") add("volumeLight");
  if (p.contentTypes.includes("audio") && p.contentTypes.length === 1 && preset !== "LIGHT") add("audioOnly");
  if (p.contentTypes.includes("video") && preset === "LIGHT") add("videoLight");
  if (p.zone === "maroc" && p.regulations.includes("rgpd") && !p.regulations.includes("cndp")) add("marocRgpdNoCndp");
  if (p.users > 50 && preset === "LIGHT") add("usersLight", { users: p.users });
  if (p.voices === "many" && preset === "LIGHT") add("voicesLight");
  if (p.budget === "lt50" && totalCost > 80) add("budgetOverflow", { totalCost, over: totalCost - 50 });
  if (p.contentTypes.length >= 4 && preset === "LIGHT") add("manyContentLight");
  if (p.reqPerDay === "gt10k" && preset === "LIGHT") add("reqLight");
  if (p.latency === "fast" && preset === "LIGHT") add("latencyLight");
  if (p.growth === "high" && preset === "LIGHT") add("growthLight");
  if (p.regulations.length === 1 && p.regulations[0] === "none" && p.sensitivity !== "public") add("noRegSensitive");
  return risks;
}

/**
 * Vérification des 7 causes d'échec d'une base mémorielle (KM checks). Fonction pure.
 * i18n (S-058) : `cause`/`coverage` sont des descripteurs `Message` (`Engine.diagnostics.km.*`) ;
 * la branche conditionnelle sélectionne la bonne clé de couverture.
 */
export function computeKMChecks(preset: Preset, p: Profile): KMCheck[] {
  const wantsBitemp = p.bitemporal;
  const solo = p.voices === "solo";
  const light = preset === "LIGHT";
  return [
    { cause: msg("diagnostics.km.cause1"), coverage: msg("diagnostics.km.cov1"), ok: true, warn: false },
    {
      cause: msg("diagnostics.km.cause2"),
      coverage: msg(wantsBitemp ? "diagnostics.km.cov2Bitemp" : "diagnostics.km.cov2None"),
      ok: wantsBitemp,
      warn: false,
    },
    { cause: msg("diagnostics.km.cause3"), coverage: msg("diagnostics.km.cov3"), ok: true, warn: false },
    {
      cause: msg("diagnostics.km.cause4"),
      coverage: msg(solo ? "diagnostics.km.cov4Solo" : "diagnostics.km.cov4Multi"),
      ok: solo || preset !== "LIGHT",
      warn: !solo && light,
    },
    { cause: msg("diagnostics.km.cause5"), coverage: msg("diagnostics.km.cov5"), ok: true, warn: false },
    {
      cause: msg("diagnostics.km.cause6"),
      coverage: msg(light ? "diagnostics.km.cov6Light" : "diagnostics.km.cov6Full"),
      ok: !light,
      warn: light,
    },
    { cause: msg("diagnostics.km.cause7"), coverage: msg("diagnostics.km.cov7"), ok: true, warn: false },
  ];
}
