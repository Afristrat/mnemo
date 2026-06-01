// Test d'intégration RLS de l'audit trail des régimes (S-077) contre une instance Supabase LOCALE.
// Gated : ne s'exécute que si les creds de test sont fournis (sinon skip → CI vert) :
//   SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, SUPABASE_TEST_SECRET_KEY
// Prouve : un tenant ne lit PAS les observations d'un autre ; un visiteur anonyme ne lit rien en masse.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { regimesSeedFor } from "@/lib/legal/regime-seed";
import { buildRegimeObservations } from "@/lib/legal/regime-observation";

const URL = process.env.SUPABASE_TEST_URL;
const ANON = process.env.SUPABASE_TEST_ANON_KEY;
const SECRET = process.env.SUPABASE_TEST_SECRET_KEY;
const ready = Boolean(URL && ANON && SECRET);

const url = URL ?? "";
const anonKey = ANON ?? "";
const secretKey = SECRET ?? "";
const password = "Passw0rd!integration";

// Régimes UE (RGPD + AI Act) traités comme « live » pour produire des observations persistables.
function observationsFixture(circleId: string, createdBy: string | undefined): ReturnType<typeof buildRegimeObservations> {
  const regimes = regimesSeedFor("union-europeenne").map((r) => ({ ...r, provenance: "live" as const }));
  return buildRegimeObservations({ regimes, circleId, createdBy: createdBy ?? null });
}

describe.skipIf(!ready)("RLS regime_observations (Supabase local)", () => {
  let admin: SupabaseClient;
  let userA: User | null = null;
  let userB: User | null = null;
  const stamp = Date.now();
  const emailA = `regime_a_${stamp}@mnemo.test`;
  const emailB = `regime_b_${stamp}@mnemo.test`;

  async function circleOf(client: SupabaseClient): Promise<string> {
    const { data } = await client.from("circles").select("id");
    return data?.[0]?.id ?? "";
  }

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

  it("les observations du cercle A ne sont PAS lisibles par le cercle B (isolation)", async () => {
    const clientA = createClient(url, anonKey, { auth: { persistSession: false } });
    await clientA.auth.signInWithPassword({ email: emailA, password });
    const circleA = await circleOf(clientA);

    const { error } = await clientA.from("regime_observations").insert(observationsFixture(circleA, userA?.id));
    expect(error).toBeNull();

    const { data: mine } = await clientA.from("regime_observations").select("*").eq("circle_id", circleA);
    expect(mine?.length ?? 0).toBeGreaterThanOrEqual(1);

    const clientB = createClient(url, anonKey, { auth: { persistSession: false } });
    await clientB.auth.signInWithPassword({ email: emailB, password });
    const { data: leak } = await clientB.from("regime_observations").select("*").eq("circle_id", circleA);
    expect(leak?.length).toBe(0);
  });

  it("un visiteur anonyme ne lit aucune observation en masse", async () => {
    const anonClient = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data } = await anonClient.from("regime_observations").select("*");
    expect(data?.length).toBe(0);
  });
});
