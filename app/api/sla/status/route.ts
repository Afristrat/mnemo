import { NextResponse } from "next/server";
import type { HostingClass } from "@/lib/engine";
import { sourcesForClass } from "@/lib/sla/status-source";
import { fetchProviderStatus } from "@/lib/sla/status-feed";
import { seedStatusFor } from "@/lib/sla/status-seed";
import { fetchWithTimeout } from "@/lib/utils/fetchWithTimeout";
import { enforceRateLimit } from "@/lib/api/rate-limit-guard";

// Disponibilité OBSERVÉE (SLA #5) : agrège les pages de statut PUBLIQUES des fournisseurs de la classe
// d'hébergement (JSON Statuspage / Google Cloud) → incidents réels datés. DÉFCON : faits sourcés, jamais
// fabriqués ; chaque fournisseur tombe en repli SEED daté si son endpoint échoue (provenance signalée).
// JSON public → simple fetch borné (pas de scraper : ce ne sont pas des pages HTML anti-bot).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isHostingClass(v: string): v is HostingClass {
  return v === "self-hosted" || v === "sovereign-eu" || v === "secnumcloud" || v === "hyperscaler";
}

export async function GET(req: Request): Promise<Response> {
  const limited = enforceRateLimit(req, "sla-status", 30, 60_000);
  if (limited !== null) return limited;

  const cls = new URL(req.url).searchParams.get("class") ?? "";
  if (!isHostingClass(cls)) {
    return NextResponse.json({ error: "Paramètre « class » invalide" }, { status: 400 });
  }

  const now = new Date();
  const checkedAt = now.toISOString().slice(0, 10);
  // Corps brut (JSON Statuspage/GCP OU XML RSS) ; le parseur adéquat est choisi selon le `kind` de la source.
  const fetchText = async (u: string): Promise<string> => {
    const res = await fetchWithTimeout(u, {}, 8000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  };

  const sources = sourcesForClass(cls);
  const statuses = await Promise.all(
    sources.map((s) => fetchProviderStatus(s, { fetchText, now, seed: seedStatusFor(s, checkedAt) })),
  );
  return NextResponse.json({ statuses, checkedAt });
}
