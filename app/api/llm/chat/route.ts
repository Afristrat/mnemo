import { NextResponse } from "next/server";
import { defaultLocale, isLocale, promptLanguageNames } from "@/i18n/config";
import { buildChatMessages, type ChatTurn } from "@/lib/llm/assistant";
import { callLLM } from "@/lib/llm/client";
import { searchWeb, type WebSearchResult } from "@/lib/pricing/scraper";
import { loadActivePrompt } from "@/lib/prompts/store";
import { enforceRateLimit } from "@/lib/api/rate-limit-guard";

// Assistant Q&A contextuel (S-040). POST { question, history?, recoFacts? } → recherche web Firecrawl
// (sourcée) + appel LLM (clés SERVEUR uniquement) → { ok, answer, sources }. DÉFCON 1 : seuls les FAITS
// de la recommandation (chiffres affichés à l'utilisateur) sont des montants autorisés ; toute info hors
// reco s'appuie sur les résultats web fournis (URL citée). LLM KO / clé absente → repli prudent.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUESTION = 2000;
const MAX_HISTORY = 12;
const MAX_FACTS = 6000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Valide/borne l'historique reçu (rôles user/assistant, contenu texte). */
function parseHistory(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return [];
  const out: ChatTurn[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const role = item.role;
    const content = item.content;
    if ((role === "user" || role === "assistant") && typeof content === "string" && content.trim() !== "") {
      out.push({ role, content: content.slice(0, MAX_QUESTION) });
    }
  }
  return out.slice(-MAX_HISTORY);
}

export async function POST(req: Request): Promise<Response> {
  const limited = enforceRateLimit(req, "chat", 30, 60_000);
  if (limited !== null) return limited;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "JSON invalide" }, { status: 400 });
  }
  if (!isRecord(raw) || typeof raw.question !== "string" || raw.question.trim() === "") {
    return NextResponse.json({ ok: false, reason: "Champ « question » requis" }, { status: 400 });
  }

  const question = raw.question.slice(0, MAX_QUESTION);
  const history = parseHistory(raw.history);
  const recoFacts = typeof raw.recoFacts === "string" ? raw.recoFacts.slice(0, MAX_FACTS) : "(recommandation non fournie)";

  // Recherche web sourcée (repli [] si clé absente ou échec) pour les questions hors recommandation.
  let webResults: WebSearchResult[] = [];
  try {
    webResults = await searchWeb(question, 4, { apiKey: process.env.FIRECRAWL_API_KEY });
  } catch {
    webResults = [];
  }

  // Locale active (S-059) → langue de réponse de l'assistant (lue du body, validée, repli défaut).
  const rawLocale = typeof raw.locale === "string" ? raw.locale : undefined;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;

  const template = (await loadActivePrompt("assistant")) ?? undefined;
  const messages = buildChatMessages(question, history, recoFacts, webResults, template, promptLanguageNames[locale]);
  const result = await callLLM(messages);
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason, sources: webResults }, { status: 200 });
  }
  return NextResponse.json({ ok: true, answer: result.content, sources: webResults });
}
