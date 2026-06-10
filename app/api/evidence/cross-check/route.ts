import { NextResponse } from "next/server";
import { searchWeb, type WebSearchResult } from "@/lib/pricing/scraper";
import { callLLM, type LlmMessage, type LlmResult } from "@/lib/llm";
import { runCrossCheck, type CrossCheckType } from "@/lib/evidence/cross-check";
import { persistEvidenceObservations } from "@/lib/evidence/persist";
import { enforceRateLimit } from "@/lib/api/rate-limit-guard";

// Feature C — vérification d'authenticité : POST { artefact, type } → confronte l'artefact client aux sources
// publiques (SearXNG+LLM). Audit live non bloquant. Rate-limité. 'mismatch' = incohérence, pas une fraude.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: readonly CrossCheckType[] = ["provider-cert", "status-page", "legal-mention"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function isType(v: unknown): v is CrossCheckType {
  return typeof v === "string" && (TYPES as readonly string[]).includes(v);
}

export async function POST(req: Request): Promise<Response> {
  const limited = enforceRateLimit(req, "evidence-cross-check", 12, 60_000);
  if (limited !== null) return limited;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!isRecord(raw)) return NextResponse.json({ error: "Corps requis (objet)" }, { status: 400 });
  if (!isType(raw.type)) return NextResponse.json({ error: "Type invalide" }, { status: 400 });
  const artefact = typeof raw.artefact === "string" ? raw.artefact : "";

  const generatedAt = new Date().toISOString().slice(0, 10);
  const deps = {
    search: (q: string, n: number): Promise<WebSearchResult[]> => searchWeb(q, n, { apiKey: process.env.CRAWL4AI_API_TOKEN }),
    llm: (m: LlmMessage[]): Promise<LlmResult> => callLLM(m),
  };
  const ev = await runCrossCheck(artefact, raw.type, deps, generatedAt);
  await persistEvidenceObservations([ev]);
  return NextResponse.json(ev);
}
