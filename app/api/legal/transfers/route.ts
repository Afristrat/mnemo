import { NextResponse } from "next/server";
import { getLiveTransferBasesCached } from "@/lib/legal/live-feed";
import { loadActivePrompt } from "@/lib/prompts/store";

// Veille live des statuts juridiques de transfert (S-062) : GET → statuts des flux surveillés
// (DPF UE-US, adéquation Maroc) rafraîchis depuis les sources officielles. Recherche web Firecrawl +
// lecture LiteLLM côté SERVEUR : ni la clé Firecrawl ni la clé LLM ne quittent le serveur. Réconciliés
// vs le repli daté (divergent → flaggé « à revérifier »). Repli seed garanti. Cache TTL court.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  // Prompt de veille juridique éditable par le super-admin (S-053) ; repli sur le gabarit par défaut.
  const systemPrompt = (await loadActivePrompt("legal-veille")) ?? undefined;
  const bases = await getLiveTransferBasesCached({ apiKey: process.env.FIRECRAWL_API_KEY, systemPrompt });
  return NextResponse.json({ bases });
}
