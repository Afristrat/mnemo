import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { encryptWithEnvKek, decryptWithEnvKek, currentKeyVersion } from "@/lib/vault/server";

const KEK_B64 = randomBytes(32).toString("base64");

describe("coffre serveur (KEK env)", () => {
  it("chiffre puis déchiffre via la KEK de l'env", () => {
    const env = { STRATE_VAULT_MASTER_KEY: KEK_B64, STRATE_VAULT_KEY_VERSION: "1" };
    const rec = encryptWithEnvKek("token", env);
    expect(decryptWithEnvKek(rec, env)).toBe("token");
    expect(currentKeyVersion(env)).toBe(1);
  });

  it("KEK absente → erreur explicite (jamais de fonctionnement silencieux)", () => {
    expect(() => encryptWithEnvKek("x", {})).toThrow(/STRATE_VAULT_MASTER_KEY/);
  });
});
