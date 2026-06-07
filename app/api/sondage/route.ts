import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { Pool } from "pg";

// Collecte des réponses du sondage de prix (Van Westendorp + conjoint).
// Écrit dans la base Postgres dédiée (Coolify), même origine que la page /sondage.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let pool: Pool | null = null;
let tableReady = false;

function getPool(): Pool {
  if (pool === null) {
    pool = new Pool({ connectionString: process.env.SURVEY_DATABASE_URL });
  }
  return pool;
}

async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await getPool().query(`
    create table if not exists survey_responses (
      id uuid primary key default gen_random_uuid(),
      kind text not null,
      market text,
      payload jsonb not null,
      meta jsonb,
      created_at timestamptz not null default now()
    );
  `);
  tableReady = true;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Comparaison à temps constant (anti timing-attack) du token d'export. */
function tokenMatches(provided: string | null, expected: string): boolean {
  if (provided === null) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.SURVEY_DATABASE_URL) {
    return NextResponse.json({ error: "Collecte non configurée." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Corps requis (objet)." }, { status: 400 });
  }

  if (body.kind !== "van_westendorp" && body.kind !== "conjoint") {
    return NextResponse.json({ error: "kind invalide." }, { status: 422 });
  }
  if (body.payload === undefined || body.payload === null) {
    return NextResponse.json({ error: "payload requis." }, { status: 422 });
  }

  try {
    await ensureTable();
    await getPool().query(
      "insert into survey_responses (kind, market, payload, meta) values ($1, $2, $3, $4)",
      [
        body.kind,
        typeof body.market === "string" ? body.market : null,
        JSON.stringify(body.payload),
        body.meta === undefined || body.meta === null ? null : JSON.stringify(body.meta),
      ],
    );
  } catch {
    return NextResponse.json({ error: "Enregistrement impossible." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// Export protégé par token : GET /api/sondage  avec en-tête `Authorization: Bearer <SURVEY_EXPORT_TOKEN>`
// → renvoie les réponses (JSON). Le token N'EST PLUS en query string (évite logs/historique/referer) et la
// comparaison est à temps constant (anti timing-attack).
export async function GET(request: Request): Promise<NextResponse> {
  const token = process.env.SURVEY_EXPORT_TOKEN;
  const header = request.headers.get("authorization");
  const provided = header !== null && header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token || !tokenMatches(provided, token)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  if (!process.env.SURVEY_DATABASE_URL) {
    return NextResponse.json({ error: "Collecte non configurée." }, { status: 503 });
  }
  try {
    await ensureTable();
    const result = await getPool().query(
      "select kind, market, payload, meta, created_at from survey_responses order by created_at desc",
    );
    return NextResponse.json({ count: result.rowCount, responses: result.rows });
  } catch {
    return NextResponse.json({ error: "Lecture impossible." }, { status: 500 });
  }
}
