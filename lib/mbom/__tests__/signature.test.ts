import { describe, it, expect, beforeAll } from "vitest";
import {
  signMbomFromHash,
  verifyMbomSignature,
  signableMessageFromHash,
  SIGNATURE_ALGO,
  type SignedMbom,
} from "@/lib/mbom/signature";
import type { Mbom } from "@/lib/mbom/manifest";

// Vague 3 (T2) : authenticité Ed25519 du MBOM. Tests avec une paire ÉPHÉMÈRE injectée (la clé de prod
// n'est pas requise) — aller-retour, détection de falsification, rejet d'une clé non fiable.

const HASH = "a".repeat(64);

function mbomWith(integrityHash: string): Mbom {
  return {
    version: 1,
    product: "Strate",
    generatedAt: "2026-06-08T00:00:00.000Z",
    components: [],
    files: [],
    integrityHash,
    disclaimer: "—",
  };
}

let privJwkB64 = "";
let pubB64 = "";

beforeAll(async () => {
  const kp = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  privJwkB64 = btoa(JSON.stringify(jwk));
  const rawPub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  let bin = "";
  for (const b of rawPub) bin += String.fromCharCode(b);
  pubB64 = btoa(bin);
});

describe("signMbomFromHash + verifyMbomSignature (vague 3 T2)", () => {
  it("signe puis vérifie (aller-retour) contre la clé éphémère", async () => {
    const now = new Date("2026-06-08T12:00:00.000Z");
    const signature = await signMbomFromHash(HASH, privJwkB64, now);
    expect(signature.algo).toBe(SIGNATURE_ALGO);
    expect(signature.message).toBe(signableMessageFromHash(HASH));
    expect(signature.publicKey).toBe(pubB64);
    expect(signature.signedAt).toBe(now.toISOString());

    const signed: SignedMbom = { ...mbomWith(HASH), signature };
    const res = await verifyMbomSignature(signed, pubB64);
    expect(res.valid).toBe(true);
    expect(res.keyTrusted).toBe(true);
  });

  it("détecte une falsification du contenu (empreinte modifiée → message recalculé ≠)", async () => {
    const signature = await signMbomFromHash(HASH, privJwkB64, new Date("2026-06-08T12:00:00.000Z"));
    const tampered: SignedMbom = { ...mbomWith("b".repeat(64)), signature };
    const res = await verifyMbomSignature(tampered, pubB64);
    expect(res.valid).toBe(false);
  });

  it("détecte une signature trafiquée (octets modifiés)", async () => {
    const signature = await signMbomFromHash(HASH, privJwkB64, new Date("2026-06-08T12:00:00.000Z"));
    const broken = { ...signature, value: btoa("x".repeat(64)) };
    const signed: SignedMbom = { ...mbomWith(HASH), signature: broken };
    const res = await verifyMbomSignature(signed, pubB64);
    expect(res.valid).toBe(false);
  });

  it("rejette une clé non fiable (keyTrusted false, valid false)", async () => {
    const signature = await signMbomFromHash(HASH, privJwkB64, new Date("2026-06-08T12:00:00.000Z"));
    const signed: SignedMbom = { ...mbomWith(HASH), signature };
    const res = await verifyMbomSignature(signed, "QUNvbnRyZWZhaXRl"); // autre clé (base64 valide, non correspondante)
    expect(res.keyTrusted).toBe(false);
    expect(res.valid).toBe(false);
  });

  it("lève si la JWK privée est invalide", async () => {
    await expect(signMbomFromHash(HASH, btoa("{}"), new Date())).rejects.toThrow();
  });
});
