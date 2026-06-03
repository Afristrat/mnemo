import { NextResponse } from "next/server";
import { getLiveCatalogCached } from "@/lib/catalog/cache";
import { persistCatalogObservations } from "@/lib/catalog/persist";
import { loadActivePrompt } from "@/lib/prompts/store";
import { DEFAULT_PROFILE } from "@/lib/wizard/defaultProfile";
import { profileFromUnknown } from "@/lib/share";
import { enforceRateLimit } from "@/lib/api/rate-limit-guard";

// Veille temps réel du catalogue (S-036) : POST profil → Catalog (un candidat sourcé par couche,
// repli seed garanti). Recherche web Firecrawl + synthèse LiteLLM côté SERVEUR : ni la clé Firecrawl
// ni la clé LLM ne quittent le serveur. Le navigateur ne parle qu'à cette route. Cache TTL court.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const limited = enforceRateLimit(req, "catalog", 30, 60_000);
  if (limited !== null) return limited;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return NextResponse.json({ error: "Profil requis (objet)" }, { status: 400 });
  }
  // Validation stricte (unions bornées) : un profil malformé/hostile ne se propage JAMAIS dans les
  // requêtes web/LLM de la veille (anti-injection) — repli prudent sur le profil par défaut.
  const profile = profileFromUnknown(raw) ?? DEFAULT_PROFILE;
  // Prompt de veille éditable par le super-admin (S-053) ; repli sur le gabarit par défaut si store vide.
  const systemPrompt = (await loadActivePrompt("catalog-veille")) ?? undefined;
  const catalog = await getLiveCatalogCached(profile, { apiKey: process.env.FIRECRAWL_API_KEY, systemPrompt });
  // Audit trail (S-036) : trace ce que la veille a retenu (provenance/source) si elle a contribué.
  // Gatée + jamais bloquante : un échec d'insertion ne casse pas la réponse de la veille.
  await persistCatalogObservations(catalog);
  return NextResponse.json(catalog);
}
