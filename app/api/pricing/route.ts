import { NextResponse } from "next/server";
import { refreshAllPricing } from "@/lib/pricing/feed";

// Le price feed interroge Firecrawl côté serveur : la clé reste secrète, jamais
// exposée au client. Dynamique (pas de pré-rendu) ; le cache TTL vit dans le feed.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const observations = await refreshAllPricing({ apiKey: process.env.FIRECRAWL_API_KEY });
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    observations,
  });
}
