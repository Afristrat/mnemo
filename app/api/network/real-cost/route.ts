import { NextResponse } from "next/server";
import { compareRealVsEstimated, type RealCostEntry } from "@/lib/network/real-cost";
import { persistRealCostEntries } from "@/lib/network/real-cost-persist";
import { persistConsent } from "@/lib/network/consent-persist";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/api/rate-limit-guard";

// Network actif (F13, S-082) : POST { entries:[{poste,estimated,real}], consent } → comparaison
// estimé/réel (moteur pur) + persistance de l'audit SI consentement (opt-in F9). Persistance non
// bloquante : un échec d'insertion ne casse pas la réponse. DÉFCON 1 : on logue un FAIT (écart chiffré).
//
// Durcissement (reliquat S-15) : l'insertion passe par le CLIENT DE SESSION (RLS appliquée, plus de
// bypass service-role). Pour un contributeur AUTHENTIFIÉ, on rattache l'écart à son cercle personnel et
// on TRACE le consentement (`network_consents`, horodaté/révocable — base légale RGPD/CNDP). La
// contribution ANONYME reste possible (circle_id null, opt-in `consent:true` requis) mais sans identité
// à inscrire au registre. Le chemin authentifié devient pleinement actif une fois l'auth branchée (S-089).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Valide une saisie de poste (sans `as`) : libellé non vide + montants finis ≥ 0. */
function parseEntry(v: unknown): RealCostEntry | null {
  if (!isRecord(v)) return null;
  const poste = typeof v.poste === "string" ? v.poste.trim() : "";
  if (poste === "") return null;
  if (typeof v.estimated !== "number" || !Number.isFinite(v.estimated) || v.estimated < 0) return null;
  if (typeof v.real !== "number" || !Number.isFinite(v.real) || v.real < 0) return null;
  return { poste, estimated: v.estimated, real: v.real };
}

const MAX_ENTRIES = 50;

export async function POST(req: Request): Promise<Response> {
  const limited = enforceRateLimit(req, "real-cost", 60, 60_000);
  if (limited !== null) return limited;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!isRecord(raw) || !Array.isArray(raw.entries)) {
    return NextResponse.json({ error: "Corps requis : { entries: [...] }" }, { status: 400 });
  }
  const entries: RealCostEntry[] = [];
  for (const e of raw.entries.slice(0, MAX_ENTRIES)) {
    const parsed = parseEntry(e);
    if (parsed !== null) entries.push(parsed);
  }
  if (entries.length === 0) {
    return NextResponse.json({ error: "Aucun poste valide" }, { status: 400 });
  }
  const comparison = compareRealVsEstimated(entries);

  // Persistance gatée par le consentement réseau (opt-in F9) ; non bloquante (un souci d'infra
  // Supabase ne casse pas la réponse de comparaison — qui reste le service rendu).
  let persisted = 0;
  if (raw.consent === true) {
    try {
      const supabase = await createClient();
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      // Contributeur authentifié : rattacher à son cercle personnel + tracer le consentement (RGPD).
      let circleId: string | null = null;
      if (userId !== null) {
        const { data: circles } = await supabase
          .from("circles")
          .select("id")
          .eq("owner_id", userId)
          .limit(1);
        circleId = circles?.[0]?.id ?? null;
        if (circleId !== null) {
          await persistConsent(supabase, { circleId, userId, consented: true });
        }
      }

      const checkedAt = new Date().toISOString().slice(0, 10);
      persisted = await persistRealCostEntries(comparison, {
        client: supabase,
        circleId,
        createdBy: userId,
        checkedAt,
      });
    } catch {
      persisted = 0;
    }
  }
  return NextResponse.json({ comparison, persisted });
}
