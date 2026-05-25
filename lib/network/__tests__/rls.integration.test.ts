// Test d'intégration RLS (F9) contre une instance Supabase LOCALE.
// S'exécute uniquement si les creds de test sont fournis (sinon skip → CI vert) :
//   SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, SUPABASE_TEST_SECRET_KEY
// Prouve : isolation multi-tenant par `circle`, horodatage du consentement, anon bloqué.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { buildConsentUpsert } from "@/lib/network/consent";

const URL = process.env.SUPABASE_TEST_URL;
const ANON = process.env.SUPABASE_TEST_ANON_KEY;
const SECRET = process.env.SUPABASE_TEST_SECRET_KEY;
const ready = Boolean(URL && ANON && SECRET);

const url = URL ?? "";
const anonKey = ANON ?? "";
const secretKey = SECRET ?? "";
const password = "Passw0rd!integration";

describe.skipIf(!ready)("RLS multi-tenant (Supabase local)", () => {
  let admin: SupabaseClient;
  let userA: User | null = null;
  let userB: User | null = null;
  const stamp = Date.now();
  const emailA = `a_${stamp}@mnemo.test`;
  const emailB = `b_${stamp}@mnemo.test`;

  beforeAll(async () => {
    admin = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const a = await admin.auth.admin.createUser({ email: emailA, password, email_confirm: true });
    const b = await admin.auth.admin.createUser({ email: emailB, password, email_confirm: true });
    userA = a.data.user;
    userB = b.data.user;
  });

  afterAll(async () => {
    if (userA) await admin.auth.admin.deleteUser(userA.id);
    if (userB) await admin.auth.admin.deleteUser(userB.id);
  });

  it("le trigger crée un cercle personnel + appartenance owner à l'inscription", async () => {
    const { data } = await admin.from("circles").select("id").eq("owner_id", userA?.id ?? "");
    expect(data?.length).toBe(1);
  });

  it("un membre ne voit QUE son cercle (isolation cross-tenant)", async () => {
    const clientA = createClient(url, anonKey, { auth: { persistSession: false } });
    await clientA.auth.signInWithPassword({ email: emailA, password });

    const { data: mine } = await clientA.from("circles").select("*");
    expect(mine?.length).toBe(1);
    expect(mine?.[0]?.owner_id).toBe(userA?.id);

    const { data: bCircles } = await admin.from("circles").select("id").eq("owner_id", userB?.id ?? "");
    const bCircleId = bCircles?.[0]?.id ?? "";
    const { data: leak } = await clientA.from("circles").select("*").eq("id", bCircleId);
    expect(leak?.length).toBe(0); // RLS bloque la fuite cross-tenant
  });

  it("le consentement réseau est enregistré horodaté", async () => {
    const clientA = createClient(url, anonKey, { auth: { persistSession: false } });
    await clientA.auth.signInWithPassword({ email: emailA, password });
    const { data: circles } = await clientA.from("circles").select("id");
    const circleId = circles?.[0]?.id ?? "";

    const payload = buildConsentUpsert({ circleId, userId: userA?.id ?? "", consented: true });
    const { data, error } = await clientA
      .from("network_consents")
      .upsert(payload, { onConflict: "circle_id,user_id,scope" })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.consented).toBe(true);
    expect(data?.consented_at).not.toBeNull();
  });

  it("un visiteur anonyme ne lit aucune donnée (aucune policy anon)", async () => {
    const anonClient = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data } = await anonClient.from("circles").select("*");
    expect(data?.length).toBe(0);
  });
});
