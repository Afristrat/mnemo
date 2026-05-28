// Intake libre → Profile (S-038). Le LLM EXTRAIT des paramètres depuis une description en langage
// naturel ; il NE CALCULE RIEN (DÉFCON 1). Tout ce qu'il propose est VALIDÉ et BORNÉ ici, contre les
// unions du moteur : une valeur hors-bornes/inconnue est REJETÉE → on conserve le défaut prudent
// (jamais sous-dimensionné). Module PUR (aucun appel réseau) : `buildIntakeMessages` compose le
// prompt, `parseIntakeProfile` valide la réponse. La route `app/api/llm/intake` orchestre callLLM.

import {
  CONTENT_TYPES,
  REGULATIONS,
  type Activity,
  type Budget,
  type ContentType,
  type Growth,
  type Latency,
  type Profile,
  type Regulation,
  type ReqPerDay,
  type Sensitivity,
  type TechLevel,
  type Voices,
  type Volume,
  type Zone,
} from "@/lib/engine";
import { DEFAULT_PROFILE } from "@/lib/wizard/defaultProfile";
import type { LlmMessage } from "./types";

// Valeurs autorisées (en phase avec les unions de types.ts via `satisfies`). Toute autre valeur
// proposée par le LLM est rejetée → défaut conservé.
const ACTIVITIES = [
  "freelance",
  "cabinet-regule",
  "particulier",
  "agence",
  "pme-startup",
  "recherche",
  "other",
] as const satisfies readonly Activity[];
const ZONES = ["ue", "maroc", "us", "other"] as const satisfies readonly Zone[];
const VOLUMES = ["lt1", "1to10", "10to100", "100to1000", "gt1000"] as const satisfies readonly Volume[];
const GROWTHS = ["low", "medium", "high"] as const satisfies readonly Growth[];
const SENSITIVITIES = ["public", "internal", "confidential", "secret"] as const satisfies readonly Sensitivity[];
const TECH_LEVELS = ["none", "dev", "hybrid", "devops"] as const satisfies readonly TechLevel[];
const BUDGETS = ["lt50", "50to200", "200to500", "500to2k", "gt2k"] as const satisfies readonly Budget[];
const REQ_PER_DAYS = ["lt100", "lt1k", "lt10k", "gt10k"] as const satisfies readonly ReqPerDay[];
const LATENCIES = ["fast", "acceptable", "relaxed"] as const satisfies readonly Latency[];
const VOICES_VALUES = ["solo", "multi", "many"] as const satisfies readonly Voices[];

const MAX_USERS = 100_000;

/** Résultat de l'intake : le profil borné + la trace de ce qui a été appliqué / rejeté (transparence). */
export type IntakeResult = {
  profile: Profile;
  /** Champs effectivement repris de la description (valides). */
  applied: string[];
  /** Champs présents mais rejetés (hors-bornes/inconnus) ou JSON illisible → défaut conservé. */
  rejected: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Extrait le premier objet JSON d'une réponse LLM (tolère ```json … ``` ou du texte autour). */
function extractJsonObject(content: string): Record<string, unknown> | null {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const parsed: unknown = JSON.parse(content.slice(start, end + 1));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== "string") return null;
  return allowed.find((a) => a === value) ?? null;
}

function pickEnumArray<T extends string>(value: unknown, allowed: readonly T[]): T[] | null {
  if (!Array.isArray(value)) return null;
  const out: T[] = [];
  for (const v of value) {
    const picked = pickEnum(v, allowed);
    if (picked !== null && !out.includes(picked)) out.push(picked);
  }
  return out.length > 0 ? out : null;
}

function pickUsers(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.round(value);
  if (n < 1) return null;
  return Math.min(n, MAX_USERS);
}

function pickBool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

/** Champs d'intake d'un profil (les 15 que le LLM peut extraire), pour le contexte d'ajustement. */
function intakeSnapshot(p: Profile): Record<string, unknown> {
  return {
    activity: p.activity,
    zone: p.zone,
    users: p.users,
    contentTypes: p.contentTypes,
    volume: p.volume,
    growth: p.growth,
    regulations: p.regulations,
    sensitivity: p.sensitivity,
    audit: p.audit,
    bitemporal: p.bitemporal,
    techLevel: p.techLevel,
    budget: p.budget,
    reqPerDay: p.reqPerDay,
    latency: p.latency,
    voices: p.voices,
  };
}

/**
 * Compose le prompt d'extraction. Le système énumère STRICTEMENT les valeurs autorisées et interdit
 * d'inventer (omettre si absent/ambigu). Le LLM ne calcule aucun coût ; il ne fait qu'extraire.
 * Si `base` est fourni (S-052, note libre par bloc), le LLM AJUSTE ce profil existant : il ne renvoie
 * que les champs réellement modifiés par la note, et pour les listes il conserve l'existant + ajoute.
 */
export function buildIntakeMessages(text: string, base?: Profile): LlmMessage[] {
  const lines = [
    "Tu es un extracteur de paramètres pour un configurateur d'infrastructure mémorielle souveraine.",
    "À partir de la description de l'utilisateur, produis UNIQUEMENT un objet JSON (aucun texte autour).",
    "Pour CHAQUE information EXPLICITEMENT présente, renseigne le champ. N'INVENTE RIEN : si une",
    "information est absente ou ambiguë, OMETS le champ (ne devine pas). Tu ne calcules AUCUN coût.",
    "",
    "Champs et valeurs autorisées (emploie EXACTEMENT ces valeurs) :",
    `- activity: ${ACTIVITIES.join(" | ")}`,
    `- zone: ${ZONES.join(" | ")}`,
    "- users: entier >= 1 (nombre d'utilisateurs)",
    `- contentTypes: tableau parmi ${CONTENT_TYPES.join(" | ")}`,
    `- volume: ${VOLUMES.join(" | ")} (volume de données, en Go)`,
    `- growth: ${GROWTHS.join(" | ")}`,
    `- regulations: tableau parmi ${REGULATIONS.join(" | ")}`,
    `- sensitivity: ${SENSITIVITIES.join(" | ")}`,
    "- audit: booléen (piste d'audit signée exigée)",
    "- bitemporal: booléen (historique bitemporel exigé)",
    `- techLevel: ${TECH_LEVELS.join(" | ")}`,
    `- budget: ${BUDGETS.join(" | ")} (€/mois)`,
    `- reqPerDay: ${REQ_PER_DAYS.join(" | ")}`,
    `- latency: ${LATENCIES.join(" | ")}`,
    `- voices: ${VOICES_VALUES.join(" | ")}`,
  ];
  if (base !== undefined) {
    lines.push(
      "",
      "Profil ACTUEL (ne repars pas de zéro, AJUSTE-le) :",
      JSON.stringify(intakeSnapshot(base)),
      "Ne renvoie QUE les champs que la note modifie réellement. Pour les listes (contentTypes,",
      "regulations), CONSERVE les valeurs déjà présentes et AJOUTE celles demandées (ne remplace",
      "que si l'utilisateur demande explicitement un retrait).",
    );
  }
  lines.push("", "Réponds par le JSON seul.");
  return [
    { role: "system", content: lines.join("\n") },
    { role: "user", content: text },
  ];
}

/** Valide/borne un objet déjà parsé contre les unions du moteur, par-dessus un profil de base. Pur. */
function validateIntakeFields(data: Record<string, unknown>, base: Profile): IntakeResult {
  const profile: Profile = { ...base };
  const applied: string[] = [];
  const rejected: string[] = [];

  // Lit un champ : absent → ignoré ; invalide → rejeté ; valide → appliqué.
  function take<T>(name: string, pick: (v: unknown) => T | null): T | undefined {
    if (!(name in data)) return undefined;
    const picked = pick(data[name]);
    if (picked === null) {
      rejected.push(name);
      return undefined;
    }
    applied.push(name);
    return picked;
  }

  const activity = take("activity", (v) => pickEnum<Activity>(v, ACTIVITIES));
  if (activity !== undefined) profile.activity = activity;
  const zone = take("zone", (v) => pickEnum<Zone>(v, ZONES));
  if (zone !== undefined) profile.zone = zone;
  const users = take("users", pickUsers);
  if (users !== undefined) profile.users = users;
  const contentTypes = take("contentTypes", (v) => pickEnumArray<ContentType>(v, CONTENT_TYPES));
  if (contentTypes !== undefined) profile.contentTypes = contentTypes;
  const volume = take("volume", (v) => pickEnum<Volume>(v, VOLUMES));
  if (volume !== undefined) profile.volume = volume;
  const growth = take("growth", (v) => pickEnum<Growth>(v, GROWTHS));
  if (growth !== undefined) profile.growth = growth;
  const regulations = take("regulations", (v) => pickEnumArray<Regulation>(v, REGULATIONS));
  if (regulations !== undefined) profile.regulations = regulations;
  const sensitivity = take("sensitivity", (v) => pickEnum<Sensitivity>(v, SENSITIVITIES));
  if (sensitivity !== undefined) profile.sensitivity = sensitivity;
  const audit = take("audit", pickBool);
  if (audit !== undefined) profile.audit = audit;
  const bitemporal = take("bitemporal", pickBool);
  if (bitemporal !== undefined) profile.bitemporal = bitemporal;
  const techLevel = take("techLevel", (v) => pickEnum<TechLevel>(v, TECH_LEVELS));
  if (techLevel !== undefined) profile.techLevel = techLevel;
  const budget = take("budget", (v) => pickEnum<Budget>(v, BUDGETS));
  if (budget !== undefined) profile.budget = budget;
  const reqPerDay = take("reqPerDay", (v) => pickEnum<ReqPerDay>(v, REQ_PER_DAYS));
  if (reqPerDay !== undefined) profile.reqPerDay = reqPerDay;
  const latency = take("latency", (v) => pickEnum<Latency>(v, LATENCIES));
  if (latency !== undefined) profile.latency = latency;
  const voices = take("voices", (v) => pickEnum<Voices>(v, VOICES_VALUES));
  if (voices !== undefined) profile.voices = voices;

  return { profile, applied, rejected };
}

/**
 * Valide et borne la réponse du LLM contre les unions du moteur, à partir d'un profil de base
 * (défaut = `DEFAULT_PROFILE`, prudent). Champ valide → appliqué ; présent mais invalide → rejeté,
 * défaut conservé ; absent → défaut conservé. JSON illisible → profil de base inchangé. Fonction pure.
 */
export function parseIntakeProfile(content: string, base: Profile = DEFAULT_PROFILE): IntakeResult {
  const obj = extractJsonObject(content);
  if (obj === null) return { profile: { ...base }, applied: [], rejected: ["json"] };
  return validateIntakeFields(obj, base);
}

/**
 * Borne un profil reçu (ex. base envoyée par le client pour le contexte d'ajustement S-052) : ne
 * conserve que les 15 champs d'intake valides, par-dessus `DEFAULT_PROFILE`. Les champs structurés
 * (modules/mediaNeeds/backup) ne sont pas repris ici — l'overlay client (`applyIntakeFields`) les
 * préserve sur le vrai profil. Non-objet → profil par défaut. Fonction pure.
 */
export function coerceProfile(raw: unknown): Profile {
  if (!isRecord(raw)) return { ...DEFAULT_PROFILE };
  return validateIntakeFields(raw, DEFAULT_PROFILE).profile;
}

/**
 * Applique sur un profil courant UNIQUEMENT les champs effectivement extraits/validés (`result.applied`)
 * — switch type-safe par nom de champ. Les champs non mentionnés et les champs structurés
 * (modules/mediaNeeds/backup/freeNotes) sont PRÉSERVÉS. Lève la dette « freeNotes jamais lu » (S-052).
 */
export function applyIntakeFields(current: Profile, result: IntakeResult): Profile {
  const next: Profile = { ...current };
  const p = result.profile;
  for (const field of result.applied) {
    switch (field) {
      case "activity": next.activity = p.activity; break;
      case "zone": next.zone = p.zone; break;
      case "users": next.users = p.users; break;
      case "contentTypes": next.contentTypes = p.contentTypes; break;
      case "volume": next.volume = p.volume; break;
      case "growth": next.growth = p.growth; break;
      case "regulations": next.regulations = p.regulations; break;
      case "sensitivity": next.sensitivity = p.sensitivity; break;
      case "audit": next.audit = p.audit; break;
      case "bitemporal": next.bitemporal = p.bitemporal; break;
      case "techLevel": next.techLevel = p.techLevel; break;
      case "budget": next.budget = p.budget; break;
      case "reqPerDay": next.reqPerDay = p.reqPerDay; break;
      case "latency": next.latency = p.latency; break;
      case "voices": next.voices = p.voices; break;
      default: break; // champ inconnu (ex. "json"/"llm") ignoré
    }
  }
  return next;
}
