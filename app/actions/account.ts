// app/actions/account.ts
// Server Actions : migration de profil anonyme vers authentifié, stockage et révocation de
// credentials vendeurs dans le coffre chiffré.
"use server";

import { getAuthUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  storeVendorCredentialRecord,
  buildAdminInserter,
} from "@/lib/vault/credentials";
import { DEFAULT_PROFILE } from "@/lib/wizard/defaultProfile";
import type { Profile } from "@/lib/engine";
import type { CredentialAction } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

/** Récupère le circle_id du membre connecté (premier membership trouvé). */
async function currentCircleId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("circle_id")
    .limit(1)
    .maybeSingle();
  return data?.circle_id ?? null;
}

// ---------------------------------------------------------------------------
// Action : migration profil anonyme → authentifié
// ---------------------------------------------------------------------------

/**
 * Importe un profil configurateur (capturé en session anonyme) dans le cercle
 * de l'utilisateur connecté. Sans effet si une configuration existe déjà.
 */
export async function migrateAnonymousProfile(
  profile: Partial<Profile>,
): Promise<{ ok: boolean }> {
  const user = await getAuthUser();
  if (user === null) return { ok: false };

  const circleId = await currentCircleId();
  if (circleId === null) return { ok: false };

  const supabase = await createClient();

  // Idempotence : ne pas écraser une configuration existante.
  const { count } = await supabase
    .from("configurations")
    .select("id", { count: "exact", head: true })
    .eq("circle_id", circleId);
  if ((count ?? 0) > 0) return { ok: true };

  await supabase.from("configurations").insert({
    circle_id: circleId,
    created_by: user.id,
    label: "Profil importé",
    profile: { ...DEFAULT_PROFILE, ...profile },
    recommendation: null,
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Action : stockage d'un credential vendeur
// ---------------------------------------------------------------------------

/** Chiffre et stocke un credential vendeur dans le coffre du cercle. */
export async function storeVendorCredential(input: {
  provider: string;
  label: string;
  kind: "oauth_token" | "api_key";
  secret: string;
}): Promise<{ ok: boolean }> {
  const user = await getAuthUser();
  if (user === null) return { ok: false };

  const circleId = await currentCircleId();
  if (circleId === null) return { ok: false };

  const admin = createAdminClient();
  if (admin === null) return { ok: false };

  await storeVendorCredentialRecord(buildAdminInserter(admin), {
    circleId,
    userId: user.id,
    provider: input.provider,
    label: input.label,
    kind: input.kind,
    secret: input.secret,
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Action : révocation d'un credential vendeur
// ---------------------------------------------------------------------------

/** Révoque un credential en posant `revoked_at` et en traçant l'accès `revoke`. */
export async function revokeVendorCredential(
  credentialId: string,
): Promise<{ ok: boolean }> {
  const user = await getAuthUser();
  if (user === null) return { ok: false };

  const circleId = await currentCircleId();
  if (circleId === null) return { ok: false };

  const admin = createAdminClient();
  if (admin === null) return { ok: false };

  // Vérification d'appartenance : le credential doit appartenir au cercle de l'utilisateur.
  const { data: cred } = await admin
    .from("vendor_credentials")
    .select("circle_id")
    .eq("id", credentialId)
    .maybeSingle();
  if (cred === null || cred.circle_id !== circleId) return { ok: false };

  await admin
    .from("vendor_credentials")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", credentialId)
    .eq("circle_id", circleId);

  const action: CredentialAction = "revoke";
  await admin.from("credential_access").insert({
    circle_id: circleId,
    credential_id: credentialId,
    actor: user.id,
    action,
    context: {},
  });

  return { ok: true };
}
