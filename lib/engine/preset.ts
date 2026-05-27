import type { Activity, Budget, Growth, Preset, Profile, ReqPerDay, Sensitivity, Voices, Volume } from "./types";

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

export type PresetDecision = { preset: Preset; reason: string; score: number; drivers: string[] };

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

const VOLUME_LABEL: Record<Volume, string> = {
  lt1: "< 1 Go",
  "1to10": "1–10 Go",
  "10to100": "10–100 Go",
  "100to1000": "100 Go–1 To",
  gt1000: "> 1 To",
};
const SENS_LABEL: Record<Sensitivity, string> = {
  public: "public",
  confidential: "confidentiel",
  internal: "interne",
  secret: "secret",
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

/** Déclencheurs durs → HARD (souveraineté/conformité). Renvoie les libellés des déclencheurs actifs. */
function hardTriggers(p: Profile): string[] {
  const triggers: string[] = [];
  if (p.sensitivity === "secret") triggers.push("données secrètes / ultra-sensibles");
  if (p.activity === "cabinet-regule") triggers.push("cabinet régulé");
  if (p.regulations.includes("hipaa")) triggers.push("HIPAA");
  if (p.regulations.includes("secret-pro")) triggers.push("secret professionnel");
  if (p.audit && p.bitemporal) triggers.push("audit ET bitemporel obligatoires");
  return triggers;
}

/** Score de besoin (départage LIGHT/MEDIUM hors HARD) + libellés des contributions non nulles. */
function needScore(p: Profile): { score: number; drivers: string[] } {
  const parts: { label: string; points: number }[] = [
    { label: `volume ${VOLUME_LABEL[p.volume]}`, points: VOLUME_W[p.volume] },
    { label: `sensibilité ${SENS_LABEL[p.sensitivity]}`, points: SENS_W[p.sensitivity] },
    { label: "débit de requêtes", points: REQ_W[p.reqPerDay] },
    { label: `${p.users} utilisateurs`, points: usersWeight(p.users) },
    { label: "multi-voix", points: VOICES_W[p.voices] },
    { label: "croissance forte", points: GROWTH_W[p.growth] },
    { label: "budget conséquent", points: BUDGET_W[p.budget] },
    { label: "usage d'organisation", points: ACTIVITY_W[p.activity] },
  ];
  const score = parts.reduce((sum, x) => sum + x.points, 0);
  const drivers = parts
    .filter((x) => x.points > 0)
    .sort((a, b) => b.points - a.points)
    .map((x) => `${x.label} (+${x.points})`);
  return { score, drivers };
}

/** Décide le preset (LIGHT/MEDIUM/HARD) à partir du profil. Pure et déterministe. */
export function decidePreset(p: Profile): PresetDecision {
  const triggers = hardTriggers(p);
  const { score, drivers } = needScore(p);

  if (triggers.length > 0) {
    return {
      preset: "HARD",
      score,
      drivers: triggers,
      reason: `Niveau de besoin maximal — déclencheur(s) : ${triggers.join(", ")}. Souveraineté maximale, on-prem privilégié, isolation forte.`,
    };
  }

  if (score <= LIGHT_MAX) {
    const why = drivers.length > 0 ? drivers.join(", ") : "faible volume, usage personnel, peu de contraintes";
    return {
      preset: "LIGHT",
      score,
      drivers,
      reason: `Besoin léger (score ${score} ≤ ${LIGHT_MAX}) : ${why}. Stack simplifiée API-first qui démarre en quelques heures.`,
    };
  }

  return {
    preset: "MEDIUM",
    score,
    drivers,
    reason: `Besoin intermédiaire (score ${score} > ${LIGHT_MAX}) : ${drivers.join(", ")}. Équilibre souveraineté (hébergement contrôlé) et pragmatisme (cascade API + self-host).`,
  };
}
