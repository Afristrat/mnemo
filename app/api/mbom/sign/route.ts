import { NextResponse } from "next/server";
import { signMbomFromHash } from "@/lib/mbom/signature";
import { enforceRateLimit } from "@/lib/api/rate-limit-guard";

// MBOM signé (moat « chaîne de preuve », vague 3 — T2). POST { integrityHash } → signature Ed25519
// détachée de l'empreinte globale du manifeste. La clé PRIVÉE vit uniquement en env serveur
// (MBOM_SIGNING_KEY_JWK, base64 d'une JWK Ed25519) — jamais dans le bundle client. DÉFCON : si la clé
// n'est pas provisionnée → 503 (on ne fabrique JAMAIS une preuve d'authenticité). La VÉRIFICATION, elle,
// se fait côté client avec la seule clé publique (cf. lib/mbom/signature.verifyMbomSignature).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const HASH_RE = /^[0-9a-f]{64}$/u;

export async function POST(req: Request): Promise<Response> {
  const limited = enforceRateLimit(req, "mbom-sign", 30, 60_000);
  if (limited !== null) return limited;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const integrityHash = isRecord(raw) && typeof raw.integrityHash === "string" ? raw.integrityHash : "";
  if (!HASH_RE.test(integrityHash)) {
    return NextResponse.json({ error: "Empreinte SHA-256 attendue (64 hexa)" }, { status: 400 });
  }

  const jwkB64 = process.env.MBOM_SIGNING_KEY_JWK;
  if (jwkB64 === undefined || jwkB64 === "") {
    return NextResponse.json({ error: "Signature indisponible (clé non configurée)" }, { status: 503 });
  }

  try {
    const signature = await signMbomFromHash(integrityHash, jwkB64, new Date());
    return NextResponse.json({ signature });
  } catch {
    return NextResponse.json({ error: "Signature impossible" }, { status: 503 });
  }
}
