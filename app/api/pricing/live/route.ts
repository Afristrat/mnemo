import { NextResponse } from "next/server";
import { getLivePricesCached } from "@/lib/pricing/live-feed";

// Price feed LIVE (S-025) : extraction structurée Firecrawl des prix vendor (GPU/stockage/backup),
// réconciliée vs la baseline sourcée (garde-fou DÉFCON 1). La clé Firecrawl reste serveur.
// Dynamique + cache TTL (dans le feed), pas de pré-rendu.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const feed = await getLivePricesCached({ apiKey: process.env.FIRECRAWL_API_KEY });
  return NextResponse.json(feed);
}
