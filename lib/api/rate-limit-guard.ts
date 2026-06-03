// Garde de rate-limit pour les routes API anonymes coûteuses (LLM / scraper) : borne l'abus et le coût
// (appels externes facturés) avant ouverture publique. Renvoie une 429 (avec Retry-After) si la limite
// par IP est dépassée, sinon `null` (la route poursuit). État par instance (lib/utils/rate-limit).

import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/utils/rate-limit";

/** Première IP de la chaîne `x-forwarded-for` (posée par le proxy Coolify), sinon repli neutre. */
function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff !== null && xff.trim() !== "") {
    const first = xff.split(",")[0];
    if (first !== undefined && first.trim() !== "") return first.trim();
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Applique le rate-limit `name` à la requête. `limit` requêtes par `windowMs`. Renvoie une 429 si dépassé,
 * `null` sinon. À appeler en TÊTE du handler : `const limited = enforceRateLimit(req, "catalog", 30, 60_000); if (limited) return limited;`.
 */
export function enforceRateLimit(req: Request, name: string, limit: number, windowMs: number): NextResponse | null {
  const verdict = rateLimit(`${name}:${clientIp(req)}`, limit, windowMs, Date.now());
  if (verdict.ok) return null;
  return NextResponse.json(
    { error: "Trop de requêtes. Réessayez dans un instant." },
    { status: 429, headers: { "Retry-After": String(verdict.retryAfterSec) } },
  );
}
