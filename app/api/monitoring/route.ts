import { NextResponse } from "next/server";
import { HEALTH_DIMENSIONS, type HealthSnapshot, type HealthStatus, type HealthDimension } from "@/lib/monitoring/health";
import { persistHealthMetric } from "@/lib/monitoring/persist";
import { enforceRateLimit } from "@/lib/api/rate-limit-guard";

// Monitoring (F12, S-081) : POST d'un snapshot d'Infra Health Score → persistance de l'audit
// (health_metrics, RLS). Le snapshot est calculé côté client (moteurs purs S-079/S-080) ; on logue le
// relevé observé. Persistance NON BLOQUANTE : un échec d'insertion ne casse pas la réponse.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isStatus(v: unknown): v is HealthStatus {
  return v === "ok" || v === "warn" || v === "critical" || v === "unknown";
}
function isDimension(v: unknown): v is HealthDimension {
  return typeof v === "string" && (HEALTH_DIMENSIONS as readonly string[]).includes(v);
}
function isScore(v: unknown): v is number | null {
  return v === null || (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100);
}
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Valide un snapshot reçu (sans `as`) : format strict, dimensions/statuts connus, scores bornés. */
function parseSnapshot(raw: unknown): HealthSnapshot | null {
  if (!isRecord(raw)) return null;
  if (!isStatus(raw.status)) return null;
  if (!isScore(raw.score)) return null;
  if (typeof raw.measured !== "number" || typeof raw.total !== "number") return null;
  if (!Array.isArray(raw.subscores)) return null;
  const subscores: HealthSnapshot["subscores"] = [];
  for (const s of raw.subscores) {
    if (!isRecord(s) || !isDimension(s.dimension) || !isStatus(s.status) || !isScore(s.score)) return null;
    subscores.push({ dimension: s.dimension, score: s.score, status: s.status });
  }
  return { score: raw.score, status: raw.status, measured: raw.measured, total: raw.total, subscores };
}

export async function POST(req: Request): Promise<Response> {
  const limited = enforceRateLimit(req, "monitoring", 60, 60_000);
  if (limited !== null) return limited;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const snapshot = parseSnapshot(raw);
  if (snapshot === null) {
    return NextResponse.json({ error: "Snapshot de santé invalide" }, { status: 400 });
  }
  const checkedAt = new Date().toISOString().slice(0, 10);
  // Audit non bloquant : un échec d'insertion (table absente en prod, clé manquante) → 0, réponse OK.
  const written = await persistHealthMetric(snapshot, { checkedAt });
  return NextResponse.json({ ok: true, persisted: written });
}
