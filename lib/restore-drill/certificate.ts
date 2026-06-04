// Modèle + vérification du certificat de Restore Drill — PUR (Web Crypto isomorphe). DÉFCON 1 : Strate ne
// fabrique JAMAIS un RTO ; elle VÉRIFIE le certificat produit par le drill (local sur données réelles, ou
// CI jetable sur données synthétiques). Le hash certifie l'intégrité (un tiers recalcule et compare).

import { computeIntegrityHash } from "@/lib/decision/integrity";

export const CERTIFICATE_VERSION = 1;

/** Étapes de la checklist de restauration (ordre = ordre d'exécution du drill). */
export const CHECKLIST_IDS = ["servicesUp", "dumpReloaded", "reembedReplayable", "queryAnswers"] as const;
export type ChecklistId = (typeof CHECKLIST_IDS)[number];

export type RestoreCertificate = {
  version: number;
  /** Date d'émission du certificat (ISO) — produite par le drill. */
  generatedAt: string;
  /** `local` : drill manuel sur les vraies données. `ci` : répétition à blanc automatisée. */
  mode: "local" | "ci";
  /** `real` : données réelles du client. `synthetic` : jeu de démo (RTO non représentatif). */
  dataset: "real" | "synthetic";
  checklist: { id: ChecklistId; passed: boolean }[];
  /** RTO mesuré (minutes, wall-clock) — jamais fabriqué par Strate. */
  rtoMinutes: number;
  /** Empreinte d'intégrité (hash de tout le reste, clé exclue). */
  integrityHash?: string;
};

export type RestoreVerdict = {
  valid: boolean;
  integrityOk: boolean;
  allPassed: boolean;
  rtoMinutes: number | null;
  dataset: "real" | "synthetic" | null;
  mode: "local" | "ci" | null;
  passedCount: number;
  totalCount: number;
  issues: string[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isChecklistId(v: unknown): v is ChecklistId {
  return typeof v === "string" && (CHECKLIST_IDS as readonly string[]).includes(v);
}

/** Borne un JSON inconnu en `RestoreCertificate` (anti-injection ; jamais de `as` brut, jamais de throw). */
function parseCertificate(raw: unknown): { cert: RestoreCertificate | null; issues: string[] } {
  const issues: string[] = [];
  if (!isRecord(raw)) return { cert: null, issues: ["certificat absent ou non-objet"] };
  const mode = raw.mode === "local" || raw.mode === "ci" ? raw.mode : null;
  const dataset = raw.dataset === "real" || raw.dataset === "synthetic" ? raw.dataset : null;
  const rtoMinutes = typeof raw.rtoMinutes === "number" && Number.isFinite(raw.rtoMinutes) ? raw.rtoMinutes : null;
  const generatedAt = typeof raw.generatedAt === "string" ? raw.generatedAt : null;
  const version = typeof raw.version === "number" ? raw.version : null;
  const integrityHash = typeof raw.integrityHash === "string" ? raw.integrityHash : null;
  if (mode === null) issues.push("mode invalide (local|ci)");
  if (dataset === null) issues.push("dataset invalide (real|synthetic)");
  if (rtoMinutes === null) issues.push("rtoMinutes invalide");
  if (generatedAt === null) issues.push("generatedAt invalide");
  if (version === null) issues.push("version invalide");
  if (!Array.isArray(raw.checklist)) {
    issues.push("checklist invalide");
    return { cert: null, issues };
  }
  const checklist: { id: ChecklistId; passed: boolean }[] = [];
  for (const item of raw.checklist) {
    if (isRecord(item) && isChecklistId(item.id) && typeof item.passed === "boolean") {
      checklist.push({ id: item.id, passed: item.passed });
    }
  }
  if (mode === null || dataset === null || rtoMinutes === null || generatedAt === null || version === null) {
    return { cert: null, issues };
  }
  return {
    cert: { version, generatedAt, mode, dataset, checklist, rtoMinutes, ...(integrityHash === null ? {} : { integrityHash }) },
    issues,
  };
}

/** Recalcule le hash canonique du certificat (clé `integrityHash` exclue) et le compare à l'empreinte publiée. */
async function checkIntegrity(cert: RestoreCertificate): Promise<boolean> {
  if (cert.integrityHash === undefined) return false;
  const { integrityHash: _omit, ...body } = cert;
  const recomputed = await computeIntegrityHash(body);
  return recomputed === cert.integrityHash;
}

/** Vérifie un certificat inconnu (intégrité + checklist complète). Total, ne lève jamais. */
export async function verifyCertificate(raw: unknown): Promise<RestoreVerdict> {
  const { cert, issues } = parseCertificate(raw);
  if (cert === null) {
    return {
      valid: false,
      integrityOk: false,
      allPassed: false,
      rtoMinutes: null,
      dataset: null,
      mode: null,
      passedCount: 0,
      totalCount: CHECKLIST_IDS.length,
      issues,
    };
  }
  const integrityOk = await checkIntegrity(cert);
  const passedCount = cert.checklist.filter((c) => c.passed).length;
  const allPassed = CHECKLIST_IDS.every((id) => cert.checklist.find((c) => c.id === id)?.passed === true);
  if (!integrityOk) issues.push("empreinte d'intégrité invalide (certificat altéré ou non scellé)");
  if (!allPassed) issues.push("checklist incomplète (au moins une étape de restauration a échoué)");
  return {
    valid: integrityOk && allPassed,
    integrityOk,
    allPassed,
    rtoMinutes: cert.rtoMinutes,
    dataset: cert.dataset,
    mode: cert.mode,
    passedCount,
    totalCount: CHECKLIST_IDS.length,
    issues,
  };
}
