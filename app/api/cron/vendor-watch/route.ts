import { NextResponse } from "next/server";
import { runVendorWatch } from "@/lib/network/vendor-watch";
import { checkCronAuth } from "@/lib/utils/cron-auth";

// Veille vendor PLANIFIÉE (F13, S-084) — déclenchement MANUEL/EXTERNE (le cycle automatique est armé par
// le scheduler intégré, cf. instrumentation.ts + lib/network/vendor-watch). Un cycle = veille prix →
// variations vs baseline datée → alertes sourcées → persistance d'audit (dédup). Protégé par CRON_SECRET
// (header Authorization: Bearer …) : secret non configuré → 503, header absent/incorrect → 401.
// DÉFCON 1 : alerte = fait chiffré et sourcé.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  const verdict = checkCronAuth(req.headers.get("authorization"), process.env.CRON_SECRET);
  if (verdict === "disabled") {
    return NextResponse.json({ error: "Veille planifiée désactivée (secret non configuré)" }, { status: 503 });
  }
  if (verdict === "unauthorized") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const result = await runVendorWatch();
  return NextResponse.json(result);
}
