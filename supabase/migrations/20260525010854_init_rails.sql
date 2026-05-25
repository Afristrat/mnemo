-- Rails du moat ③ (Intelligence Network) — F9.
-- Multi-tenancy par pivot `circle`, consentement réseau opt-in horodaté, et schéma de
-- données de coût réel prêt à recevoir (collecte effective au Lot 2).
-- RLS ACTIVÉE SUR TOUTES LES TABLES, sans exception (règle absolue AGENTS.md §4).

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────

create table public.circles (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id         uuid primary key default gen_random_uuid(),
  circle_id  uuid not null references public.circles (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (circle_id, user_id)
);

-- Consentement réseau : opt-in EXPLICITE et HORODATÉ (base légale RGPD/CNDP, F9).
create table public.network_consents (
  id           uuid primary key default gen_random_uuid(),
  circle_id    uuid not null references public.circles (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  scope        text not null default 'cost_network' check (scope in ('cost_network')),
  consented    boolean not null default false,
  consented_at timestamptz,                 -- horodatage de l'opt-in
  revoked_at   timestamptz,
  created_at   timestamptz not null default now(),
  unique (circle_id, user_id, scope)
);

create table public.configurations (
  id             uuid primary key default gen_random_uuid(),
  circle_id      uuid not null references public.circles (id) on delete cascade,
  created_by     uuid references auth.users (id) on delete set null,
  label          text,
  profile        jsonb not null,
  recommendation jsonb,
  created_at     timestamptz not null default now()
);

-- Données de coût réel — schéma prêt, ALIMENTÉ AU LOT 2 (vide au Lot 1).
create table public.cost_observations (
  id          uuid primary key default gen_random_uuid(),
  circle_id   uuid not null references public.circles (id) on delete cascade,
  layer_id    integer not null,
  vendor      text not null,
  amount      numeric(12, 4) not null,
  currency    text not null default 'EUR' check (currency in ('EUR', 'USD')),
  period      text not null default 'monthly' check (period in ('monthly', 'usage', 'one_off')),
  observed_at timestamptz not null default now(),
  source_url  text,
  created_by  uuid references auth.users (id) on delete set null
);

create index on public.memberships (user_id);
create index on public.network_consents (circle_id);
create index on public.configurations (circle_id);
create index on public.cost_observations (circle_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers SECURITY DEFINER (bypass RLS pour éviter la récursion des policies)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.is_circle_member(c uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.memberships m where m.circle_id = c and m.user_id = auth.uid());
$$;

create or replace function public.is_circle_owner(c uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.circles ci where ci.id = c and ci.owner_id = auth.uid());
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS : activée sur TOUTES les tables
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.circles            enable row level security;
alter table public.memberships        enable row level security;
alter table public.network_consents   enable row level security;
alter table public.configurations     enable row level security;
alter table public.cost_observations  enable row level security;

-- circles
create policy circles_select on public.circles for select to authenticated
  using (owner_id = auth.uid() or public.is_circle_member(id));
create policy circles_insert on public.circles for insert to authenticated
  with check (owner_id = auth.uid());
create policy circles_update on public.circles for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy circles_delete on public.circles for delete to authenticated
  using (owner_id = auth.uid());

-- memberships
create policy memberships_select on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.is_circle_owner(circle_id));
create policy memberships_insert on public.memberships for insert to authenticated
  with check (public.is_circle_owner(circle_id) or user_id = auth.uid());
create policy memberships_delete on public.memberships for delete to authenticated
  using (public.is_circle_owner(circle_id) or user_id = auth.uid());

-- network_consents : seul l'utilisateur gère SON consentement, dans SON cercle
create policy consents_select on public.network_consents for select to authenticated
  using (public.is_circle_member(circle_id));
create policy consents_insert on public.network_consents for insert to authenticated
  with check (user_id = auth.uid() and public.is_circle_member(circle_id));
create policy consents_update on public.network_consents for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- configurations
create policy configurations_select on public.configurations for select to authenticated
  using (public.is_circle_member(circle_id));
create policy configurations_insert on public.configurations for insert to authenticated
  with check (public.is_circle_member(circle_id) and created_by = auth.uid());
create policy configurations_update on public.configurations for update to authenticated
  using (public.is_circle_member(circle_id)) with check (public.is_circle_member(circle_id));
create policy configurations_delete on public.configurations for delete to authenticated
  using (public.is_circle_member(circle_id));

-- cost_observations (prêt pour le Lot 2)
create policy cost_select on public.cost_observations for select to authenticated
  using (public.is_circle_member(circle_id));
create policy cost_insert on public.cost_observations for insert to authenticated
  with check (public.is_circle_member(circle_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- À l'inscription : cercle personnel + appartenance owner (rails utilisables d'emblée)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  new_circle uuid;
begin
  insert into public.circles (name, owner_id)
  values (coalesce(new.email, 'Mon cercle'), new.id)
  returning id into new_circle;

  insert into public.memberships (circle_id, user_id, role)
  values (new_circle, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
