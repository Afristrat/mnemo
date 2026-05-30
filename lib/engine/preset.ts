import { msg, type EngineResolver, type Message, type MessageValues } from "./message";
import type { Activity, Budget, Growth, Preset, PresetReason, Profile, ReqPerDay, Sensitivity, Voices, Volume } from "./types";

// Décision de preset (S-051, refonte « scoré + explicable » — décision Amine, lève l'incohérence
// historique où l'étiquette `expected` des profils-types divergeait du résultat des règles, ex.
// « Coach indépendant » étiqueté MEDIUM mais classé LIGHT par l'ancienne cascade).
//
// Modèle en DEUX temps, défendable et documenté (cf. docs/DECISIONS.md ADR-020) :
//  1) DÉCLENCHEURS DURS → HARD : la souveraineté/conformité prime, indépendamment de la charge
//     (secret · cabinet régulé · HIPAA · secret professionnel · audit ET bitemporel obligatoires).
//  2) Sinon, un SCORE DE BESOIN départage LIGHT vs MEDIUM. Le volume domine (séparateur principal :
//     une base « personnelle » < 1 Go relève de LIGHT ; dès qu'il y a un corpus d'organisation, on
//     passe MEDIUM), complété par la sensibilité, la charge (débit/users), les voix, la croissance,
//     le budget et la nature de l'activité. Seuil LIGHT = score ≤ 4.
// Le score est EXPOSÉ (reason + champs) → preset « expliqué », pas une boîte noire.

// i18n (S-058) : la « raison » du preset n'est plus de la prose mais un gabarit `Message` + une liste
// de descripteurs (déclencheurs en HARD, contributions de score en LIGHT/MEDIUM) résolus et joints par
// `formatPresetReason`. Le moteur reste pur ; la composition localisée se fait à la présentation.
export type PresetDecision = { preset: Preset; reason: PresetReason; score: number };

const VOLUME_W: Record<Volume, number> = { lt1: 0, "1to10": 4, "10to100": 6, "100to1000": 8, gt1000: 10 };
const REQ_W: Record<ReqPerDay, number> = { lt100: 0, lt1k: 1, lt10k: 3, gt10k: 5 };
// secret → traité en déclencheur dur (poids ici inutilisé).
const SENS_W: Record<Sensitivity, number> = { public: 0, confidential: 1, internal: 2, secret: 0 };
const GROWTH_W: Record<Growth, number> = { low: 0, medium: 0, high: 1 };
const BUDGET_W: Record<Budget, number> = { lt50: 0, "50to200": 1, "200to500": 2, "500to2k": 2, gt2k: 2 };
const VOICES_W: Record<Voices, number> = { solo: 0, multi: 1, many: 2 };
// cabinet-regule → déclencheur dur (poids inutilisé).
const ACTIVITY_W: Record<Activity, number> = {
  particulier: 0,
  freelance: 0,
  "cabinet-regule": 0,
  agence: 1,
  "pme-startup": 1,
  recherche: 1,
  other: 0,
};

/** Seuil : un score de besoin ≤ 3 (hors déclencheur dur) reste sur la stack légère. Calibré pour que
 * les profils-types calculent leur étiquette `expected` (réconciliation S-051) et qu'un corpus
 * d'organisation (volume ≥ 1–10 Go = +4) bascule en MEDIUM. */
const LIGHT_MAX = 3;

function usersWeight(users: number): number {
  if (users > 50) return 3;
  if (users > 10) return 2;
  if (users > 1) return 1;
  return 0;
}

/** Déclencheurs durs → HARD (souveraineté/conformité). Descripteurs i18n des déclencheurs actifs. */
function hardTriggers(p: Profile): Message[] {
  const triggers: Message[] = [];
  if (p.sensitivity === "secret") triggers.push(msg("preset.trigger.secret"));
  if (p.activity === "cabinet-regule") triggers.push(msg("preset.trigger.cabinet"));
  if (p.regulations.includes("hipaa")) triggers.push(msg("preset.trigger.hipaa"));
  if (p.regulations.includes("secret-pro")) triggers.push(msg("preset.trigger.secretPro"));
  if (p.audit && p.bitemporal) triggers.push(msg("preset.trigger.auditBitemp"));
  return triggers;
}

/** Score de besoin (départage LIGHT/MEDIUM hors HARD) + descripteurs des contributions non nulles, triés. */
function needScore(p: Profile): { score: number; drivers: Message[] } {
  const parts: { id: string; values: MessageValues; points: number }[] = [
    { id: `preset.driver.volume_${p.volume}`, values: {}, points: VOLUME_W[p.volume] },
    { id: `preset.driver.sensitivity_${p.sensitivity}`, values: {}, points: SENS_W[p.sensitivity] },
    { id: "preset.driver.req", values: {}, points: REQ_W[p.reqPerDay] },
    { id: "preset.driver.users", values: { users: p.users }, points: usersWeight(p.users) },
    { id: "preset.driver.voices", values: {}, points: VOICES_W[p.voices] },
    { id: "preset.driver.growth", values: {}, points: GROWTH_W[p.growth] },
    { id: "preset.driver.budget", values: {}, points: BUDGET_W[p.budget] },
    { id: "preset.driver.activity", values: {}, points: ACTIVITY_W[p.activity] },
  ];
  const score = parts.reduce((sum, x) => sum + x.points, 0);
  const drivers = parts
    .filter((x) => x.points > 0)
    .sort((a, b) => b.points - a.points)
    .map((x) => msg(x.id, { ...x.values, points: x.points }));
  return { score, drivers };
}

/** Décision de base (besoin/conformité), avant préférence de souveraineté. Pure et déterministe. */
function baseDecision(p: Profile): PresetDecision {
  const triggers = hardTriggers(p);
  const { score, drivers } = needScore(p);

  if (triggers.length > 0) {
    return { preset: "HARD", score, reason: { template: msg("preset.reasonHard"), drivers: triggers, suffix: null } };
  }

  if (score <= LIGHT_MAX) {
    const ds = drivers.length > 0 ? drivers : [msg("preset.driver.lightDefault")];
    return {
      preset: "LIGHT",
      score,
      reason: { template: msg("preset.reasonLight", { score, max: LIGHT_MAX }), drivers: ds, suffix: null },
    };
  }

  return {
    preset: "MEDIUM",
    score,
    reason: { template: msg("preset.reasonMedium", { score, max: LIGHT_MAX }), drivers, suffix: null },
  };
}

/**
 * Décide le preset (LIGHT/MEDIUM/HARD) à partir du profil. Pure et déterministe.
 * Si `preferSovereign` est activé (S-066), le preset est relevé d'un cran (la souveraineté de la
 * stack est portée par le preset dans le catalogue : MEDIUM/HARD = self-host/open-source). Honnête :
 * coût/complexité plus élevés — la tension budget est signalée par le budget-mètre, jamais masquée.
 */
export function decidePreset(p: Profile): PresetDecision {
  const base = baseDecision(p);
  if (p.preferSovereign === true && base.preset !== "HARD") {
    const bumped: Preset = base.preset === "LIGHT" ? "MEDIUM" : "HARD";
    return { preset: bumped, score: base.score, reason: { ...base.reason, suffix: msg("preset.reasonSovereignBump", { bumped }) } };
  }
  return base;
}

/**
 * Compose la raison du preset en chaîne localisée (S-058). Pure : prend un résolveur injecté (UI via
 * next-intl, ou stub de test). Résout chaque déclencheur/driver, les joint, puis remplit le gabarit
 * (placeholder `{drivers}` + valeurs score/seuil/preset), et ajoute la phrase de relèvement si présente.
 */
export function formatPresetReason(reason: PresetReason, resolve: EngineResolver): string {
  const drivers = reason.drivers.map(resolve).join(", ");
  const base = resolve({ id: reason.template.id, values: { ...reason.template.values, drivers } });
  return reason.suffix === null ? base : `${base} ${resolve(reason.suffix)}`;
}
