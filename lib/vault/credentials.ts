// lib/vault/credentials.ts
// Helpers CÔTÉ SERVEUR du coffre : chiffrent via la KEK env et écrivent l'audit. Le client passé est
// un client admin (service_role) OU un faux client de test exposant `.from(table).insert(row)`.
// (server-only assuré par l'usage exclusif depuis les server actions ; cf. note de Task 2.)
import { createClient } from "@supabase/supabase-js";
import { encryptWithEnvKek, currentKeyVersion } from "./server";
import type {
  Database,
  VendorCredentialInsert,
  CredentialAccessInsert,
  CredentialAction,
} from "@/lib/supabase/types";

type Env = Record<string, string | undefined>;
// `PromiseLike` (et non `Promise`) pour accepter les clients de test exposant `.from(table).insert(row)`.
type Inserter = {
  from: (table: string) => { insert: (row: Record<string, unknown>) => PromiseLike<{ error: unknown }> };
};

// Alias du type `SupabaseClient<Database>` sans importer la classe complète (découplage léger).
type AdminClient = ReturnType<typeof createClient<Database>>;

// Type guard : valide que `v` est une `CredentialAction` connue.
function isCredentialAction(v: unknown): v is CredentialAction {
  return v === "store" || v === "read" || v === "rotate" || v === "revoke";
}

// Type guard : valide que `v` est un objet non-null.
function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Construit un `Inserter` à partir d'un `SupabaseClient<Database>` (service_role).
 * Dispatche nommément sur les tables connues (`vendor_credentials`, `credential_access`)
 * pour satisfaire la contrainte `keyof Tables` du client typé — sans `as`.
 */
export function buildAdminInserter(admin: AdminClient): Inserter {
  return {
    from(table: string) {
      if (table === "vendor_credentials") {
        return {
          insert(row: Record<string, unknown>): PromiseLike<{ error: unknown }> {
            // Reconstruction field-by-field : évite toute assertion de type en extrayant
            // et validant chaque champ depuis `Record<string, unknown>` vers les types stricts.
            // `storeVendorCredentialRecord` garantit que tous les champs sont présents et valides.
            const typed: VendorCredentialInsert = {
              circle_id:   String(row["circle_id"] ?? ""),
              provider:    String(row["provider"] ?? ""),
              label:       String(row["label"] ?? ""),
              kind:        row["kind"] === "oauth_token" ? "oauth_token" : "api_key",
              ciphertext:  String(row["ciphertext"] ?? ""),
              wrapped_dek: String(row["wrapped_dek"] ?? ""),
              iv_secret:   String(row["iv_secret"] ?? ""),
              tag_secret:  String(row["tag_secret"] ?? ""),
              iv_dek:      String(row["iv_dek"] ?? ""),
              tag_dek:     String(row["tag_dek"] ?? ""),
              key_version: Number(row["key_version"] ?? 1),
              expires_at:  typeof row["expires_at"] === "string" ? row["expires_at"] : null,
              revoked_at:  typeof row["revoked_at"] === "string" ? row["revoked_at"] : null,
              created_by:  typeof row["created_by"] === "string" ? row["created_by"] : null,
            };
            return admin.from("vendor_credentials").insert(typed);
          },
        };
      }
      if (table === "credential_access") {
        return {
          insert(row: Record<string, unknown>): PromiseLike<{ error: unknown }> {
            const rawAction = row["action"];
            const rawContext = row["context"];
            const typed: CredentialAccessInsert = {
              circle_id:     String(row["circle_id"] ?? ""),
              actor:         String(row["actor"] ?? ""),
              action:        isCredentialAction(rawAction) ? rawAction : "store",
              context:       isRecord(rawContext) ? rawContext : {},
              credential_id: typeof row["credential_id"] === "string" ? row["credential_id"] : null,
            };
            return admin.from("credential_access").insert(typed);
          },
        };
      }
      // Garde : ne devrait jamais être appelé avec une autre table.
      return {
        insert(_row: Record<string, unknown>): PromiseLike<{ error: unknown }> {
          return Promise.reject(new Error(`Table inconnue dans buildAdminInserter : ${table}`));
        },
      };
    },
  };
}

export type StoreArgs = {
  circleId: string;
  userId: string;
  provider: string;
  label: string;
  kind: "oauth_token" | "api_key";
  secret: string;
};

/** Chiffre + insère un credential, puis trace l'accès `store`. Ne persiste JAMAIS le clair. */
export async function storeVendorCredentialRecord(
  admin: Inserter,
  args: StoreArgs,
  env: Env = process.env,
): Promise<void> {
  const enc = encryptWithEnvKek(args.secret, env);
  await admin.from("vendor_credentials").insert({
    circle_id: args.circleId,
    provider: args.provider,
    label: args.label,
    kind: args.kind,
    ciphertext: enc.ciphertext,
    wrapped_dek: enc.wrappedDek,
    iv_secret: enc.ivSecret,
    tag_secret: enc.tagSecret,
    iv_dek: enc.ivDek,
    tag_dek: enc.tagDek,
    key_version: currentKeyVersion(env),
    created_by: args.userId,
  });
  await admin.from("credential_access").insert({
    circle_id: args.circleId,
    actor: args.userId,
    action: "store",
    context: { provider: args.provider },
  });
}
