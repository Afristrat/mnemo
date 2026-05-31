import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { encryptSecret, decryptSecret, rewrapDek } from "@/lib/vault/crypto";

const KEK = randomBytes(32);

describe("coffre — chiffrement enveloppe (Lot 2 A)", () => {
  it("round-trip : déchiffre exactement le secret", () => {
    const rec = encryptSecret("sk-vendor-token-123", KEK);
    expect(decryptSecret(rec, KEK)).toBe("sk-vendor-token-123");
  });

  it("le chiffré ne contient jamais le clair", () => {
    const rec = encryptSecret("PLAINTEXT_SECRET", KEK);
    expect(rec.ciphertext).not.toContain("PLAINTEXT_SECRET");
    expect(JSON.stringify(rec)).not.toContain("PLAINTEXT_SECRET");
  });

  it("toute altération du chiffré (ou du tag) fait échouer le déchiffrement", () => {
    const rec = encryptSecret("abc", KEK);
    const tampered = { ...rec, ciphertext: Buffer.from("zzzz", "utf-8").toString("base64") };
    expect(() => decryptSecret(tampered, KEK)).toThrow();
  });

  it("une mauvaise KEK ne déchiffre pas", () => {
    const rec = encryptSecret("abc", KEK);
    expect(() => decryptSecret(rec, randomBytes(32))).toThrow();
  });

  it("rewrap : nouvelle KEK déchiffre, l'ancienne ne déchiffre plus", () => {
    const rec = encryptSecret("token", KEK);
    const newKek = randomBytes(32);
    const rewrapped = rewrapDek(rec, KEK, newKek);
    expect(decryptSecret(rewrapped, newKek)).toBe("token");
    expect(() => decryptSecret(rewrapped, KEK)).toThrow();
    expect(rewrapped.ciphertext).toBe(rec.ciphertext);
  });

  it("rejette une KEK de mauvaise longueur", () => {
    expect(() => encryptSecret("x", randomBytes(16))).toThrow();
  });
});
