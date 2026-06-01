import { NextResponse } from "next/server";
import { compareRealVsEstimated, type RealCostEntry } from "@/lib/network/real-cost";
import { persistRealCostEntries } from "@/lib/network/real-cost-persist";

// Network actif (F13, S-082) : POST { entries:[{poste,estimated,real}], consent } → comparaison
// estimé/réel (moteur pur) + persistance de l'audit SI consentement (opt-in F9). Persistance non
// bloquante : un échec d'insertion ne casse pas la réponse. DÉFCON 1 : on logue un FAIT (écart chiffré).
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

export async function POST(req: Request): Promise<Response> {
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
  for (const e of raw.entries) {
    const parsed = parseEntry(e);
    if (parsed !== null) entries.push(parsed);
  }
  if (entries.length === 0) {
    return NextResponse.json({ error: "Aucun poste valide" }, { status: 400 });
  }
  const comparison = compareRealVsEstimated(entries);

  // Persistance gatée par le consentement réseau (opt-in F9) ; non bloquante.
  let persisted = 0;
  if (raw.consent === true) {
    const checkedAt = new Date().toISOString().slice(0, 10);
    persisted = await persistRealCostEntries(comparison, { checkedAt });
  }
  return NextResponse.json({ comparison, persisted });
}
