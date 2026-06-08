import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { POST } from "@/app/api/mbom/sign/route";
import { verifyMbomSignature, type SignedMbom, type MbomSignature } from "@/lib/mbom/signature";
import type { Mbom } from "@/lib/mbom/manifest";

// Vague 3 (T2) : route de signature. Clé éphémère injectée via env (la clé de prod n'est pas requise).

const HASH = "c".repeat(64);
let privJwkB64 = "";
let pubB64 = "";

beforeAll(async () => {
  const kp = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  privJwkB64 = btoa(JSON.stringify(await crypto.subtle.exportKey("jwk", kp.privateKey)));
  const rawPub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  let bin = "";
  for (const b of rawPub) bin += String.fromCharCode(b);
  pubB64 = btoa(bin);
});

afterEach(() => {
  delete process.env.MBOM_SIGNING_KEY_JWK;
});

function req(body: unknown): Request {
  return new Request("http://localhost/api/mbom/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.9" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/mbom/sign (vague 3 T2)", () => {
  it("400 si l'empreinte n'est pas un SHA-256 hexa", async () => {
    process.env.MBOM_SIGNING_KEY_JWK = privJwkB64;
    expect((await POST(req({ integrityHash: "trop-court" }))).status).toBe(400);
  });

  it("503 si la clé de signature n'est pas configurée (DÉFCON : jamais de fausse preuve)", async () => {
    expect((await POST(req({ integrityHash: HASH }))).status).toBe(503);
  });

  it("200 + signature vérifiable contre la clé publique correspondante", async () => {
    process.env.MBOM_SIGNING_KEY_JWK = privJwkB64;
    const res = await POST(req({ integrityHash: HASH }));
    expect(res.status).toBe(200);
    const signature: MbomSignature = (await res.json()).signature;
    expect(signature.publicKey).toBe(pubB64);

    const signed: SignedMbom = {
      version: 1,
      product: "Strate",
      generatedAt: "2026-06-08T00:00:00.000Z",
      components: [],
      files: [],
      integrityHash: HASH,
      disclaimer: "—",
      signature,
    } satisfies Mbom & { signature: MbomSignature };
    const verdict = await verifyMbomSignature(signed, pubB64);
    expect(verdict.valid).toBe(true);
  });
});
