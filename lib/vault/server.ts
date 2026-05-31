// lib/vault/server.ts
// ⚠ SERVEUR UNIQUEMENT — Ne jamais importer ce module côté client (composants React, bundle
// navigateur). En production, Next.js garantit l'isolement via les Server Actions et Route
// Handlers. L'import "server-only" n'est pas utilisé ici car le package n'est pas encore
// installé dans ce projet ; l'isolement repose sur la discipline d'import et le bundler Next.
//
// Accès au coffre CÔTÉ SERVEUR : lit la KEK (clé de chiffrement de clés) depuis l'environnement.
// Le paramètre `env` est injectable pour les tests unitaires ; en production il vaut `process.env`.
import { encryptSecret, decryptSecret, type EncryptedSecret } from "./crypto";

// Type interne : sous-ensemble de NodeJS.ProcessEnv utilisable en tests sans `process.env`.
type Env = Record<string, string | undefined>;

/**
 * Extrait et valide la KEK depuis l'environnement.
 * Lève une erreur explicite si la variable est absente ou mal dimensionnée —
 * jamais de fonctionnement silencieux avec une KEK nulle ou invalide.
 */
function readKek(env: Env): Buffer {
  const b64 = env.STRATE_VAULT_MASTER_KEY;
  if (b64 === undefined || b64.length === 0) {
    throw new Error(
      "STRATE_VAULT_MASTER_KEY manquante (KEK du coffre). Refus de chiffrer/déchiffrer.",
    );
  }
  const kek = Buffer.from(b64, "base64");
  if (kek.length !== 32) {
    throw new Error("STRATE_VAULT_MASTER_KEY doit décoder en 32 octets (AES-256).");
  }
  return kek;
}

/**
 * Renvoie la version de clé active lue depuis STRATE_VAULT_KEY_VERSION.
 * Valeur par défaut : 1. Toute valeur non entière positive retombe sur 1.
 */
export function currentKeyVersion(env: Env = process.env): number {
  const v = Number.parseInt(env.STRATE_VAULT_KEY_VERSION ?? "1", 10);
  return Number.isFinite(v) && v > 0 ? v : 1;
}

/**
 * Chiffre `plaintext` en utilisant la KEK lue depuis `env`.
 * Retourne un enregistrement `EncryptedSecret` (DEK jetable, wrappée par la KEK).
 */
export function encryptWithEnvKek(
  plaintext: string,
  env: Env = process.env,
): EncryptedSecret {
  return encryptSecret(plaintext, readKek(env));
}

/**
 * Déchiffre `rec` en utilisant la KEK lue depuis `env`.
 * Retourne le texte clair original.
 */
export function decryptWithEnvKek(
  rec: EncryptedSecret,
  env: Env = process.env,
): string {
  return decryptSecret(rec, readKek(env));
}
