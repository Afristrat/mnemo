import { NextResponse } from "next/server";
import { getLivePricesCached } from "@/lib/pricing/live-feed";
import { priceChangesFromLiveItems } from "@/lib/pricing/price-watch";
import { buildVendorAlerts } from "@/lib/network/alerts";
import { persistVendorAlerts } from "@/lib/network/vendor-alerts-persist";

// Réseau actif (F13, S-084) : GET → veille prix live (S-025), détection des variations vendor vs la
// baseline datée, construction des alertes SOURCÉES (buildVendorAlerts) + persistance de l'audit
// (broadcast global, non bloquante). DÉFCON 1 : une alerte est un FAIT chiffré et sourcé. La clé du
// scraper reste serveur. Renvoie `{ alerts, persisted }` ; `summary` est un descripteur i18n (résolu
// côté client par useEngineText). Ne lève jamais : indispo/aberration → liste vide (gracieux).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const feed = await getLivePricesCached({ apiKey: process.env.FIRECRAWL_API_KEY });
    const changes = priceChangesFromLiveItems(feed.items);
    const alerts = buildVendorAlerts(changes);
    // Persistance de l'audit du broadcast (service-role, non bloquante) ; 0 si aucune alerte.
    const persisted = await persistVendorAlerts(alerts);
    return NextResponse.json({ alerts, persisted, generatedAt: feed.generatedAt });
  } catch {
    return NextResponse.json({ alerts: [], persisted: 0 });
  }
}
