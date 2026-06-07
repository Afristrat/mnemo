import { NextResponse } from "next/server";
import { buildLead, isValidEmail, isValidName } from "@/lib/conversion/log";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/api/rate-limit-guard";

// Lead gate (S-068). POST { name, email, preset? } → valide nom + e-mail (DÉFCON 1 : on ne stocke
// pas n'importe quel texte), insère une ligne `leads` (RLS : anon peut INSERT) → renvoie { ok: true }.
// Aucune clé secrète : le client de session (anon) suffit. Repli gracieux côté client (LeadGate) :
// un échec réseau/persistance NE bloque PAS le déverrouillage — l'utilisateur n'est jamais retenu.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(req: Request): Promise<Response> {
  const limited = enforceRateLimit(req, "lead", 15, 60_000);
  if (limited !== null) return limited;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!isRecord(raw) || typeof raw.name !== "string" || typeof raw.email !== "string") {
    return NextResponse.json({ error: "Champs « name » et « email » requis" }, { status: 400 });
  }
  if (!isValidName(raw.name) || !isValidEmail(raw.email)) {
    return NextResponse.json({ error: "Nom ou e-mail invalide" }, { status: 400 });
  }
  const preset = typeof raw.preset === "string" && raw.preset.length > 0 ? raw.preset.slice(0, 32) : null;

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ error: "Service de capture indisponible" }, { status: 503 });
  }

  const { data: userData } = await supabase.auth.getUser();
  const createdBy = userData.user?.id ?? null;

  const { error } = await supabase
    .from("leads")
    .insert(buildLead({ name: raw.name, email: raw.email, preset, createdBy }));
  if (error !== null) {
    return NextResponse.json({ error: "Enregistrement impossible" }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
