import { NextResponse } from "next/server";
import { callLLM } from "@/lib/llm/client";
import { buildIntakeMessages, parseIntakeProfile } from "@/lib/llm/intake";
import { DEFAULT_PROFILE } from "@/lib/wizard/defaultProfile";

// Intake libre → Profile (S-038). POST { text } → le LLM EXTRAIT des paramètres (côté serveur, clé
// LITELLM jamais exposée) → `parseIntakeProfile` les VALIDE/BORNE contre les unions du moteur. Le LLM
// ne calcule rien. LLM indisponible → repli profil par défaut prudent (saisie manuelle côté client).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT = 4000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!isRecord(raw) || typeof raw.text !== "string" || raw.text.trim() === "") {
    return NextResponse.json({ error: "Champ « text » requis (description du besoin)" }, { status: 400 });
  }

  const text = raw.text.slice(0, MAX_TEXT);
  const result = await callLLM(buildIntakeMessages(text));
  if (!result.ok) {
    // Repli prudent : profil par défaut, jamais sous-dimensionné. La saisie manuelle reste possible.
    return NextResponse.json({ profile: DEFAULT_PROFILE, applied: [], rejected: ["llm"] });
  }
  return NextResponse.json(parseIntakeProfile(result.content));
}
