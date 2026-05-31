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
  actor         text not null,
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
