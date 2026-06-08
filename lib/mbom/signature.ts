// Signature Ed25519 du MBOM (moat « chaîne de preuve », vague 3 — T2). Le SHA-256 du manifeste prouve
// l'INTÉGRITÉ (un tiers recalcule le hash) ; la signature prouve l'AUTHENTICITÉ (le manifeste a bien été
// émis par Strate, détenteur de la clé privée — non forgé). Isomorphe (Web Crypto, navigateur + Node) :
// la VÉRIFICATION tourne côté client avec la seule clé PUBLIQUE ; la SIGNATURE exige la clé privée, qui
// vit uniquement en env serveur (MBOM_SIGNING_KEY_JWK) — jamais dans le bundle. DÉFCON : aucune signature
// fabriquée (si la clé manque, la route répond 503 ; on ne simule jamais une preuve d'authenticité).

import type { Mbom } from "./manifest";

export const SIGNATURE_ALGO = "Ed25519" as const;
export const SIGNATURE_VERSION = 1;

// Clé publique de signature MBOM de Strate (raw Ed25519, base64). PUBLIABLE : sert à vérifier l'authenticité
// d'un manifeste signé. La clé privée correspondante n'existe qu'en env serveur. Vide tant que non provisionnée
// → toute vérification échoue (DÉFCON : pas de confiance par défaut).
export const STRATE_MBOM_PUBLIC_KEY_B64 = "fr65qsGZAOzu+UIVHyKVaMRKVBEplcPSHEnXZMmYAWo=";

export type MbomSignature = {
  algo: typeof SIGNATURE_ALGO;
  version: number;
  /** Clé publique utilisée (base64 raw) — à comparer à la clé connue de Strate. */
  publicKey: string;
  /** Message exact signé (domaine + empreinte globale). */
  message: string;
  /** Signature détachée (base64). */
  value: string;
  signedAt: string;
};

export type SignedMbom = Mbom & { signature: MbomSignature };

/** Forme minimale suffisante pour vérifier l'authenticité (empreinte + bloc signature). */
export type VerifiableMbom = { integrityHash: string; signature: MbomSignature };

// ── base64 / bytes — isomorphes (btoa/atob présents en Node 22+ et navigateur) ───────────────────
// NB : on annote `Uint8Array<ArrayBuffer>` (et non `Uint8Array` nu = `ArrayBufferLike` en TS 5.7) pour
// satisfaire `BufferSource` des appels Web Crypto.
function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}
/** UTF-8 → octets adossés à un ArrayBuffer (TextEncoder.encode renvoie un backing `ArrayBufferLike`). */
function utf8(s: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new TextEncoder().encode(s));
}
function b64urlToB64(b64url: string): string {
  const s = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return s + pad;
}

/** Message signé : domaine versionné + empreinte globale (qui lie déjà composants + checksums). Déterministe. */
export function signableMessageFromHash(integrityHash: string): string {
  return `strate-mbom-v${SIGNATURE_VERSION}:${integrityHash}`;
}
export function signableMessage(mbom: { integrityHash: string }): string {
  return signableMessageFromHash(mbom.integrityHash);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Signe une empreinte (SERVEUR : `privateJwkB64` = base64 de la JWK privée). Lève si la clé est invalide. */
export async function signMbomFromHash(
  integrityHash: string,
  privateJwkB64: string,
  now: Date,
): Promise<MbomSignature> {
  const parsed: unknown = JSON.parse(new TextDecoder().decode(b64ToBytes(privateJwkB64)));
  if (!isRecord(parsed)) throw new Error("JWK de signature invalide");
  const str = (k: string): string | undefined => (typeof parsed[k] === "string" ? parsed[k] : undefined);
  const x = str("x");
  const d = str("d");
  if (x === undefined || d === undefined) throw new Error("JWK de signature invalide (x/d manquant)");
  // Reconstruction typée d'une JWK Ed25519 (évite tout `as` sur le résultat de JSON.parse).
  const jwk: JsonWebKey = { kty: str("kty") ?? "OKP", crv: str("crv") ?? "Ed25519", x, d, key_ops: ["sign"], ext: false };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: SIGNATURE_ALGO }, false, ["sign"]);
  const message = signableMessageFromHash(integrityHash);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: SIGNATURE_ALGO }, key, utf8(message)));
  return {
    algo: SIGNATURE_ALGO,
    version: SIGNATURE_VERSION,
    publicKey: b64urlToB64(x), // composante publique de la JWK (raw 32 octets)
    message,
    value: bytesToB64(sig),
    signedAt: now.toISOString(),
  };
}

export type VerifyResult = {
  /** La signature vérifie contre la clé PUBLIQUE CONNUE de Strate, sur le message recalculé. */
  valid: boolean;
  /** La clé annoncée dans le document EST bien celle de Strate (transparence anti-forge). */
  keyTrusted: boolean;
  /** Message recalculé à partir du contenu (doit égaler `signature.message`). */
  recomputedMessage: string;
};

/** Parse (sûr, DÉFCON) un MBOM signé collé par un tiers → forme vérifiable, ou null si la forme est invalide. */
export function parseSignedMbom(v: unknown): VerifiableMbom | null {
  if (!isRecord(v) || typeof v.integrityHash !== "string") return null;
  const s = v.signature;
  if (!isRecord(s)) return null;
  if (
    s.algo !== SIGNATURE_ALGO ||
    typeof s.version !== "number" ||
    typeof s.publicKey !== "string" ||
    typeof s.message !== "string" ||
    typeof s.value !== "string" ||
    typeof s.signedAt !== "string"
  ) {
    return null;
  }
  return {
    integrityHash: v.integrityHash,
    signature: {
      algo: SIGNATURE_ALGO,
      version: s.version,
      publicKey: s.publicKey,
      message: s.message,
      value: s.value,
      signedAt: s.signedAt,
    },
  };
}

/**
 * Vérifie l'authenticité d'un MBOM signé. CONTRE LA CLÉ CONNUE DE STRATE (jamais celle du document — un
 * faussaire fournirait sa propre clé) + sur le message RECALCULÉ depuis le contenu (lie la signature au
 * manifeste). Isomorphe : conçue pour tourner dans le navigateur du vérificateur. Ne lève jamais.
 */
export async function verifyMbomSignature(
  signed: VerifiableMbom,
  trustedKeyB64: string = STRATE_MBOM_PUBLIC_KEY_B64,
): Promise<VerifyResult> {
  const recomputedMessage = signableMessage(signed);
  const sig = signed.signature;
  const keyTrusted = sig.publicKey === trustedKeyB64;
  let valid = false;
  try {
    if (sig.algo === SIGNATURE_ALGO && sig.message === recomputedMessage) {
      const key = await crypto.subtle.importKey(
        "raw",
        b64ToBytes(trustedKeyB64),
        { name: SIGNATURE_ALGO },
        true,
        ["verify"],
      );
      valid = await crypto.subtle.verify(
        { name: SIGNATURE_ALGO },
        key,
        b64ToBytes(sig.value),
        utf8(recomputedMessage),
      );
    }
  } catch {
    valid = false;
  }
  return { valid, keyTrusted, recomputedMessage };
}
