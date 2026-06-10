import { NextResponse } from "next/server";
import { recommend, type Profile } from "@/lib/engine";
import { profileFromUnknown } from "@/lib/share";
import { buildExitBundle } from "@/lib/exit/bundle";
import { searchWeb, type WebSearchResult } from "@/lib/pricing/scraper";
import { callLLM, type LlmMessage, type LlmResult } from "@/lib/llm";
import { runExternalDrift } from "@/lib/evidence/external-drift";
import { persistEvidenceObservations } from "@/lib/evidence/persist";
import { enforceRateLimit } from "@/lib/api/rate-limit-guard";

// Feature B — drift externe : POST { profile, asOf? } → manifeste signé rebâti serveur (resolve par défaut)
// → veille SearXNG+LLM des composants → rapport. Audit live non bloquant. Rate-limité (coût LLM).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export async function POST(req: Request): Promise<Response> {
  const limited = enforceRateLimit(req, "evidence-external-drift", 8, 60_000);
  if (limited !== null) return limited;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!isRecord(raw)) return NextResponse.json({ error: "Corps requis (objet)" }, { status: 400 });

  const profile: Profile | null = profileFromUnknown(raw.profile);
  if (profile === null) return NextResponse.json({ error: "Profil invalide" }, { status: 400 });
  const asOf =
    typeof raw.asOf === "string" && raw.asOf.trim() !== ""
      ? raw.asOf.trim().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

  const reco = recommend(profile);
  const { manifest } = buildExitBundle(profile, reco);
  const generatedAt = new Date().toISOString().slice(0, 10);
  const deps = {
    search: (q: string, n: number): Promise<WebSearchResult[]> => searchWeb(q, n, { apiKey: process.env.CRAWL4AI_API_TOKEN }),
    llm: (m: LlmMessage[]): Promise<LlmResult> => callLLM(m),
  };

  const report = await runExternalDrift(manifest, asOf, deps, generatedAt);
  await persistEvidenceObservations(
    report.signals.map((s) => ({
      claim: { kind: "external_drift" as const, subject: s.subject, query: "", asOf },
      sources: s.sources,
      verdict: s.verdict,
      confidence: s.confidence,
      provenance: s.sources.length > 0 ? ("live" as const) : ("seed" as const),
      rationale: s.rationale,
      generatedAt,
    })),
  );
  return NextResponse.json(report);
}
