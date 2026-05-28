-- Console admin super-admin (S-053) : prompts système versionnés, sortis du code dur.
-- DÉCISION Amine : super-admin GLOBAL (hors tenant) — un admin plateforme édite les prompts pour
-- tous. Auth super-admin (table dédiée, PAS la RLS de cercle). Historique = lignes versionnées.
-- RLS ACTIVÉE (règle absolue AGENTS.md §4). L'app publique lit le prompt actif via la clé
-- service-role (bypass RLS, serveur uniquement) ; l'édition est réservée aux super-admins.

-- ─────────────────────────────────────────────────────────────────────────────
-- Super-admins (rôle GLOBAL, hors multi-tenant)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.super_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.super_admins s where s.user_id = auth.uid());
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Prompts système versionnés (intake, narration, veille-catalogue, … extensible)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.prompts (
  id          uuid primary key default gen_random_uuid(),
  prompt_key  text not null,                                  -- ex. 'intake' | 'narration' | 'catalog-veille'
  version     integer not null,                               -- incrément par clé (historique)
  content     text not null,                                  -- gabarit éditable (placeholders {{...}} remplis par le code)
  is_active   boolean not null default false,                 -- au plus une version active par clé
  author      uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (prompt_key, version)
);
-- Au plus UNE version active par clé (greffe runtime déterministe).
create unique index prompts_one_active_per_key on public.prompts (prompt_key) where is_active;
create index on public.prompts (prompt_key, created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS : activée. Lecture/écriture = super-admin uniquement (l'app lit en service-role).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.super_admins enable row level security;
alter table public.prompts      enable row level security;

-- super_admins : un utilisateur voit s'il est lui-même super-admin (pas la liste des autres).
create policy super_admins_select_self on public.super_admins for select to authenticated
  using (user_id = auth.uid());

-- prompts : seul un super-admin lit l'historique et écrit de nouvelles versions (UI /admin).
-- L'app publique (routes intake/narration/veille) lit le prompt actif via service-role (bypass RLS).
create policy prompts_select_admin on public.prompts for select to authenticated
  using (public.is_super_admin());
create policy prompts_insert_admin on public.prompts for insert to authenticated
  with check (public.is_super_admin() and author = auth.uid());
create policy prompts_update_admin on public.prompts for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
