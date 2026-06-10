import { NextResponse } from "next/server";
import { recommend, type Profile } from "@/lib/engine";
import { profileFromUnknown } from "@/lib/share";
import { searchWeb, type WebSearchResult } from "@/lib/pricing/scraper";
import { callLLM, type LlmMessage, type LlmResult } from "@/lib/llm";
import { gatherCitations } from "@/lib/evidence/citations";
import { buildEvidencePack } from "@/lib/evidence/pack";
import { persistEvidenceObservations } from "@/lib/evidence/persist";
import { enforceRateLimit } from "@/lib/api/rate-limit-guard";

// Feature A — citations sourcées : POST { profile } → reco recalculée serveur → claims (coût/juridique/SLA/
// provider) → SearXNG+LLM (serveur) → pack scellé (MD/JSON + SHA-256). Audit live non bloquant. Rate-limité.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(req: Request): Promise<Response> {
  const limited = enforceRateLimit(req, "evidence-citations", 12, 60_000);
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

  const reco = recommend(profile);
  const generatedAt = new Date().toISOString().slice(0, 10);
  const deps = {
    search: (query: string, limit: number): Promise<WebSearchResult[]> =>
      searchWeb(query, limit, { apiKey: process.env.CRAWL4AI_API_TOKEN }),
    llm: (messages: LlmMessage[]): Promise<LlmResult> => callLLM(messages),
  };

  const items = await gatherCitations(profile, reco, deps, generatedAt);
  const pack = await buildEvidencePack(items, "Sources & preuves");
  await persistEvidenceObservations(items, { integrityHash: pack.integrityHash });

  return NextResponse.json({ items, markdown: pack.markdown, integrityHash: pack.integrityHash, generatedAt });
}
