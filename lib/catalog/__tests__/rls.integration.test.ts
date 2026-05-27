// Test d'intégration RLS de l'audit trail catalogue (S-036) contre une instance Supabase LOCALE.
// Gated : ne s'exécute que si les creds de test sont fournis (sinon skip → CI vert) :
//   SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, SUPABASE_TEST_SECRET_KEY
// Prouve : un tenant ne lit PAS les observations d'un autre ; un visiteur anonyme ne lit rien en masse.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { seedCatalog } from "@/lib/catalog/catalog-seed";
import { buildCatalogObservations } from "@/lib/catalog/observation";
import { decidePreset, type Profile } from "@/lib/engine";

const URL = process.env.SUPABASE_TEST_URL;
const ANON = process.env.SUPABASE_TEST_ANON_KEY;
const SECRET = process.env.SUPABASE_TEST_SECRET_KEY;
const ready = Boolean(URL && ANON && SECRET);

const url = URL ?? "";
const anonKey = ANON ?? "";
const secretKey = SECRET ?? "";
const password = "Passw0rd!integration";

function profileFixture(): Profile {
  return {
    activity: "pme-startup",
    zone: "ue",
    users: 5,
    contentTypes: ["text"],
    volume: "10to100",
    growth: "medium",
    regulations: ["rgpd"],
    sensitivity: "internal",
    audit: false,
    bitemporal: false,
    techLevel: "hybrid",
    budget: "200to500",
    reqPerDay: "lt1k",
    latency: "fast",
    voices: "solo",
    modules: { bisect: 0, reversal: 0, prereg: 0, mel: 0, conflict: 0 },
  };
}

function observationsFixture(circleId: string, createdBy: string | undefined): ReturnType<typeof buildCatalogObservations> {
  const profile = profileFixture();
  const { preset } = decidePreset(profile);
  const catalog = seedCatalog(preset, profile);
  return buildCatalogObservations({ catalog, circleId, createdBy: createdBy ?? null });
}

describe.skipIf(!ready)("RLS catalog_observations (Supabase local)", () => {
  let admin: SupabaseClient;
  let userA: User | null = null;
  let userB: User | null = null;
  const stamp = Date.now();
  const emailA = `cat_a_${stamp}@mnemo.test`;
  const emailB = `cat_b_${stamp}@mnemo.test`;

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

    const { error } = await clientA.from("catalog_observations").insert(observationsFixture(circleA, userA?.id));
    expect(error).toBeNull();

    const { data: mine } = await clientA.from("catalog_observations").select("*").eq("circle_id", circleA);
    expect((mine?.length ?? 0)).toBeGreaterThanOrEqual(7); // une ligne par couche

    const clientB = createClient(url, anonKey, { auth: { persistSession: false } });
    await clientB.auth.signInWithPassword({ email: emailB, password });
    const { data: leak } = await clientB.from("catalog_observations").select("*").eq("circle_id", circleA);
    expect(leak?.length).toBe(0);
  });

  it("un visiteur anonyme ne lit aucune observation en masse", async () => {
    const anonClient = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data } = await anonClient.from("catalog_observations").select("*");
    expect(data?.length).toBe(0);
  });
});
