// lib/vault/crypto.ts
// Chiffrement par enveloppe (AES-256-GCM), PUR : les clés sont passées en argument (zéro env, zéro I/O).
// DEK aléatoire par secret, wrappée par la KEK → rotation de KEK = re-wrap des DEK (secret inchangé).
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";

export type EncryptedSecret = {
  ciphertext: string;
  wrappedDek: string;
  ivSecret: string;
  tagSecret: string;
  ivDek: string;
  tagDek: string;
};

function b64(s: string): Buffer {
  return Buffer.from(s, "base64");
}

function encGcm(
  key: Buffer,
  plaintext: Buffer,
): { ct: Buffer; iv: Buffer; tag: Buffer } {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { ct, iv, tag: cipher.getAuthTag() };
}

function decGcm(key: Buffer, ct: Buffer, iv: Buffer, tag: Buffer): Buffer {
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

function assertKek(kek: Buffer): void {
  if (kek.length !== 32) throw new Error("La KEK doit faire 32 octets (AES-256).");
}

export function encryptSecret(plaintext: string, kek: Buffer): EncryptedSecret {
  assertKek(kek);
  const dek = randomBytes(32);
  const s = encGcm(dek, Buffer.from(plaintext, "utf-8"));
  const w = encGcm(kek, dek);
  return {
    ciphertext: s.ct.toString("base64"),
    ivSecret: s.iv.toString("base64"),
    tagSecret: s.tag.toString("base64"),
    wrappedDek: w.ct.toString("base64"),
    ivDek: w.iv.toString("base64"),
    tagDek: w.tag.toString("base64"),
  };
}

export function decryptSecret(rec: EncryptedSecret, kek: Buffer): string {
  assertKek(kek);
  const dek = decGcm(kek, b64(rec.wrappedDek), b64(rec.ivDek), b64(rec.tagDek));
  return decGcm(dek, b64(rec.ciphertext), b64(rec.ivSecret), b64(rec.tagSecret)).toString("utf-8");
}

export function rewrapDek(
  rec: EncryptedSecret,
  oldKek: Buffer,
  newKek: Buffer,
): EncryptedSecret {
  assertKek(oldKek);
  assertKek(newKek);
  const dek = decGcm(oldKek, b64(rec.wrappedDek), b64(rec.ivDek), b64(rec.tagDek));
  const w = encGcm(newKek, dek);
  return {
    ...rec,
    wrappedDek: w.ct.toString("base64"),
    ivDek: w.iv.toString("base64"),
    tagDek: w.tag.toString("base64"),
  };
}
