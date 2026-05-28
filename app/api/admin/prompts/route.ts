import { NextResponse } from "next/server";
import { DEFAULT_PROMPTS, isPromptKey, PROMPT_META, PROMPT_KEYS } from "@/lib/prompts/registry";
import { activateNewVersion, listPromptVersions } from "@/lib/prompts/store";
import { createClient } from "@/lib/supabase/server";

// Console admin (S-053) : gestion des prompts système versionnés. Toutes les opérations exigent un
// SUPER-ADMIN (rôle global, hors RLS de cercle). La lecture/écriture passe par le client de SESSION
// (createClient) → la RLS `prompts_*_admin` (is_super_admin()) fait foi côté base (défense en
// profondeur). L'app publique, elle, lit le prompt actif en service-role (cf. lib/prompts/store).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Authed = { supabase: Awaited<ReturnType<typeof createClient>>; userId: string };

async function requireSuperAdmin(): Promise<Authed | null> {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    return null; // config Supabase absente → pas d'admin possible
  }
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (user === null) return null;
  const { data } = await supabase.from("super_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  return data === null ? null : { supabase, userId: user.id };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(): Promise<Response> {
  const auth = await requireSuperAdmin();
  if (auth === null) return NextResponse.json({ error: "Accès super-admin requis" }, { status: 403 });
  const versions = await listPromptVersions(auth.supabase);
  return NextResponse.json({ keys: PROMPT_KEYS, meta: PROMPT_META, defaults: DEFAULT_PROMPTS, versions });
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireSuperAdmin();
  if (auth === null) return NextResponse.json({ error: "Accès super-admin requis" }, { status: 403 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!isRecord(raw) || typeof raw.promptKey !== "string" || typeof raw.content !== "string") {
    return NextResponse.json({ error: "Champs « promptKey » et « content » requis" }, { status: 400 });
  }
  if (!isPromptKey(raw.promptKey)) {
    return NextResponse.json({ error: "Clé de prompt inconnue" }, { status: 400 });
  }

  const result = await activateNewVersion(raw.promptKey, raw.content, auth.userId, auth.supabase);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
  return NextResponse.json({ ok: true, version: result.version });
}
