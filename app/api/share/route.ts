import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { decodeProfileFromParam } from "@/lib/share";
import { createClient } from "@/lib/supabase/server";

// Partage par lien court (S-067). POST { encoded } → valide la chaîne encodée (doit décoder en un vrai
// Profile, DÉFCON 1 : on ne stocke pas n'importe quel texte), insère une ligne `shared_reco` (RLS : anon
// peut INSERT) → renvoie l'id imprévisible. Le lien court `/resultats?s=<id>` charge ensuite le profil via
// GET /api/share/[id] (RPC SECURITY DEFINER). Aucune clé secrète : le client de session (anon) suffit.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ENCODED = 20000;

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
  if (!isRecord(raw) || typeof raw.encoded !== "string" || raw.encoded.length === 0) {
    return NextResponse.json({ error: "Champ « encoded » requis" }, { status: 400 });
  }
  const encoded = raw.encoded.slice(0, MAX_ENCODED);
  // Garde-fou : on ne stocke un lien court QUE si la chaîne décode en un Profile valide.
  if (decodeProfileFromParam(encoded) === null) {
    return NextResponse.json({ error: "Profil encodé invalide" }, { status: 400 });
  }

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ error: "Service de partage indisponible" }, { status: 503 });
  }

  const { data: userData } = await supabase.auth.getUser();
  const createdBy = userData.user?.id ?? null;

  // On GÉNÈRE l'id côté serveur et on insère SANS clause RETURNING (`.select()`). La table `shared_reco`
  // n'expose aucune politique SELECT à `anon` (lecture réservée à la RPC SECURITY DEFINER `get_shared_reco`,
  // par id imprévisible — anti-énumération). Or sous PostgreSQL un `INSERT ... RETURNING` est soumis à la
  // politique SELECT : réclamer l'id en retour ferait échouer l'insert anonyme (« new row violates RLS
  // policy »). En fournissant nous-mêmes l'uuid, on n'a plus à relire la ligne — le moat reste intact.
  const id = randomUUID();
  const { error } = await supabase
    .from("shared_reco")
    .insert({ id, circle_id: null, created_by: createdBy, encoded });
  if (error !== null) {
    return NextResponse.json({ error: "Création du lien impossible" }, { status: 503 });
  }
  return NextResponse.json({ id });
}
