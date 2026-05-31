// Partage de la recommandation (S-067) — encodage STATELESS du profil dans l'URL.
//
// Le bouton « Copier le lien » sérialise le `Profile` courant en base64 URL-safe placé dans
// `/resultats?p=<...>`. Au chargement, `ResultsView` lit `?p=` → décode → rejoue exactement ce
// profil (prioritaire sur le localStorage). Fonctions PURES, sans dépendance UI/réseau, testées.
//
// Robustesse : un `?p` corrompu (base64 invalide, JSON cassé, forme non-Profile) → `null` ; l'appelant
// retombe gracieusement sur le localStorage (jamais de crash). On valide les champs DISCRIMINANTS
// (énums) pour garantir qu'on rejoue un vrai Profile, et on complète les champs optionnels via les
// défauts (un lien plus ancien, sans un champ ajouté depuis, reste lisible).

import {
  CONTENT_TYPES,
  CONTINENTS,
  MODULE_IDS,
  REGULATIONS,
  type Backup,
  type BlockId,
  type ContentType,
  type MediaNeed,
  type ModuleId,
  type Profile,
  type Regulation,
  type Residency,
} from "@/lib/engine";
import { DEFAULT_PROFILE } from "@/lib/wizard/defaultProfile";

const ZONES = ["ue", "maroc", "us", "other"] as const;
const VOLUMES = ["lt1", "1to10", "10to100", "100to1000", "gt1000"] as const;
const GROWTHS = ["low", "medium", "high"] as const;
const SENSITIVITIES = ["public", "internal", "confidential", "secret"] as const;
const TECH_LEVELS = ["none", "dev", "hybrid", "devops"] as const;
const BUDGETS = ["lt50", "50to200", "200to500", "500to2k", "gt2k"] as const;
const REQ_PER_DAY = ["lt100", "lt1k", "lt10k", "gt10k"] as const;
const LATENCIES = ["fast", "acceptable", "relaxed"] as const;
const VOICES = ["solo", "multi", "many"] as const;
const ACTIVITIES = [
  "freelance",
  "cabinet-regule",
  "particulier",
  "agence",
  "pme-startup",
  "recherche",
  "other",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMember<T extends string>(set: readonly T[], value: unknown): value is T {
  return typeof set.find((m) => m === value) !== "undefined";
}

const MODALITIES = ["audio", "video", "images"] as const;
const MM_MODES = ["sovereign", "api"] as const;
const MM_TIERS = ["none", "light", "medium", "intensive"] as const;
const BACKUP_CRITICALITIES = ["none", "standard", "high", "critical"] as const;
const BACKUP_TIERS = ["hot", "cold"] as const;
const ERASURE_POLICIES = ["crypto-shred", "expiration"] as const;
const VECTOR_STRATEGIES = ["auto", "backup", "reembed"] as const;
const REGIONS = ["eu", "maroc", "us", "other"] as const;
const DR_TIERS = ["none", "warm", "hot"] as const;
const BLOCK_IDS = ["profil", "infra", "memoire", "medias"] as const;

function optNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

/** Reconstruit un volet (ingest/generate) d'une MediaNeed depuis une valeur inconnue. */
function mediaSegment(value: unknown): { tier: MediaNeed["ingest"]["tier"]; volume?: number } | null {
  if (!isRecord(value) || !isMember(MM_TIERS, value.tier)) return null;
  const seg: { tier: MediaNeed["ingest"]["tier"]; volume?: number } = { tier: value.tier };
  const volume = optNumber(value.volume);
  if (volume !== undefined) seg.volume = volume;
  return seg;
}

/** Reconstruit un `MediaNeed` borné, ou `null` si la forme est invalide. */
function mediaNeedFromUnknown(value: unknown): MediaNeed | null {
  if (!isRecord(value)) return null;
  if (!isMember(MODALITIES, value.modality)) return null;
  if (!isMember(MM_MODES, value.mode)) return null;
  const ingest = mediaSegment(value.ingest);
  const generate = mediaSegment(value.generate);
  if (ingest === null || generate === null) return null;
  const need: MediaNeed = { modality: value.modality, mode: value.mode, ingest, generate };
  const backlog = optNumber(value.backlog);
  if (backlog !== undefined) need.backlog = backlog;
  return need;
}

/** Reconstruit un `Backup` borné (champs experts optionnels). `null` si la criticité est invalide. */
function backupFromUnknown(value: unknown): Backup | null {
  if (!isRecord(value) || !isMember(BACKUP_CRITICALITIES, value.criticality)) return null;
  const backup: Backup = { criticality: value.criticality };
  const rpo = optNumber(value.rpoMinutes);
  if (rpo !== undefined) backup.rpoMinutes = rpo;
  const rto = optNumber(value.rtoMinutes);
  if (rto !== undefined) backup.rtoMinutes = rto;
  const retention = optNumber(value.retentionDays);
  if (retention !== undefined) backup.retentionDays = retention;
  const copies = optNumber(value.copies);
  if (copies !== undefined) backup.copies = copies;
  const offsite = optBoolean(value.offsite);
  if (offsite !== undefined) backup.offsite = offsite;
  const airgap = optBoolean(value.airgap);
  if (airgap !== undefined) backup.airgap = airgap;
  const immutable = optBoolean(value.immutable);
  if (immutable !== undefined) backup.immutable = immutable;
  if (isMember(BACKUP_TIERS, value.tier)) backup.tier = value.tier;
  const byok = optBoolean(value.byok);
  if (byok !== undefined) backup.byok = byok;
  const tests = optNumber(value.restoreTestsPerYear);
  if (tests !== undefined) backup.restoreTestsPerYear = tests;
  if (isMember(VECTOR_STRATEGIES, value.vectorStrategy)) backup.vectorStrategy = value.vectorStrategy;
  if (isMember(ERASURE_POLICIES, value.erasurePolicy)) backup.erasurePolicy = value.erasurePolicy;
  return backup;
}

/** Reconstruit une `Residency` bornée (tous les champs optionnels). `null` si la forme n'est pas un objet. */
function residencyFromUnknown(value: unknown): Residency | null {
  if (!isRecord(value)) return null;
  const residency: Residency = {};
  if (isMember(REGIONS, value.primaryRegion)) residency.primaryRegion = value.primaryRegion;
  if (isMember(DR_TIERS, value.drTier)) residency.drTier = value.drTier;
  if (Array.isArray(value.allowedRegions)) {
    residency.allowedRegions = value.allowedRegions.filter((r): r is (typeof REGIONS)[number] => isMember(REGIONS, r));
  }
  const noTransfer = optBoolean(value.noTransferOutsideJurisdiction);
  if (noTransfer !== undefined) residency.noTransferOutsideJurisdiction = noTransfer;
  const activeActive = optBoolean(value.activeActive);
  if (activeActive !== undefined) residency.activeActive = activeActive;
  const drRpo = optNumber(value.drRpoMinutes);
  if (drRpo !== undefined) residency.drRpoMinutes = drRpo;
  const drRto = optNumber(value.drRtoMinutes);
  if (drRto !== undefined) residency.drRtoMinutes = drRto;
  const selfHosted = optBoolean(value.selfHosted);
  if (selfHosted !== undefined) residency.selfHosted = selfHosted;
  return residency;
}

/** Reconstruit les notes libres par bloc (texte seulement). */
function freeNotesFromUnknown(value: unknown): Partial<Record<BlockId, string>> | null {
  if (!isRecord(value)) return null;
  const notes: Partial<Record<BlockId, string>> = {};
  for (const id of BLOCK_IDS) {
    const note = value[id];
    if (typeof note === "string") notes[id] = note;
  }
  return notes;
}

/** Reconstruit les précisions « Autre » (texte seulement). */
function otherTextFromUnknown(value: unknown): Partial<Record<"activity" | "zone" | "region", string>> | null {
  if (!isRecord(value)) return null;
  const out: Partial<Record<"activity" | "zone" | "region", string>> = {};
  for (const key of ["activity", "zone", "region"] as const) {
    const text = value[key];
    if (typeof text === "string") out[key] = text;
  }
  return out;
}

/** Encode une chaîne UTF-8 en base64 URL-safe (sans `+`, `/`, `=`), côté navigateur ou Node. */
function toBase64Url(text: string): string {
  let b64: string;
  if (typeof btoa === "function") {
    // Navigateur : `btoa` ne gère que le Latin-1 → encoder l'UTF-8 d'abord.
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    b64 = btoa(binary);
  } else {
    b64 = Buffer.from(text, "utf-8").toString("base64");
  }
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

/** Décode une chaîne base64 URL-safe en texte UTF-8. Lève si l'entrée n'est pas un base64 valide. */
function fromBase64Url(param: string): string {
  const b64 = param.replace(/-/g, "+").replace(/_/g, "/");
  if (typeof atob === "function") {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }
  return Buffer.from(b64, "base64").toString("utf-8");
}

/** Valide la forme d'un objet décodé et le normalise en `Profile` (champs optionnels via défauts). */
export function profileFromUnknown(value: unknown): Profile | null {
  if (!isRecord(value)) return null;

  // Champs discriminants (énums) — tous requis et bornés pour accepter le profil.
  if (!isMember(ACTIVITIES, value.activity)) return null;
  if (!isMember(ZONES, value.zone)) return null;
  if (typeof value.users !== "number" || !Number.isFinite(value.users) || value.users < 0) return null;
  if (!isMember(VOLUMES, value.volume)) return null;
  if (!isMember(GROWTHS, value.growth)) return null;
  if (!isMember(SENSITIVITIES, value.sensitivity)) return null;
  if (typeof value.audit !== "boolean") return null;
  if (typeof value.bitemporal !== "boolean") return null;
  if (!isMember(TECH_LEVELS, value.techLevel)) return null;
  if (!isMember(BUDGETS, value.budget)) return null;
  if (!isMember(REQ_PER_DAY, value.reqPerDay)) return null;
  if (!isMember(LATENCIES, value.latency)) return null;
  if (!isMember(VOICES, value.voices)) return null;

  if (!Array.isArray(value.contentTypes)) return null;
  const contentTypes = value.contentTypes.filter((c): c is ContentType => isMember(CONTENT_TYPES, c));
  if (contentTypes.length === 0) return null;

  if (!Array.isArray(value.regulations)) return null;
  const regulations = value.regulations.filter((r): r is Regulation => isMember(REGULATIONS, r));
  if (regulations.length === 0) return null;

  if (!isRecord(value.modules)) return null;
  const modules: Record<ModuleId, number> = { ...DEFAULT_PROFILE.modules };
  for (const id of MODULE_IDS) {
    const level = value.modules[id];
    if (typeof level === "number" && Number.isFinite(level) && level >= 0) modules[id] = level;
  }

  // Champs riches (mediaNeeds/backup/residency/freeNotes/otherText/preferSovereign) : repris tels quels
  // s'ils sont présents. Le moteur les valide à l'usage (champs optionnels, repli sur défauts). On part
  // de DEFAULT_PROFILE pour qu'un lien plus ancien (sans un champ ajouté depuis) reste rejouable.
  const profile: Profile = {
    ...DEFAULT_PROFILE,
    activity: value.activity,
    continent: isMember(CONTINENTS, value.continent) ? value.continent : DEFAULT_PROFILE.continent,
    country: typeof value.country === "string" && value.country.length > 0 ? value.country : DEFAULT_PROFILE.country,
    zone: value.zone,
    users: value.users,
    contentTypes,
    volume: value.volume,
    growth: value.growth,
    regulations,
    sensitivity: value.sensitivity,
    audit: value.audit,
    bitemporal: value.bitemporal,
    techLevel: value.techLevel,
    budget: value.budget,
    reqPerDay: value.reqPerDay,
    latency: value.latency,
    voices: value.voices,
    modules,
  };
  if (Array.isArray(value.mediaNeeds)) {
    const needs = value.mediaNeeds
      .map((n) => mediaNeedFromUnknown(n))
      .filter((n): n is MediaNeed => n !== null);
    if (needs.length > 0) profile.mediaNeeds = needs;
  }
  const backup = backupFromUnknown(value.backup);
  if (backup !== null) profile.backup = backup;
  const residency = residencyFromUnknown(value.residency);
  if (residency !== null) profile.residency = residency;
  const freeNotes = freeNotesFromUnknown(value.freeNotes);
  if (freeNotes !== null) profile.freeNotes = freeNotes;
  const otherText = otherTextFromUnknown(value.otherText);
  if (otherText !== null) profile.otherText = otherText;
  if (typeof value.preferSovereign === "boolean") profile.preferSovereign = value.preferSovereign;
  return profile;
}

/** Sérialise un `Profile` en chaîne base64 URL-safe pour `/resultats?p=<...>` (stateless). */
export function encodeProfileToParam(profile: Profile): string {
  return toBase64Url(JSON.stringify(profile));
}

/**
 * Décode le paramètre `?p=` en `Profile`, ou `null` si invalide (base64/JSON cassé, forme non-Profile).
 * Ne lève JAMAIS : repli gracieux côté appelant (localStorage).
 */
export function decodeProfileFromParam(param: string): Profile | null {
  if (typeof param !== "string" || param.length === 0) return null;
  let json: string;
  try {
    json = fromBase64Url(param);
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  return profileFromUnknown(parsed);
}
