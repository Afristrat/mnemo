import { NextResponse } from "next/server";
import { getLivePricesCached } from "@/lib/pricing/live-feed";
import { priceChangesFromLiveItems } from "@/lib/pricing/price-watch";
import { buildVendorAlerts } from "@/lib/network/alerts";
import { persistVendorAlerts } from "@/lib/network/vendor-alerts-persist";
import { checkCronAuth } from "@/lib/utils/cron-auth";

// Veille vendor PLANIFIÉE (F13, S-084) : déclencheur cron (scheduled task Coolify, toutes les ~6 h
// alignées sur le TTL du feed) qui rafraîchit la veille prix, détecte les variations vs baseline datée
// et PERSISTE le broadcast d'alertes (audit, dédup par cercle/vendor/poste/date). Rend le « réseau actif »
// réellement actif, sans visite. Protégé par CRON_SECRET (header Authorization: Bearer …) : secret non
// configuré → 503 (désactivé), header absent/incorrect → 401. DÉFCON 1 : alerte = fait chiffré et sourcé.
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
  try {
    const feed = await getLivePricesCached({ apiKey: process.env.FIRECRAWL_API_KEY });
    const changes = priceChangesFromLiveItems(feed.items);
    const alerts = buildVendorAlerts(changes);
    const persisted = await persistVendorAlerts(alerts);
    return NextResponse.json({ detected: alerts.length, persisted, generatedAt: feed.generatedAt });
  } catch {
    return NextResponse.json({ detected: 0, persisted: 0 });
  }
}
