import { NextResponse } from "next/server";
import { getLivePricesCached } from "@/lib/pricing/live-feed";
import { priceChangesFromLiveItems } from "@/lib/pricing/price-watch";
import { buildVendorAlerts } from "@/lib/network/alerts";

// Réseau actif (F13, S-084) — LECTURE : GET → veille prix live (S-025, cache), détection des variations
// vendor vs la baseline datée, construction des alertes SOURCÉES. PAS de persistance ici (une consultation
// ne doit pas polluer l'audit) : la persistance est faite par la veille PLANIFIÉE (POST /api/cron/vendor-watch).
// DÉFCON 1 : une alerte est un FAIT chiffré et sourcé. La clé du scraper reste serveur. `summary` est un
// descripteur i18n (résolu côté client par useEngineText). Ne lève jamais : indispo/aberration → liste vide.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const feed = await getLivePricesCached({ apiKey: process.env.FIRECRAWL_API_KEY });
    const changes = priceChangesFromLiveItems(feed.items);
    const alerts = buildVendorAlerts(changes);
    return NextResponse.json({ alerts, generatedAt: feed.generatedAt });
  } catch {
    return NextResponse.json({ alerts: [] });
  }
}
