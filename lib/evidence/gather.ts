// Cœur de la preuve sourcée (PUR, I/O injectée — calque regime-discovery.ts). Flux :
//   SearXNG (search) → si vide → repli seed ; sinon → LLM borné → JSON {verdict, rationale, sourceUrls}.
// DÉFCON 1 : (1) toute URL citée DOIT ∈ résultats SearXNG (anti-hallucination) ; (2) verdict contraint
// au set autorisé du kind, sinon fallback conservateur ; (3) retrievedAt = date injectée (pas le LLM) ;
// (4) ne lève jamais → repli seed. Confiance live = `low`.

import type { LlmMessage, LlmResult } from "@/lib/llm";
import type { WebSearchResult } from "@/lib/pricing/scraper";
import { seedEvidence } from "./seed";
import {
  FALLBACK_VERDICT,
  type EvidenceClaim,
  type EvidenceKind,
  type EvidenceSource,
  type EvidenceVerdict,
  type SourcedEvidence,
} from "./types";

export type GatherDeps = {
  search: (query: string, limit: number) => Promise<WebSearchResult[]>;
  llm: (messages: LlmMessage[]) => Promise<LlmResult>;
  /** Prompt système surchargeable (S-053) ; repli sur le gabarit par kind. */
  systemPrompt?: string;
};

/** Verdicts autorisés par kind (contrainte DÉFCON sur la sortie LLM). */
const VERDICTS_BY_KIND: Record<EvidenceKind, readonly EvidenceVerdict[]> = {
  citation: ["attested", "unattested"],
  external_drift: ["stable", "changed", "unknown"],
  cross_check: ["match", "mismatch", "unverifiable"],
};

const SYSTEM_BY_KIND: Record<EvidenceKind, string> = {
  citation:
    "ROLE: evidence checker. From the web results, decide if the CLAIM is attested by a credible public source. " +
    "Return ONLY JSON {verdict: 'attested'|'unattested', rationale: string (1 sentence), sourceUrls: string[]}. " +
    "Cite ONLY urls present in the results. Never invent a url or a fact.",
  external_drift:
    "ROLE: change watcher. Decide if a MATERIAL change happened to the subject SINCE the given date (jurisdiction, " +
    "SLA incident, deprecation, acquisition). Return ONLY JSON {verdict: 'stable'|'changed'|'unknown', rationale: " +
    "string (1 sentence), sourceUrls: string[]}. Cite ONLY urls present in the results. Never invent.",
  cross_check:
    "ROLE: authenticity cross-checker. Compare the EXPECTED claim (from a client artefact) with public web results. " +
    "Return ONLY JSON {verdict: 'match'|'mismatch'|'unverifiable', rationale: string (1 sentence), sourceUrls: string[]}. " +
    "'mismatch' = inconsistent with public sources (NOT a fraud accusation). Cite ONLY urls present in the results.",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function parseVerdict(value: unknown, kind: EvidenceKind): EvidenceVerdict {
  const allowed = VERDICTS_BY_KIND[kind];
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as EvidenceVerdict)
    : FALLBACK_VERDICT[kind];
}

/** Garde les URLs LLM qui existent réellement dans les résultats SearXNG (anti-hallucination). */
function keepRealSources(
  urls: unknown,
  results: readonly WebSearchResult[],
  retrievedAt: string,
): EvidenceSource[] {
  if (!Array.isArray(urls)) return [];
  const out: EvidenceSource[] = [];
  const seen = new Set<string>();
  for (const u of urls) {
    if (typeof u !== "string") continue;
    const match = results.find((r) => r.url === u);
    if (match === undefined || seen.has(u)) continue;
    seen.add(u);
    out.push({ url: match.url, title: match.title, snippet: match.snippet, retrievedAt });
  }
  return out;
}

export async function gatherSourcedEvidence(
  claim: EvidenceClaim,
  deps: GatherDeps,
  generatedAt: string,
): Promise<SourcedEvidence> {
  try {
    const results = await deps.search(claim.query, 8);
    if (results.length === 0) return seedEvidence(claim, generatedAt);

    const sourcesBlock = results.map((r, i) => `[${i + 1}] ${r.title} — ${r.url}\n${r.snippet}`).join("\n");
    const asOf = claim.asOf !== undefined ? `\nSINCE DATE: ${claim.asOf}` : "";
    const expected = claim.expected !== undefined ? `\nEXPECTED CLAIM: ${claim.expected}` : "";
    const user = `SUBJECT: ${claim.subject}${asOf}${expected}\nWeb results:\n${sourcesBlock}`;
    const messages: LlmMessage[] = [
      { role: "system", content: deps.systemPrompt ?? SYSTEM_BY_KIND[claim.kind] },
      { role: "user", content: user },
    ];

    const r = await deps.llm(messages);
    if (!r.ok) return seedEvidence(claim, generatedAt);

    const json = extractJson(r.content);
    if (!isRecord(json)) return seedEvidence(claim, generatedAt);

    const sources = keepRealSources(json.sourceUrls, results, generatedAt);
    const rationale = typeof json.rationale === "string" ? json.rationale.slice(0, 280) : "";
    return {
      claim,
      sources,
      verdict: parseVerdict(json.verdict, claim.kind),
      confidence: "low",
      provenance: "live",
      rationale,
      generatedAt,
    };
  } catch {
    return seedEvidence(claim, generatedAt);
  }
}
