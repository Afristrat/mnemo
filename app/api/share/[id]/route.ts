import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Partage par lien court (S-067). GET /api/share/[id] → lit la ligne `shared_reco` par id IMPRÉVISIBLE
// via la RPC SECURITY DEFINER get_shared_reco (jamais d'énumération en masse) → renvoie la chaîne encodée
// que `/resultats?s=<id>` décode côté client en Profile. Aucune clé secrète : client de session (anon).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  }

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ error: "Service de partage indisponible" }, { status: 503 });
  }

  const { data, error } = await supabase.rpc("get_shared_reco", { reco_id: id });
  if (error !== null) {
    return NextResponse.json({ error: "Lecture impossible" }, { status: 503 });
  }
  const row = Array.isArray(data) ? data[0] : null;
  if (row === undefined || row === null) {
    return NextResponse.json({ error: "Lien introuvable" }, { status: 404 });
  }
  return NextResponse.json({ encoded: row.encoded });
}
