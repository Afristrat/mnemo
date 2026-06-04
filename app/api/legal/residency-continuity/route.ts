import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/api/rate-limit-guard";
import { persistContinuityObservation } from "@/lib/residency/continuity-persist";
import { computeIntegrityHash } from "@/lib/decision/integrity";
import type { ResidencyContinuityReport } from "@/lib/residency/continuity";

// Persistance de l'audit de continuité de résidence (S-095, vague 2 #3). POST { report } → re-hash serveur
// + insertion RLS (circle anonyme : circle_id null). Non bloquant, jamais d'avis juridique. Le rapport est
// calculé côté client (panneau) à partir de la reco ; la route ne fait que sceller + persister l'audit.
// Rate-limitée comme les autres routes anonymes coûteuses (S-093).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isReport(v: unknown): v is ResidencyContinuityReport {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const r = v as Record<string, unknown>;
  return typeof r.primaryRegion === "string" && Array.isArray(r.components) && typeof r.generatedAt === "string";
}

export async function POST(req: Request): Promise<Response> {
  const limited = enforceRateLimit(req, "residency-continuity", 30, 60_000);
  if (limited !== null) return limited;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const report = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>).report : null;
  if (!isReport(report)) return NextResponse.json({ error: "report invalide" }, { status: 400 });
  // Re-hash serveur (jamais confiance au hash client) puis persistance non bloquante.
  const integrityHash = await computeIntegrityHash(report);
  const persisted = await persistContinuityObservation(report, integrityHash);
  return NextResponse.json({ persisted, integrityHash });
}
