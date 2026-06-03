import { NextResponse } from "next/server";
import { CONTINENTS, type Continent } from "@/lib/engine";
import { getProvidersForCountryCached } from "@/lib/residency/discovery-cache";
import { DEFAULT_PROFILE } from "@/lib/wizard/defaultProfile";
import { profileFromUnknown } from "@/lib/share";
import { enforceRateLimit } from "@/lib/api/rate-limit-guard";

// Découverte de fournisseurs par PAYS CIBLE (S-073, T3) : POST { profile, country, continent } →
// liste de fournisseurs sourcés, conformes aux contraintes utilisateur (S-072, ABSOLUES), repli annuaire
// seed garanti. Recherche web (SearXNG/Crawl4AI) + synthèse LiteLLM côté SERVEUR : aucune clé exposée.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asContinent(value: unknown): Continent | null {
  return CONTINENTS.find((c) => c === value) ?? null;
}

export async function POST(req: Request): Promise<Response> {
  const limited = enforceRateLimit(req, "providers", 30, 60_000);
  if (limited !== null) return limited;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!isRecord(raw)) {
    return NextResponse.json({ error: "Corps requis (objet)" }, { status: 400 });
  }
  const body = raw;
  const continent = asContinent(body.continent);
  if (continent === null) {
    return NextResponse.json({ error: "continent requis (europe|north-america|latam|africa|middle-east|apac)" }, { status: 400 });
  }
  const country = typeof body.country === "string" && body.country.trim() !== "" ? body.country.trim() : null;
  if (country === null) {
    return NextResponse.json({ error: "country requis (pays cible)" }, { status: 400 });
  }
  // Validation stricte (unions bornées) : un profil malformé/hostile ne se propage pas dans la veille
  // (anti-injection) — repli prudent sur le profil par défaut.
  const profile = profileFromUnknown(body.profile) ?? DEFAULT_PROFILE;

  const result = await getProvidersForCountryCached(country, continent, profile, {
    apiKey: process.env.CRAWL4AI_API_TOKEN,
  });
  return NextResponse.json(result);
}
