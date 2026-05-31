// Test d'intégration RLS du coffre de credentials (Lot 2-A).
// Gated : ne s'exécute que si les creds de test sont fournis (sinon skip → CI vert) :
//   SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, SUPABASE_TEST_SECRET_KEY
// Prouve :
//   (1) le rôle authenticated NE PEUT PAS lire la table de base vendor_credentials (chiffré protégé)
//   (2) service_role lit le chiffré
// (La vue méta + l'isolation par cercle relèvent du même principe ; ce test cible l'invariant
//  de sécurité central : le chiffré n'est jamais exposé au client.)

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_TEST_URL;
const ANON = process.env.SUPABASE_TEST_ANON_KEY;
const SECRET = process.env.SUPABASE_TEST_SECRET_KEY;
const ready = Boolean(URL && ANON && SECRET);

describe.skipIf(!ready)("RLS coffre (intégration)", () => {
  let admin: SupabaseClient;
  let circleId = "";
  let userId = "";

  beforeAll(async () => {
    admin = createClient(URL ?? "", SECRET ?? "", {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: u } = await admin.auth.admin.createUser({
      email: `vault-${Date.now()}@t.test`,
      password: "Passw0rd!integration",
      email_confirm: true,
    });
    userId = u.user?.id ?? "";

    const { data: m } = await admin
      .from("memberships")
      .select("circle_id")
      .eq("user_id", userId)
      .single();
    circleId = m?.circle_id ?? "";

    await admin.from("vendor_credentials").insert({
      circle_id: circleId,
      provider: "hetzner",
      label: "Prod",
      kind: "api_key",
      ciphertext: "x",
      wrapped_dek: "x",
      iv_secret: "x",
      tag_secret: "x",
      iv_dek: "x",
      tag_dek: "x",
      created_by: userId,
    });
  });

  afterAll(async () => {
    if (circleId) await admin.from("circles").delete().eq("id", circleId);
  });

  it("le rôle authenticated NE PEUT PAS lire la table de base (chiffré protégé)", async () => {
    const anon = createClient(URL ?? "", ANON ?? "", {
      auth: { persistSession: false },
    });
    const { data } = await anon.from("vendor_credentials").select("ciphertext");
    expect(data ?? []).toHaveLength(0);
  });

  it("service_role lit le chiffré", async () => {
    const { data } = await admin
      .from("vendor_credentials")
      .select("ciphertext")
      .eq("circle_id", circleId);
    expect((data ?? []).length).toBeGreaterThan(0);
  });
});
