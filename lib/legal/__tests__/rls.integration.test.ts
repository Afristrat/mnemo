// Test d'intégration RLS de l'audit trail juridique (S-062) contre une instance Supabase LOCALE.
// Gated : ne s'exécute que si les creds de test sont fournis (sinon skip → CI vert) :
//   SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, SUPABASE_TEST_SECRET_KEY
// Prouve : un tenant ne lit PAS les observations d'un autre ; un visiteur anonyme ne lit rien en masse.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { lookupTransferBasis, WATCHED_TRANSFER_FLOWS, type TransferBasis } from "@/lib/legal/transfers";
import { buildTransferObservations } from "@/lib/legal/observation";

const URL = process.env.SUPABASE_TEST_URL;
const ANON = process.env.SUPABASE_TEST_ANON_KEY;
const SECRET = process.env.SUPABASE_TEST_SECRET_KEY;
const ready = Boolean(URL && ANON && SECRET);

const url = URL ?? "";
const anonKey = ANON ?? "";
const secretKey = SECRET ?? "";
const password = "Passw0rd!integration";

function basesFixture(): TransferBasis[] {
  return WATCHED_TRANSFER_FLOWS.map(({ from, to }) => ({ ...lookupTransferBasis(from, to), provenance: "seed" as const }));
}

function observationsFixture(circleId: string, createdBy: string | undefined): ReturnType<typeof buildTransferObservations> {
  return buildTransferObservations({ bases: basesFixture(), circleId, createdBy: createdBy ?? null });
}

describe.skipIf(!ready)("RLS transfer_status_observations (Supabase local)", () => {
  let admin: SupabaseClient;
  let userA: User | null = null;
  let userB: User | null = null;
  const stamp = Date.now();
  const emailA = `legal_a_${stamp}@mnemo.test`;
  const emailB = `legal_b_${stamp}@mnemo.test`;

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

    const { error } = await clientA.from("transfer_status_observations").insert(observationsFixture(circleA, userA?.id));
    expect(error).toBeNull();

    const { data: mine } = await clientA.from("transfer_status_observations").select("*").eq("circle_id", circleA);
    expect((mine?.length ?? 0)).toBeGreaterThanOrEqual(WATCHED_TRANSFER_FLOWS.length);

    const clientB = createClient(url, anonKey, { auth: { persistSession: false } });
    await clientB.auth.signInWithPassword({ email: emailB, password });
    const { data: leak } = await clientB.from("transfer_status_observations").select("*").eq("circle_id", circleA);
    expect(leak?.length).toBe(0);
  });

  it("un visiteur anonyme ne lit aucune observation en masse", async () => {
    const anonClient = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data } = await anonClient.from("transfer_status_observations").select("*");
    expect(data?.length).toBe(0);
  });
});
