# Lot 2 · A — Fondations sécurisées — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Doter Strate d'une authentification multi-tenant + d'un coffre de secrets vendor chiffré, socle de l'agent de provisionnement (Lot 2 B).

**Architecture:** Supabase Auth (3 méthodes) adossé aux rails RLS existants (`circles`/`memberships`, trigger `handle_new_user` qui crée déjà le cercle perso). Coffre = chiffrement par enveloppe app-level (KEK env serveur, DEK par secret, AES-256-GCM) ; déchiffrement **serveur uniquement** via le rôle `service_role` ; UI sur une **vue métadonnées** (jamais le chiffré). Migration anon→auth du profil localStorage vers `configurations`.

**Tech Stack:** Next.js 15 (App Router, server actions), `@supabase/ssr`, `node:crypto` (AES-256-GCM), Vitest, Playwright. Spec : `docs/superpowers/specs/2026-05-31-lot2-fondations-securisees-design.md`.

---

## Structure des fichiers

- `lib/vault/crypto.ts` *(créé)* — chiffrement enveloppe **pur** (clés en argument). Aucune I/O.
- `lib/vault/server.ts` *(créé, `server-only`)* — lit la KEK de l'env, expose encrypt/decrypt côté serveur.
- `lib/vault/credentials.ts` *(créé, serveur)* — store/read/list/revoke + écriture de l'audit, via `service_role`.
- `lib/vault/__tests__/crypto.test.ts` *(créé)* — round-trip, altération, rewrap.
- `lib/vault/__tests__/credentials.test.ts` *(créé)* — helpers avec client mocké.
- `lib/vault/__tests__/rls.integration.test.ts` *(créé, gated)* — isolation RLS contre Supabase local.
- `supabase/migrations/20260601090000_vendor_vault.sql` *(créé)* — tables + vue + RLS.
- `lib/supabase/types.ts` *(modifié)* — `VendorCredentialMetaRow`, `CredentialAccessRow`, types DB.
- `lib/supabase/auth.ts` *(créé)* — `getAuthUser()` serveur (`getUser()`, jamais `getSession` seul).
- `middleware.ts` *(modifié)* — rafraîchit la session Supabase en plus de la locale.
- `app/actions/account.ts` *(créé, server actions)* — `migrateAnonymousProfile`, `storeVendorCredential`, `revokeVendorCredential`.
- `app/connexion/page.tsx` *(créé)* — écran de connexion (3 méthodes).
- `app/compte/page.tsx` *(créé)* — indicateur de compte + écran « Mes accès vendor ».
- `components/account/AccountMenu.tsx` *(créé)* — bouton connexion/déconnexion + circle courant.
- `components/account/VendorCredentials.tsx` *(créé)* — liste métadonnées + ajout/révocation.
- `messages/{fr,en,ar}.json` *(modifié)* — namespace `Account`.

---

## Task 1 : Coffre — chiffrement enveloppe pur

**Files:**
- Create: `lib/vault/crypto.ts`
- Test: `lib/vault/__tests__/crypto.test.ts`

- [ ] **Step 1 : Écrire le test (échoue)**

```ts
// lib/vault/__tests__/crypto.test.ts
import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { encryptSecret, decryptSecret, rewrapDek } from "@/lib/vault/crypto";

const KEK = randomBytes(32);

describe("coffre — chiffrement enveloppe (Lot 2 A)", () => {
  it("round-trip : déchiffre exactement le secret", () => {
    const rec = encryptSecret("sk-vendor-token-123", KEK);
    expect(decryptSecret(rec, KEK)).toBe("sk-vendor-token-123");
  });

  it("le chiffré ne contient jamais le clair", () => {
    const rec = encryptSecret("PLAINTEXT_SECRET", KEK);
    expect(rec.ciphertext).not.toContain("PLAINTEXT_SECRET");
    expect(JSON.stringify(rec)).not.toContain("PLAINTEXT_SECRET");
  });

  it("toute altération du chiffré (ou du tag) fait échouer le déchiffrement", () => {
    const rec = encryptSecret("abc", KEK);
    const tampered = { ...rec, ciphertext: Buffer.from("zzzz", "utf-8").toString("base64") };
    expect(() => decryptSecret(tampered, KEK)).toThrow();
  });

  it("une mauvaise KEK ne déchiffre pas", () => {
    const rec = encryptSecret("abc", KEK);
    expect(() => decryptSecret(rec, randomBytes(32))).toThrow();
  });

  it("rewrap : nouvelle KEK déchiffre, l'ancienne ne déchiffre plus", () => {
    const rec = encryptSecret("token", KEK);
    const newKek = randomBytes(32);
    const rewrapped = rewrapDek(rec, KEK, newKek);
    expect(decryptSecret(rewrapped, newKek)).toBe("token");
    expect(() => decryptSecret(rewrapped, KEK)).toThrow();
    expect(rewrapped.ciphertext).toBe(rec.ciphertext); // le secret n'est pas re-chiffré
  });

  it("rejette une KEK de mauvaise longueur", () => {
    expect(() => encryptSecret("x", randomBytes(16))).toThrow();
  });
});
```

- [ ] **Step 2 : Lancer le test → échec**

Run: `npx vitest run lib/vault/__tests__/crypto.test.ts`
Expected: FAIL (`Cannot find module '@/lib/vault/crypto'`).

- [ ] **Step 3 : Implémenter le module pur**

```ts
// lib/vault/crypto.ts
// Chiffrement par enveloppe (AES-256-GCM), PUR : les clés sont passées en argument (zéro env, zéro I/O).
// DEK aléatoire par secret, wrappée par la KEK → rotation de KEK = re-wrap des DEK (secret inchangé).
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";

export type EncryptedSecret = {
  ciphertext: string; // base64 — secret chiffré par la DEK
  wrappedDek: string; // base64 — DEK chiffrée par la KEK
  ivSecret: string;
  tagSecret: string;
  ivDek: string;
  tagDek: string;
};

function b64(s: string): Buffer {
  return Buffer.from(s, "base64");
}

function encGcm(key: Buffer, plaintext: Buffer): { ct: Buffer; iv: Buffer; tag: Buffer } {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { ct, iv, tag: cipher.getAuthTag() };
}

function decGcm(key: Buffer, ct: Buffer, iv: Buffer, tag: Buffer): Buffer {
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

function assertKek(kek: Buffer): void {
  if (kek.length !== 32) throw new Error("La KEK doit faire 32 octets (AES-256).");
}

export function encryptSecret(plaintext: string, kek: Buffer): EncryptedSecret {
  assertKek(kek);
  const dek = randomBytes(32);
  const s = encGcm(dek, Buffer.from(plaintext, "utf-8"));
  const w = encGcm(kek, dek);
  return {
    ciphertext: s.ct.toString("base64"),
    ivSecret: s.iv.toString("base64"),
    tagSecret: s.tag.toString("base64"),
    wrappedDek: w.ct.toString("base64"),
    ivDek: w.iv.toString("base64"),
    tagDek: w.tag.toString("base64"),
  };
}

export function decryptSecret(rec: EncryptedSecret, kek: Buffer): string {
  assertKek(kek);
  const dek = decGcm(kek, b64(rec.wrappedDek), b64(rec.ivDek), b64(rec.tagDek));
  return decGcm(dek, b64(rec.ciphertext), b64(rec.ivSecret), b64(rec.tagSecret)).toString("utf-8");
}

export function rewrapDek(rec: EncryptedSecret, oldKek: Buffer, newKek: Buffer): EncryptedSecret {
  assertKek(oldKek);
  assertKek(newKek);
  const dek = decGcm(oldKek, b64(rec.wrappedDek), b64(rec.ivDek), b64(rec.tagDek));
  const w = encGcm(newKek, dek);
  return { ...rec, wrappedDek: w.ct.toString("base64"), ivDek: w.iv.toString("base64"), tagDek: w.tag.toString("base64") };
}
```

- [ ] **Step 4 : Lancer le test → succès**

Run: `npx vitest run lib/vault/__tests__/crypto.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5 : Commit**

```bash
git add lib/vault/crypto.ts lib/vault/__tests__/crypto.test.ts
git commit -m "[Lot2-A] coffre : chiffrement enveloppe pur (AES-256-GCM) + tests"
```

---

## Task 2 : Coffre — accesseur serveur (KEK depuis l'env)

**Files:**
- Create: `lib/vault/server.ts`
- Test: `lib/vault/__tests__/server.test.ts`

- [ ] **Step 1 : Écrire le test (échoue)**

```ts
// lib/vault/__tests__/server.test.ts
import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { encryptWithEnvKek, decryptWithEnvKek, currentKeyVersion } from "@/lib/vault/server";

const KEK_B64 = randomBytes(32).toString("base64");

describe("coffre serveur (KEK env)", () => {
  it("chiffre puis déchiffre via la KEK de l'env", () => {
    const env = { STRATE_VAULT_MASTER_KEY: KEK_B64, STRATE_VAULT_KEY_VERSION: "1" };
    const rec = encryptWithEnvKek("token", env);
    expect(decryptWithEnvKek(rec, env)).toBe("token");
    expect(currentKeyVersion(env)).toBe(1);
  });

  it("KEK absente → erreur explicite (jamais de fonctionnement silencieux)", () => {
    expect(() => encryptWithEnvKek("x", {})).toThrow(/STRATE_VAULT_MASTER_KEY/);
  });
});
```

- [ ] **Step 2 : Lancer → échec**

Run: `npx vitest run lib/vault/__tests__/server.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3 : Implémenter l'accesseur serveur**

```ts
// lib/vault/server.ts
// Accès au coffre CÔTÉ SERVEUR uniquement : lit la KEK de l'environnement. La fonction `env` est
// injectable pour les tests ; en prod elle lit `process.env`. Ne jamais importer ce module côté client.
import "server-only";
import { encryptSecret, decryptSecret, type EncryptedSecret } from "./crypto";

type Env = Record<string, string | undefined>;

function readKek(env: Env): Buffer {
  const b64 = env.STRATE_VAULT_MASTER_KEY;
  if (b64 === undefined || b64.length === 0) {
    throw new Error("STRATE_VAULT_MASTER_KEY manquante (KEK du coffre). Refus de chiffrer/déchiffrer.");
  }
  const kek = Buffer.from(b64, "base64");
  if (kek.length !== 32) throw new Error("STRATE_VAULT_MASTER_KEY doit décoder en 32 octets.");
  return kek;
}

export function currentKeyVersion(env: Env = process.env): number {
  const v = Number.parseInt(env.STRATE_VAULT_KEY_VERSION ?? "1", 10);
  return Number.isFinite(v) && v > 0 ? v : 1;
}

export function encryptWithEnvKek(plaintext: string, env: Env = process.env): EncryptedSecret {
  return encryptSecret(plaintext, readKek(env));
}

export function decryptWithEnvKek(rec: EncryptedSecret, env: Env = process.env): string {
  return decryptSecret(rec, readKek(env));
}
```

> Note : `server-only` est déjà une dépendance transitive de Next 15. Si l'import échoue au test (jsdom),
> les tests passent `env` explicitement et n'exécutent pas de garde client — `server-only` ne lève qu'en
> bundle client.

- [ ] **Step 4 : Lancer → succès**

Run: `npx vitest run lib/vault/__tests__/server.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5 : Commit**

```bash
git add lib/vault/server.ts lib/vault/__tests__/server.test.ts
git commit -m "[Lot2-A] coffre : accesseur serveur (KEK env, server-only)"
```

---

## Task 3 : Migration — `vendor_credentials` + `credential_access` + vue + RLS

**Files:**
- Create: `supabase/migrations/20260601090000_vendor_vault.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- Coffre de secrets vendor (Lot 2 A). RLS ACTIVÉE ; la table de base n'a AUCUNE policy
-- `authenticated` → inaccessible au client (seul service_role la lit/écrit). L'UI lit une vue
-- métadonnées (sans colonnes chiffrées), filtrée par appartenance au cercle.

create table public.vendor_credentials (
  id          uuid primary key default gen_random_uuid(),
  circle_id   uuid not null references public.circles (id) on delete cascade,
  provider    text not null,
  label       text not null default '',
  kind        text not null check (kind in ('oauth_token', 'api_key')),
  ciphertext  text not null,
  wrapped_dek text not null,
  iv_secret   text not null,
  tag_secret  text not null,
  iv_dek      text not null,
  tag_dek     text not null,
  key_version integer not null default 1,
  expires_at  timestamptz,
  revoked_at  timestamptz,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.vendor_credentials (circle_id);

create table public.credential_access (
  id            uuid primary key default gen_random_uuid(),
  circle_id     uuid not null references public.circles (id) on delete cascade,
  credential_id uuid references public.vendor_credentials (id) on delete set null,
  actor         text not null,   -- auth.uid()::text ou 'agent'
  action        text not null check (action in ('store', 'read', 'rotate', 'revoke')),
  context       jsonb not null default '{}'::jsonb,
  at            timestamptz not null default now()
);
create index on public.credential_access (circle_id);

alter table public.vendor_credentials enable row level security;
alter table public.credential_access  enable row level security;

-- vendor_credentials : RLS activée + ZÉRO policy authenticated = deny total pour le client.
-- Seul service_role (qui contourne la RLS) lit/écrit le chiffré, via les server actions.

-- credential_access : les membres lisent l'audit de LEUR cercle ; insert réservé au serveur.
create policy credaccess_select on public.credential_access for select to authenticated
  using (public.is_circle_member(circle_id));

-- Vue métadonnées : security definer (bypass RLS de la table de base) + filtre d'appartenance
-- explicite ; n'expose AUCUNE colonne chiffrée.
create view public.vendor_credentials_meta
with (security_invoker = false) as
  select id, circle_id, provider, label, kind, expires_at, revoked_at, created_at
  from public.vendor_credentials
  where public.is_circle_member(circle_id);

grant select on public.vendor_credentials_meta to authenticated;
```

- [ ] **Step 2 : Appliquer en local + vérifier**

Run:
```bash
npx supabase start
npx supabase db reset
```
Expected: migration appliquée sans erreur ; `vendor_credentials` + `credential_access` présentes, `rowsecurity = true` sur les deux.

- [ ] **Step 3 : Vérifier RLS + rollback (règle supabase.md)**

Run (psql local, via `npx supabase status` pour l'URL) :
```bash
psql "$LOCAL_DB_URL" -c "select relname, relrowsecurity from pg_class where relname in ('vendor_credentials','credential_access');"
```
Expected: `relrowsecurity = t` pour les deux.
Tester le rollback : `npx supabase db reset` ré-applique proprement (idempotence vérifiée).

- [ ] **Step 4 : Commit**

```bash
git add supabase/migrations/20260601090000_vendor_vault.sql
git commit -m "[Lot2-A] migration : vendor_credentials + credential_access + vue méta + RLS"
```

---

## Task 4 : Types DB + helpers serveur de credentials

**Files:**
- Modify: `lib/supabase/types.ts`
- Create: `lib/vault/credentials.ts`
- Test: `lib/vault/__tests__/credentials.test.ts`

- [ ] **Step 1 : Ajouter les types DB**

Dans `lib/supabase/types.ts`, ajouter :

```ts
export type VendorCredentialKind = "oauth_token" | "api_key";

/** Métadonnées exposées par la vue `vendor_credentials_meta` (jamais le chiffré). */
export type VendorCredentialMetaRow = {
  id: string;
  circle_id: string;
  provider: string;
  label: string;
  kind: VendorCredentialKind;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type CredentialAction = "store" | "read" | "rotate" | "revoke";
export type CredentialAccessRow = {
  id: string;
  circle_id: string;
  credential_id: string | null;
  actor: string;
  action: CredentialAction;
  context: Record<string, unknown>;
  at: string;
};
```

- [ ] **Step 2 : Écrire le test des helpers (échoue)**

```ts
// lib/vault/__tests__/credentials.test.ts
import { describe, it, expect, vi } from "vitest";
import { storeVendorCredentialRecord } from "@/lib/vault/credentials";

// Faux client admin : capture les insertions, ne renvoie pas d'erreur.
function fakeAdmin() {
  const inserts: { table: string; row: Record<string, unknown> }[] = [];
  return {
    inserts,
    from(table: string) {
      return {
        insert: async (row: Record<string, unknown>) => {
          inserts.push({ table, row });
          return { data: null, error: null };
        },
      };
    },
  };
}

const ENV = { STRATE_VAULT_MASTER_KEY: Buffer.alloc(32, 7).toString("base64"), STRATE_VAULT_KEY_VERSION: "1" };

describe("storeVendorCredentialRecord", () => {
  it("chiffre le secret avant insertion et trace l'accès, sans jamais persister le clair", async () => {
    const admin = fakeAdmin();
    await storeVendorCredentialRecord(admin, {
      circleId: "c1", userId: "u1", provider: "hetzner", label: "Prod", kind: "api_key", secret: "SK_PLAIN_123",
    }, ENV);

    const credInsert = admin.inserts.find((i) => i.table === "vendor_credentials");
    expect(credInsert).toBeDefined();
    expect(JSON.stringify(credInsert?.row)).not.toContain("SK_PLAIN_123"); // jamais le clair
    expect(credInsert?.row.ciphertext).toBeTypeOf("string");

    const audit = admin.inserts.find((i) => i.table === "credential_access");
    expect(audit?.row).toMatchObject({ circle_id: "c1", action: "store", actor: "u1" });
    expect(JSON.stringify(audit?.row)).not.toContain("SK_PLAIN_123");
  });
});
```

- [ ] **Step 3 : Lancer → échec**

Run: `npx vitest run lib/vault/__tests__/credentials.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 4 : Implémenter les helpers serveur**

```ts
// lib/vault/credentials.ts
// Helpers CÔTÉ SERVEUR du coffre : chiffrent/déchiffrent via la KEK env et écrivent l'audit.
// Le client passé est un client admin (service_role) ou un faux client de test exposant `.from().insert()`.
import "server-only";
import { encryptWithEnvKek, currentKeyVersion } from "./server";

type Env = Record<string, string | undefined>;
type Inserter = { from: (table: string) => { insert: (row: Record<string, unknown>) => Promise<{ error: unknown }> } };

export type StoreArgs = {
  circleId: string;
  userId: string;
  provider: string;
  label: string;
  kind: "oauth_token" | "api_key";
  secret: string;
};

/** Chiffre + insère un credential, puis trace l'accès `store`. Ne persiste JAMAIS le clair. */
export async function storeVendorCredentialRecord(admin: Inserter, args: StoreArgs, env: Env = process.env): Promise<void> {
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
    context: { provider: args.provider }, // jamais de secret dans le contexte
  });
}
```

- [ ] **Step 5 : Lancer → succès**

Run: `npx vitest run lib/vault/__tests__/credentials.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6 : Commit**

```bash
git add lib/supabase/types.ts lib/vault/credentials.ts lib/vault/__tests__/credentials.test.ts
git commit -m "[Lot2-A] coffre : types DB + helper serveur store (chiffré + audit)"
```

---

## Task 5 : RLS integration (gated) — isolation du coffre

**Files:**
- Create: `lib/vault/__tests__/rls.integration.test.ts`

- [ ] **Step 1 : Écrire le test gated (suit le pattern `lib/catalog/__tests__/rls.integration.test.ts`)**

```ts
// lib/vault/__tests__/rls.integration.test.ts
// Gated : ne tourne que si SUPABASE_TEST_URL / SUPABASE_TEST_ANON_KEY / SUPABASE_TEST_SECRET_KEY.
// Prouve : (1) un membre ne lit que les MÉTADONNÉES de SON cercle via la vue ; (2) la table de base
// est inaccessible au rôle authenticated (même pour son propre cercle) ; (3) service_role lit le chiffré.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_TEST_URL;
const ANON = process.env.SUPABASE_TEST_ANON_KEY;
const SECRET = process.env.SUPABASE_TEST_SECRET_KEY;
const ready = Boolean(URL && ANON && SECRET);
const d = ready ? describe : describe.skip;

d("RLS coffre (intégration)", () => {
  let admin: SupabaseClient;
  let circleId = "";
  beforeAll(async () => {
    admin = createClient(URL ?? "", SECRET ?? "", { auth: { persistSession: false } });
    // Crée un utilisateur + récupère son cercle perso (trigger handle_new_user).
    const { data: u } = await admin.auth.admin.createUser({ email: `vault-${Date.now()}@t.test`, password: "Passw0rd!integration", email_confirm: true });
    const uid = u.user?.id ?? "";
    const { data: m } = await admin.from("memberships").select("circle_id").eq("user_id", uid).single();
    circleId = m?.circle_id ?? "";
    await admin.from("vendor_credentials").insert({
      circle_id: circleId, provider: "hetzner", label: "Prod", kind: "api_key",
      ciphertext: "x", wrapped_dek: "x", iv_secret: "x", tag_secret: "x", iv_dek: "x", tag_dek: "x", created_by: uid,
    });
  });
  afterAll(async () => {
    if (circleId) await admin.from("circles").delete().eq("id", circleId);
  });

  it("le rôle authenticated NE PEUT PAS lire la table de base (chiffré protégé)", async () => {
    const anon = createClient(URL ?? "", ANON ?? "", { auth: { persistSession: false } });
    const { data } = await anon.from("vendor_credentials").select("ciphertext");
    expect(data ?? []).toHaveLength(0); // aucune policy authenticated → rien
  });

  it("service_role lit le chiffré", async () => {
    const { data } = await admin.from("vendor_credentials").select("ciphertext").eq("circle_id", circleId);
    expect((data ?? []).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2 : Lancer → skip (CI vert sans creds) ou pass (avec Supabase local)**

Run: `npx vitest run lib/vault/__tests__/rls.integration.test.ts`
Expected: SKIP si pas de creds ; PASS si `SUPABASE_TEST_*` fournis.

- [ ] **Step 3 : Commit**

```bash
git add lib/vault/__tests__/rls.integration.test.ts
git commit -m "[Lot2-A] coffre : test d'intégration RLS (gated) — isolation du chiffré"
```

---

## Task 6 : Auth — `getAuthUser()` serveur + session dans le middleware

**Files:**
- Create: `lib/supabase/auth.ts`
- Modify: `middleware.ts`

> Prérequis de config (hors code, à faire dans Supabase) : activer les providers e-mail (magic link +
> mot de passe) et OAuth Google/GitHub. En local : `supabase/config.toml` (`[auth.email]`, `[auth.external.google]`,
> `[auth.external.github]`). En prod : dashboard Supabase self-hosté. Documenté dans la spec.

- [ ] **Step 1 : Implémenter `getAuthUser()` (getUser, jamais getSession seul — règle supabase.md)**

```ts
// lib/supabase/auth.ts
// Identité serveur : TOUJOURS via getUser() (vérifie le JWT côté Supabase), jamais getSession() seul.
import { createClient } from "./server";

export async function getAuthUser(): Promise<{ id: string; email: string | null } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error !== null || data.user === null) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}
```

- [ ] **Step 2 : Rafraîchir la session dans le middleware (en plus de la locale)**

Dans `middleware.ts`, après la résolution de la locale et avant le `return response`, ajouter le refresh
de session `@supabase/ssr` (lit/réécrit les cookies sur la même `response`) :

```ts
import { createServerClient } from "@supabase/ssr";
// ... (imports locale existants conservés)

// Dans middleware(), après avoir construit `response` :
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  },
);
// Rafraîchit le jeton si nécessaire (ne JAMAIS logguer le résultat — règle supabase.md).
await supabase.auth.getUser();
```

> Le `middleware` devient `async`. Adapter la signature : `export async function middleware(request: NextRequest): Promise<NextResponse>`.
> Si `NEXT_PUBLIC_SUPABASE_URL` est absente (dev sans Supabase), envelopper le bloc dans un `try/catch`
> silencieux pour ne pas casser le rendu anonyme (Lot 1 reste utilisable sans Supabase).

- [ ] **Step 3 : Vérifier le build + typecheck**

Run: `npm run typecheck && npm run build`
Expected: 0 erreur ; le middleware compile en async.

- [ ] **Step 4 : Commit**

```bash
git add lib/supabase/auth.ts middleware.ts
git commit -m "[Lot2-A] auth : getAuthUser() serveur + refresh session middleware"
```

---

## Task 7 : Server actions — migration anon→auth + store/revoke credential

**Files:**
- Create: `app/actions/account.ts`

> Le cercle perso est DÉJÀ créé par le trigger `handle_new_user` (init_rails) → pas de bootstrap à coder.
> Ces actions s'appuient sur `getAuthUser()` + le client admin (`createAdminClient`, service_role serveur).

- [ ] **Step 1 : Écrire les server actions**

```ts
// app/actions/account.ts
"use server";

import { getAuthUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { storeVendorCredentialRecord } from "@/lib/vault/credentials";
import { DEFAULT_PROFILE } from "@/lib/wizard/defaultProfile";
import type { Profile } from "@/lib/engine";

/** Cercle personnel de l'utilisateur courant (créé par le trigger à l'inscription). */
async function currentCircleId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("memberships").select("circle_id").limit(1).maybeSingle();
  return data?.circle_id ?? null;
}

/** Persiste le profil localStorage dans `configurations` (une fois) à la 1ʳᵉ connexion. */
export async function migrateAnonymousProfile(profile: Partial<Profile>): Promise<{ ok: boolean }> {
  const user = await getAuthUser();
  if (user === null) return { ok: false };
  const circleId = await currentCircleId();
  if (circleId === null) return { ok: false };
  const supabase = await createClient();
  const { count } = await supabase.from("configurations").select("id", { count: "exact", head: true }).eq("circle_id", circleId);
  if ((count ?? 0) > 0) return { ok: true }; // déjà migré, on ne réécrase pas
  await supabase.from("configurations").insert({
    circle_id: circleId,
    created_by: user.id,
    label: "Profil importé",
    profile: { ...DEFAULT_PROFILE, ...profile },
  });
  return { ok: true };
}

/** Stocke un credential vendor (chiffré côté serveur via service_role). Le clair ne quitte jamais le serveur. */
export async function storeVendorCredential(input: {
  provider: string; label: string; kind: "oauth_token" | "api_key"; secret: string;
}): Promise<{ ok: boolean }> {
  const user = await getAuthUser();
  if (user === null) return { ok: false };
  const circleId = await currentCircleId();
  if (circleId === null) return { ok: false };
  const admin = createAdminClient();
  if (admin === null) return { ok: false };
  await storeVendorCredentialRecord(admin, {
    circleId, userId: user.id, provider: input.provider, label: input.label, kind: input.kind, secret: input.secret,
  });
  return { ok: true };
}

/** Révocation logique + trace. */
export async function revokeVendorCredential(credentialId: string): Promise<{ ok: boolean }> {
  const user = await getAuthUser();
  if (user === null) return { ok: false };
  const circleId = await currentCircleId();
  if (circleId === null) return { ok: false };
  const admin = createAdminClient();
  if (admin === null) return { ok: false };
  await admin.from("vendor_credentials").update({ revoked_at: new Date().toISOString() }).eq("id", credentialId).eq("circle_id", circleId);
  await admin.from("credential_access").insert({ circle_id: circleId, credential_id: credentialId, actor: user.id, action: "revoke", context: {} });
  return { ok: true };
}
```

> ⚠ `createAdminClient` existe déjà (`lib/supabase/admin.ts`). `new Date().toISOString()` est autorisé ici
> (server action, pas le moteur pur). Vérifier que `Database` type couvre les nouvelles tables ; sinon
> typer les appels admin en `as` justifié ou étendre le type généré.

- [ ] **Step 2 : Typecheck**

Run: `npm run typecheck`
Expected: 0 erreur.

- [ ] **Step 3 : Commit**

```bash
git add app/actions/account.ts
git commit -m "[Lot2-A] server actions : migration anon→auth + store/revoke credential"
```

---

## Task 8 : UI — connexion, indicateur de compte, « Mes accès vendor »

**Files:**
- Create: `app/connexion/page.tsx`, `app/compte/page.tsx`
- Create: `components/account/AccountMenu.tsx`, `components/account/VendorCredentials.tsx`
- Modify: `messages/{fr,en,ar}.json` (namespace `Account`)

- [ ] **Step 1 : Ajouter les messages i18n (namespace `Account`) aux 3 locales**

Clés (fr / en / ar) sous `Account` : `signIn`, `signOut`, `magicLink`, `password`, `oauthGoogle`,
`oauthGithub`, `emailLabel`, `passwordLabel`, `sendMagicLink`, `myAccount`, `vendorTitle`,
`vendorIntro`, `addCredential`, `providerLabel`, `labelLabel`, `secretLabel`, `secretHint`
(« Saisi une fois, jamais réaffiché »), `kindApiKey`, `kindOauth`, `store`, `revoke`, `revoked`,
`noCredentials`, `expiresOn`, `signedInAs`. (Valeurs FR accentuées ; EN natif ; AR brouillon MSA.)

- [ ] **Step 2 : `AccountMenu` (client) — connexion/déconnexion + compte courant**

```tsx
// components/account/AccountMenu.tsx
"use client";
import { useEffect, useState, type ReactElement } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

export function AccountMenu(): ReactElement {
  const t = useTranslations("Account");
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setEmail(session?.user?.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  if (email === null) {
    return <Link href="/connexion" className="text-body-sm text-on-surface-variant hover:text-on-surface">{t("signIn")}</Link>;
  }
  return (
    <Link href="/compte" className="text-body-sm text-on-surface-variant hover:text-on-surface">
      {t("signedInAs", { email })}
    </Link>
  );
}
```

- [ ] **Step 3 : `app/connexion/page.tsx` — 3 méthodes**

```tsx
// app/connexion/page.tsx
"use client";
import { useState, type ReactElement } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

export default function ConnexionPage(): ReactElement {
  const t = useTranslations("Account");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const supabase = createClient();
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  async function magicLink(): Promise<void> {
    await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/compte` } });
    setSent(true);
  }
  async function oauth(provider: "google" | "github"): Promise<void> {
    await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${origin}/compte` } });
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="font-display text-headline-lg text-on-surface">{t("signIn")}</h1>
      <div className="mt-6 space-y-3">
        <label className="block">
          <span className="text-label-caps uppercase text-on-surface-variant">{t("emailLabel")}</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-card border border-outline bg-surface px-3 py-2 text-on-surface" />
        </label>
        <button type="button" onClick={() => void magicLink()} disabled={email === ""} className="w-full rounded-card bg-primary px-4 py-2 text-on-primary disabled:opacity-50">
          {sent ? t("sendMagicLink") + " ✓" : t("sendMagicLink")}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => void oauth("google")} className="rounded-card border border-outline px-4 py-2 text-on-surface">{t("oauthGoogle")}</button>
          <button type="button" onClick={() => void oauth("github")} className="rounded-card border border-outline px-4 py-2 text-on-surface">{t("oauthGithub")}</button>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4 : `VendorCredentials` + `app/compte/page.tsx`**

`app/compte/page.tsx` (server) : `getAuthUser()` → si null, redirige `/connexion` ; sinon lit la vue
`vendor_credentials_meta` via le client serveur et rend `<VendorCredentials items={...} />`.
`components/account/VendorCredentials.tsx` (client) : liste les métadonnées (provider, label, kind,
statut révoqué/expire), un formulaire d'ajout (provider, label, kind, **secret saisi une fois**) appelant
`storeVendorCredential`, et un bouton `revoke` appelant `revokeVendorCredential`. Le champ secret n'est
**jamais** pré-rempli ni réaffiché.

```tsx
// app/compte/page.tsx
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { VendorCredentials } from "@/components/account/VendorCredentials";
import { getTranslations } from "next-intl/server";
import type { VendorCredentialMetaRow } from "@/lib/supabase/types";
import type { ReactElement } from "react";

export default async function ComptePage(): Promise<ReactElement> {
  const user = await getAuthUser();
  if (user === null) redirect("/connexion");
  const t = await getTranslations("Account");
  const supabase = await createClient();
  const { data } = await supabase.from("vendor_credentials_meta").select("*").order("created_at", { ascending: false });
  const items: VendorCredentialMetaRow[] = data ?? [];
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-display text-headline-lg text-on-surface">{t("myAccount")}</h1>
      <VendorCredentials items={items} />
    </main>
  );
}
```

```tsx
// components/account/VendorCredentials.tsx
"use client";
import { useState, type ReactElement } from "react";
import { useTranslations } from "next-intl";
import { storeVendorCredential, revokeVendorCredential } from "@/app/actions/account";
import type { VendorCredentialMetaRow } from "@/lib/supabase/types";

export function VendorCredentials({ items }: { items: VendorCredentialMetaRow[] }): ReactElement {
  const t = useTranslations("Account");
  const [provider, setProvider] = useState("");
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<"api_key" | "oauth_token">("api_key");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(): Promise<void> {
    setBusy(true);
    await storeVendorCredential({ provider, label, kind, secret });
    setSecret(""); // jamais conservé en mémoire après envoi
    setBusy(false);
    window.location.reload();
  }

  return (
    <section className="mt-6">
      <h2 className="font-display text-headline-md text-on-surface">{t("vendorTitle")}</h2>
      <p className="mt-1 text-body-sm text-on-surface-variant">{t("vendorIntro")}</p>

      <ul className="mt-4 space-y-2">
        {items.length === 0 ? <li className="text-body-sm text-on-surface-variant">{t("noCredentials")}</li> : null}
        {items.map((c) => (
          <li key={c.id} className="flex items-center justify-between rounded-card bg-surface-container p-3 text-body-sm">
            <span><strong>{c.provider}</strong> · {c.label} · {c.kind === "api_key" ? t("kindApiKey") : t("kindOauth")}{c.revoked_at !== null ? ` · ${t("revoked")}` : ""}</span>
            {c.revoked_at === null ? (
              <button type="button" onClick={() => void revokeVendorCredential(c.id).then(() => window.location.reload())} className="text-error">{t("revoke")}</button>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="mt-4 grid gap-2 rounded-card border border-outline-variant p-4">
        <input placeholder={t("providerLabel")} value={provider} onChange={(e) => setProvider(e.target.value)} className="rounded-card border border-outline bg-surface px-3 py-2" />
        <input placeholder={t("labelLabel")} value={label} onChange={(e) => setLabel(e.target.value)} className="rounded-card border border-outline bg-surface px-3 py-2" />
        <input type="password" placeholder={t("secretLabel")} value={secret} onChange={(e) => setSecret(e.target.value)} className="rounded-card border border-outline bg-surface px-3 py-2" />
        <p className="text-xs text-on-surface-variant/70">{t("secretHint")}</p>
        <button type="button" onClick={() => void add()} disabled={busy || provider === "" || secret === ""} className="rounded-card bg-primary px-4 py-2 text-on-primary disabled:opacity-50">{t("store")}</button>
      </div>
    </section>
  );
}
```

- [ ] **Step 5 : Brancher `AccountMenu` dans la nav** (`app/page.tsx` header + layout si nav partagée) et ajouter le lien.

- [ ] **Step 6 : Qualité complète**

Run: `npm run typecheck && npm run lint && npx vitest run && npm run build`
Expected: typecheck 0, lint 0/0 (garde i18n verte), tests verts, build OK.

- [ ] **Step 7 : e2e — parcours connexion (magic link mocké)**

Ajouter `e2e/auth.spec.ts` : visite `/connexion`, vérifie les 3 méthodes affichées ; (si Supabase de test
dispo) connexion OTP → redirige `/compte` → circle présent. Sinon, assert de rendu uniquement.

- [ ] **Step 8 : Commit**

```bash
git add app/connexion app/compte components/account messages/ e2e/auth.spec.ts app/page.tsx
git commit -m "[Lot2-A] UI : connexion (3 méthodes) + compte + Mes accès vendor (i18n)"
```

---

## Auto-revue (couverture spec)

- Auth 3 méthodes → Task 6 (config) + Task 8 (UI magic link + OAuth). ✓
- Tenancy 1 user → 1 circle → **trigger existant** (init_rails) ; migration anon→auth → Task 7. ✓
- Coffre enveloppe + déchiffrement serveur-only → Tasks 1, 2, 4. ✓
- Table inaccessible client + vue méta + audit → Task 3 (RLS) + Task 5 (preuve). ✓
- Threat model (clé hors DB/client, intégrité GCM, audit, pas de log JWT) → Tasks 2, 3, 6. ✓
- Tests (round-trip + altération, RLS integration, auth e2e) → Tasks 1, 5, 8. ✓
- YAGNI (équipes/SSO/KMS exclus) → respecté.

**Note de déploiement** : `STRATE_VAULT_MASTER_KEY` (base64 de 32 octets aléatoires) + `STRATE_VAULT_KEY_VERSION=1`
à ajouter au coffre de secrets global + à l'env Coolify de prod avant le déploiement de Task 2+. Activer
les providers Auth (e-mail + Google/GitHub) côté Supabase. Migration prod appliquée manuellement (SSH+psql,
cf. passation) — l'auto-deploy ne déclenche pas les migrations.
```
