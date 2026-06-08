// Disponibilité OBSERVÉE — parseurs PURS des pages de statut publiques (incidents réels, datés) + fetch
// injectable. DÉFCON : on extrait des FAITS publiés (incidents) ; aucune valeur fabriquée ; en cas
// d'échec réseau/format → repli sur un snapshot SEED daté (provenance signalée). Les parseurs sont purs
// → testés avec des fixtures JSON réalistes (synthétique pour le test = OK ; la donnée affichée est live).

import type { StatusKind, StatusSource } from "./status-source";

export type IncidentImpact = "none" | "minor" | "major" | "critical" | "maintenance" | "unknown";

export type ProviderIncident = {
  title: string;
  impact: IncidentImpact;
  startedAt: string;
  resolvedAt: string | null;
  url: string | null;
};

export type ProviderStatus = {
  providerId: string;
  providerName: string;
  /** true = opérationnel (aucun incident en cours), false = incident en cours, null = inconnu. */
  operational: boolean | null;
  recentIncidents: ProviderIncident[];
  sourceUrl: string;
  checkedAt: string;
  provenance: "live" | "seed";
};

type ParseOpts = { now: Date; limit?: number; sinceDays?: number };
// operational null = état non dérivable de la source (cas RSS : flux d'événements, pas d'indicateur global).
type Parsed = { operational: boolean | null; recentIncidents: ProviderIncident[] };

const DEFAULT_LIMIT = 5;
const DEFAULT_SINCE_DAYS = 90;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function str(o: Record<string, unknown>, k: string): string | null {
  return typeof o[k] === "string" ? o[k] : null;
}

function mapStatuspageImpact(v: string | null): IncidentImpact {
  switch (v) {
    case "none":
      return "none";
    case "minor":
      return "minor";
    case "major":
      return "major";
    case "critical":
      return "critical";
    case "maintenance":
      return "maintenance";
    default:
      return "unknown";
  }
}

function mapGcpImpact(severity: string | null, statusImpact: string | null): IncidentImpact {
  if (statusImpact === "SERVICE_INFORMATION") return "none";
  switch (severity) {
    case "high":
      return "critical";
    case "medium":
      return "major";
    case "low":
      return "minor";
    default:
      return "unknown";
  }
}

/** Garde l'incident si sa date est illisible (ne jamais perdre un fait), sinon le borne à la fenêtre récente. */
function withinWindow(iso: string, now: Date, windowMs: number): boolean {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return true;
  const delta = now.getTime() - t;
  return delta <= windowMs && delta >= -86_400_000;
}

function finalize(incidents: ProviderIncident[], operational: boolean | null, opts: ParseOpts): Parsed {
  const windowMs = (opts.sinceDays ?? DEFAULT_SINCE_DAYS) * 86_400_000;
  const recent = incidents
    .filter((i) => withinWindow(i.startedAt, opts.now, windowMs))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, opts.limit ?? DEFAULT_LIMIT);
  return { operational, recentIncidents: recent };
}

/** Atlassian Statuspage `/api/v2/incidents.json` → faits normalisés. Pur, ne lève jamais. */
export function parseStatuspageIncidents(raw: unknown, opts: ParseOpts): Parsed {
  const root = isRecord(raw) ? raw : {};
  const items = asArray(root.incidents).filter(isRecord);
  const ACTIVE = new Set(["investigating", "identified", "monitoring"]);
  let operational = true;
  const incidents: ProviderIncident[] = [];
  for (const it of items) {
    const status = str(it, "status");
    if (status !== null && ACTIVE.has(status)) operational = false;
    const startedAt = str(it, "started_at") ?? str(it, "created_at");
    if (startedAt === null) continue;
    incidents.push({
      title: str(it, "name") ?? "(incident)",
      impact: mapStatuspageImpact(str(it, "impact")),
      startedAt,
      resolvedAt: str(it, "resolved_at"),
      url: str(it, "shortlink"),
    });
  }
  return finalize(incidents, operational, opts);
}

/** Google Cloud `incidents.json` (tableau racine) → faits normalisés. Pur, ne lève jamais. */
export function parseGcpIncidents(raw: unknown, opts: ParseOpts): Parsed {
  const items = asArray(raw).filter(isRecord);
  let operational = true;
  const incidents: ProviderIncident[] = [];
  for (const it of items) {
    const end = str(it, "end");
    const begin = str(it, "begin");
    if (begin === null) continue;
    if (end === null && withinWindow(begin, opts.now, (opts.sinceDays ?? DEFAULT_SINCE_DAYS) * 86_400_000)) {
      operational = false; // incident récent non clôturé → en cours
    }
    const uri = str(it, "uri");
    incidents.push({
      title: str(it, "external_desc") ?? "(incident)",
      impact: mapGcpImpact(str(it, "severity"), str(it, "status_impact")),
      startedAt: begin,
      resolvedAt: end,
      url: uri === null ? null : `https://status.cloud.google.com/${uri}`,
    });
  }
  return finalize(incidents, operational, opts);
}

// ── RSS (AWS / Azure : flux d'événements, pas d'API JSON) ─────────────────────────────────────────
function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}
function extractTag(block: string, tag: string): string | null {
  const m = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(block);
  if (m === null) return null;
  let v = m[1].trim();
  const cdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(v);
  if (cdata !== null) v = cdata[1].trim();
  return v === "" ? null : v;
}
function toIso(s: string): string {
  const t = Date.parse(s);
  return Number.isNaN(t) ? s : new Date(t).toISOString();
}

/** Flux RSS d'incidents (AWS/Azure). Pur, ne lève jamais. `operational` = null (non dérivable d'un flux). */
export function parseRssIncidents(xml: string, opts: ParseOpts): Parsed {
  const incidents: ProviderIncident[] = [];
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null = itemRe.exec(xml);
  while (m !== null) {
    const block = m[1];
    const pub = extractTag(block, "pubDate") ?? extractTag(block, "published") ?? extractTag(block, "updated");
    if (pub !== null) {
      incidents.push({
        title: decodeXml(extractTag(block, "title") ?? "(incident)"),
        impact: "unknown",
        startedAt: toIso(pub),
        resolvedAt: null,
        url: extractTag(block, "link"),
      });
    }
    m = itemRe.exec(xml);
  }
  return finalize(incidents, null, opts);
}

function parseByKind(kind: StatusKind, raw: unknown, opts: ParseOpts): Parsed {
  return kind === "gcp" ? parseGcpIncidents(raw, opts) : parseStatuspageIncidents(raw, opts);
}

export type StatusFeedDeps = {
  /** Récupère le corps brut (texte) de l'endpoint (borné/timeout côté appelant) ; peut lever (→ repli). */
  fetchText: (url: string) => Promise<string>;
  now: Date;
  /** Repli daté si le live échoue (filet « tout vivant + seed »). */
  seed: ProviderStatus;
  limit?: number;
  sinceDays?: number;
};

/** Récupère le statut LIVE d'un fournisseur ; repli sur le seed daté en cas d'échec. Ne lève jamais. */
export async function fetchProviderStatus(source: StatusSource, deps: StatusFeedDeps): Promise<ProviderStatus> {
  try {
    const body = await deps.fetchText(source.endpoint);
    const opts = { now: deps.now, limit: deps.limit, sinceDays: deps.sinceDays };
    // RSS = XML brut ; statuspage/gcp = JSON (parse ici → un format invalide bascule en repli via le catch).
    const parsed = source.kind === "rss" ? parseRssIncidents(body, opts) : parseByKind(source.kind, JSON.parse(body), opts);
    return {
      providerId: source.id,
      providerName: source.name,
      operational: parsed.operational,
      recentIncidents: parsed.recentIncidents,
      sourceUrl: source.pageUrl,
      checkedAt: deps.now.toISOString().slice(0, 10),
      provenance: "live",
    };
  } catch {
    return { ...deps.seed, provenance: "seed" };
  }
}
