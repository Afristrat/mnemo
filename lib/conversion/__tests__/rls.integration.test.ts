// Test d'intégration RLS conversion/data (S-023) contre une instance Supabase LOCALE.
// Gated : ne s'exécute que si les creds de test sont fournis (sinon skip → CI vert) :
//   SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, SUPABASE_TEST_SECRET_KEY
// Prouve : un tenant ne lit PAS les simulations/leads d'un autre ; le rapport partageable
// est accessible par jeton (RPC) ; un visiteur anonyme ne lit aucune donnée en masse.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { buildLead, buildLeadCapture, buildSimulationLog } from "@/lib/conversion/log";
import { recommend } from "@/lib/engine";

const URL = process.env.SUPABASE_TEST_URL;
const ANON = process.env.SUPABASE_TEST_ANON_KEY;
const SECRET = process.env.SUPABASE_TEST_SECRET_KEY;
const ready = Boolean(URL && ANON && SECRET);

const url = URL ?? "";
const anonKey = ANON ?? "";
const secretKey = SECRET ?? "";
const password = "Passw0rd!integration";

function profileFixture(): Parameters<typeof recommend>[0] {
  return {
    activity: "pme-startup",
    zone: "ue",
    users: 1,
    contentTypes: ["text"],
    volume: "1to10",
    growth: "medium",
    regulations: ["rgpd"],
    sensitivity: "internal",
    audit: false,
    bitemporal: false,
    techLevel: "hybrid",
    budget: "50to200",
    reqPerDay: "lt100",
    latency: "fast",
    voices: "solo",
    modules: { bisect: 0, reversal: 0, prereg: 0, mel: 0, conflict: 0 },
  };
}

describe.skipIf(!ready)("RLS conversion/data (Supabase local)", () => {
  let admin: SupabaseClient;
  let userA: User | null = null;
  let userB: User | null = null;
  const stamp = Date.now();
  const emailA = `conv_a_${stamp}@mnemo.test`;
  const emailB = `conv_b_${stamp}@mnemo.test`;

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

  it("une simulation de cercle A n'est PAS lisible par le cercle B (isolation)", async () => {
    const clientA = createClient(url, anonKey, { auth: { persistSession: false } });
    await clientA.auth.signInWithPassword({ email: emailA, password });
    const circleA = await circleOf(clientA);

    const rec = recommend(profileFixture());
    const { data: inserted, error } = await clientA
      .from("simulation_log")
      .insert(buildSimulationLog({ profile: profileFixture(), recommendation: rec, circleId: circleA, createdBy: userA?.id }))
      .select()
      .single();
    expect(error).toBeNull();
    expect(inserted?.circle_id).toBe(circleA);

    // A voit sa simulation
    const { data: mine } = await clientA.from("simulation_log").select("*").eq("circle_id", circleA);
    expect((mine?.length ?? 0)).toBeGreaterThanOrEqual(1);

    // B ne voit rien de A
    const clientB = createClient(url, anonKey, { auth: { persistSession: false } });
    await clientB.auth.signInWithPassword({ email: emailB, password });
    const { data: leak } = await clientB.from("simulation_log").select("*").eq("circle_id", circleA);
    expect(leak?.length).toBe(0);
  });

  it("le rapport partageable est lisible par jeton via la RPC (même anonyme)", async () => {
    const clientA = createClient(url, anonKey, { auth: { persistSession: false } });
    await clientA.auth.signInWithPassword({ email: emailA, password });
    const circleA = await circleOf(clientA);
    const rec = recommend(profileFixture());
    const { data: row } = await clientA
      .from("simulation_log")
      .insert(buildSimulationLog({ profile: profileFixture(), recommendation: rec, circleId: circleA, createdBy: userA?.id }))
      .select("share_token")
      .single();
    const token = row?.share_token ?? "";

    const anonClient = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data: shared, error } = await anonClient.rpc("get_simulation_by_token", { token });
    expect(error).toBeNull();
    expect(shared?.length).toBe(1);
  });

  it("un lead de cercle A n'est PAS lisible par le cercle B (PII, owner-only)", async () => {
    const clientA = createClient(url, anonKey, { auth: { persistSession: false } });
    await clientA.auth.signInWithPassword({ email: emailA, password });
    const circleA = await circleOf(clientA);

    const { error } = await clientA
      .from("lead_capture")
      .insert(buildLeadCapture({ email: "prospect@example.com", circleId: circleA, context: "report" }));
    expect(error).toBeNull();

    const { data: mine } = await clientA.from("lead_capture").select("*").eq("circle_id", circleA);
    expect((mine?.length ?? 0)).toBeGreaterThanOrEqual(1);

    const clientB = createClient(url, anonKey, { auth: { persistSession: false } });
    await clientB.auth.signInWithPassword({ email: emailB, password });
    const { data: leak } = await clientB.from("lead_capture").select("*").eq("circle_id", circleA);
    expect(leak?.length).toBe(0);
  });

  it("un visiteur anonyme ne lit aucune simulation/lead en masse", async () => {
    const anonClient = createClient(url, anonKey, { auth: { persistSession: false } });
    const sims = await anonClient.from("simulation_log").select("*");
    const leads = await anonClient.from("lead_capture").select("*");
    expect(sims.data?.length).toBe(0);
    expect(leads.data?.length).toBe(0);
  });

  it("lead gate : anon peut INSERT dans `leads` mais ne lit jamais la table en masse (PII)", async () => {
    const anonClient = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error } = await anonClient
      .from("leads")
      .insert(buildLead({ name: "Amine", email: `lead_${stamp}@mnemo.test`, preset: "HARD" }));
    expect(error).toBeNull();

    // Aucune lecture publique : la policy SELECT n'autorise pas anon → 0 ligne, jamais la table entière.
    const { data: leak } = await anonClient.from("leads").select("*");
    expect(leak?.length ?? 0).toBe(0);
  });
});
