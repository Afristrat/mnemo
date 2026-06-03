import { NextResponse } from "next/server";
import { getRegimesForCountriesCached } from "@/lib/legal/regime-feed";
import { persistRegimeObservations } from "@/lib/legal/regime-persist";
import { loadActivePrompt } from "@/lib/prompts/store";
import { enforceRateLimit } from "@/lib/api/rate-limit-guard";

// Veille des régimes réglementaires par pays (S-077) : POST { country, residences[] } → régimes
// applicables sourcés (seed∪live, repli seed garanti). Un régime suit souvent la résidence des personnes,
// pas l'hébergement → on prend en compte le pays cible ET les pays de résidence des clients. Recherche
// web + lecture LiteLLM côté SERVEUR : ni la clé scraper ni la clé LLM ne quittent le serveur. Cache TTL
// court. Jamais d'avis juridique (existence sourcée seulement, « à valider par un conseil »).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim() !== "").map((v) => v.trim());
}

export async function POST(req: Request): Promise<Response> {
  const limited = enforceRateLimit(req, "regimes", 30, 60_000);
  if (limited !== null) return limited;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return NextResponse.json({ error: "Corps requis (objet)" }, { status: 400 });
  }
  const body = raw as Record<string, unknown>;
  const country = typeof body.country === "string" ? body.country.trim() : "";
  if (country === "") {
    return NextResponse.json({ error: "Pays cible requis (country)" }, { status: 400 });
  }
  // Pays cible d'abord, puis pays de résidence des clients (S-077, décision Amine).
  const countries = [country, ...stringList(body.residences)];

  // Prompt de veille régimes éditable par le super-admin (S-053) ; repli sur le gabarit par défaut.
  const systemPrompt = (await loadActivePrompt("regime-veille")) ?? undefined;
  const feed = await getRegimesForCountriesCached(countries, {
    apiKey: process.env.FIRECRAWL_API_KEY,
    systemPrompt,
  });
  // Audit trail (S-077) : trace les régimes découverts par la veille (live), jamais le seed.
  // Gatée + jamais bloquante : un échec d'insertion ne casse pas la réponse.
  await persistRegimeObservations(feed.regimes);
  return NextResponse.json(feed);
}
