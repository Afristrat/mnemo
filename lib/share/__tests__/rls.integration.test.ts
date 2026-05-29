// Test d'intégration RLS du partage par lien court (S-067) contre une instance Supabase LOCALE.
// Gated : ne s'exécute que si les creds de test sont fournis (sinon skip → CI vert) :
//   SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, SUPABASE_TEST_SECRET_KEY
// Prouve : anon peut CRÉER un lien ; un anonyme ne lit PAS la table en masse (SELECT direct fermé) ;
// la lecture par id imprévisible passe par la RPC SECURITY DEFINER get_shared_reco.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { encodeProfileToParam } from "@/lib/share";
import { DEFAULT_PROFILE } from "@/lib/wizard/defaultProfile";

const URL = process.env.SUPABASE_TEST_URL;
const ANON = process.env.SUPABASE_TEST_ANON_KEY;
const SECRET = process.env.SUPABASE_TEST_SECRET_KEY;
const ready = Boolean(URL && ANON && SECRET);

const url = URL ?? "";
const anonKey = ANON ?? "";
const secretKey = SECRET ?? "";

describe.skipIf(!ready)("RLS shared_reco (Supabase local)", () => {
  let admin: SupabaseClient;
  const encoded = encodeProfileToParam(DEFAULT_PROFILE);

  beforeAll(() => {
    admin = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
  });

  afterAll(async () => {
    await admin.from("shared_reco").delete().eq("encoded", encoded);
  });

  it("un anonyme peut CRÉER un lien (insert ouvert)", async () => {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data, error } = await anon
      .from("shared_reco")
      .insert({ circle_id: null, created_by: null, encoded })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect(typeof data?.id).toBe("string");
  });

  it("un anonyme ne lit PAS la table en masse (SELECT direct fermé)", async () => {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data } = await anon.from("shared_reco").select("*");
    expect(data?.length).toBe(0);
  });

  it("lecture par id via la RPC SECURITY DEFINER (lien imprévisible)", async () => {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data: inserted } = await anon
      .from("shared_reco")
      .insert({ circle_id: null, created_by: null, encoded })
      .select("id")
      .single();
    const id = inserted?.id ?? "";
    const { data, error } = await anon.rpc("get_shared_reco", { reco_id: id });
    expect(error).toBeNull();
    expect(Array.isArray(data) ? data[0]?.encoded : null).toBe(encoded);
  });
});
