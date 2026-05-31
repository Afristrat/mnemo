// lib/vault/credentials.ts
// Helpers CÔTÉ SERVEUR du coffre : chiffrent via la KEK env et écrivent l'audit. Le client passé est
// un client admin (service_role) OU un faux client de test exposant `.from(table).insert(row)`.
// (server-only assuré par l'usage exclusif depuis les server actions ; cf. note de Task 2.)
import { encryptWithEnvKek, currentKeyVersion } from "./server";

type Env = Record<string, string | undefined>;
type Inserter = {
  from: (table: string) => { insert: (row: Record<string, unknown>) => Promise<{ error: unknown }> };
};

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
