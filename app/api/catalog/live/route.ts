import { NextResponse } from "next/server";
import { getLiveCatalogCached } from "@/lib/catalog/cache";
import { loadActivePrompt } from "@/lib/prompts/store";
import { DEFAULT_PROFILE } from "@/lib/wizard/defaultProfile";
import type { Profile } from "@/lib/engine";

// Veille temps réel du catalogue (S-036) : POST profil → Catalog (un candidat sourcé par couche,
// repli seed garanti). Recherche web Firecrawl + synthèse LiteLLM côté SERVEUR : ni la clé Firecrawl
// ni la clé LLM ne quittent le serveur. Le navigateur ne parle qu'à cette route. Cache TTL court.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return NextResponse.json({ error: "Profil requis (objet)" }, { status: 400 });
  }
  // Profil reconstruit sur les défauts (champs manquants comblés), comme la reprise localStorage.
  const profile: Profile = { ...DEFAULT_PROFILE, ...raw };
  // Prompt de veille éditable par le super-admin (S-053) ; repli sur le gabarit par défaut si store vide.
  const systemPrompt = (await loadActivePrompt("catalog-veille")) ?? undefined;
  const catalog = await getLiveCatalogCached(profile, { apiKey: process.env.FIRECRAWL_API_KEY, systemPrompt });
  return NextResponse.json(catalog);
}
