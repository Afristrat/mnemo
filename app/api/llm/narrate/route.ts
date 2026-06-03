import { NextResponse } from "next/server";
import { defaultLocale, isLocale, promptLanguageNames } from "@/i18n/config";
import { callLLM } from "@/lib/llm/client";
import { buildNarrateMessages, parseNarration, type NarrationContext, type NarrationTexts } from "@/lib/llm/narrate";
import { loadActivePrompt } from "@/lib/prompts/store";
import { enforceRateLimit } from "@/lib/api/rate-limit-guard";

// Narration LLM (S-039). POST { contexte profil + textes de base } → le LLM réécrit les textes
// narratifs (côté serveur, clé jamais exposée) → `parseNarration` valide (rejette toute réintroduction
// de chiffre → repli). Le LLM ne calcule rien et ne touche aucun montant. LLM KO → repli = textes de base.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseBase(raw: Record<string, unknown>): NarrationTexts | null {
  const base = raw.base;
  if (!isRecord(base)) return null;
  const texts: NarrationTexts = {
    pain: asString(base.pain),
    risk: asString(base.risk),
    gain: asString(base.gain),
    nextStep: asString(base.nextStep),
    presetReason: asString(base.presetReason),
  };
  // Au moins un texte de base requis (sinon rien à narrer).
  const hasContent = Object.values(texts).some((t) => t.length > 0);
  return hasContent ? texts : null;
}

function parseStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((v): v is string => typeof v === "string");
}

export async function POST(req: Request): Promise<Response> {
  const limited = enforceRateLimit(req, "narrate", 30, 60_000);
  if (limited !== null) return limited;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!isRecord(raw)) return NextResponse.json({ error: "Contexte requis (objet)" }, { status: 400 });
  const base = parseBase(raw);
  if (base === null) return NextResponse.json({ error: "Champ « base » requis (textes à réécrire)" }, { status: 400 });

  const ctx: NarrationContext = {
    activity: typeof raw.activity === "string" ? raw.activity : undefined,
    preset: typeof raw.preset === "string" ? raw.preset : undefined,
    sensitivity: typeof raw.sensitivity === "string" ? raw.sensitivity : undefined,
    zone: typeof raw.zone === "string" ? raw.zone : undefined,
    regulations: parseStringArray(raw.regulations),
    notes: parseStringArray(raw.notes),
    base,
  };

  // Locale active (S-059) → langue de sortie user-facing. Lue du body (le client envoie `useLocale()`),
  // validée, repli sur la locale par défaut. La narration produit alors le texte dans cette langue.
  const rawLocale = typeof raw.locale === "string" ? raw.locale : undefined;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const language = promptLanguageNames[locale];

  // Prompt système éditable par le super-admin (S-053) ; repli sur le gabarit par défaut si store vide.
  const template = await loadActivePrompt("narration");
  const result = await callLLM(buildNarrateMessages(ctx, template ?? undefined, language));
  if (!result.ok) {
    // Repli : les textes statiques de base (aucun chiffre touché de toute façon).
    return NextResponse.json(base);
  }
  return NextResponse.json(parseNarration(result.content, base));
}
