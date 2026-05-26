-- Conversion & data (S-023) : log des simulations (intelligence agrégée, moat data) +
-- capture e-mail exit-intent + rapport partageable par lien.
-- RLS ACTIVÉE SUR TOUTES LES TABLES (règle absolue AGENTS.md §4).
-- L'e-mail est une DONNÉE PERSONNELLE (RGPD/CNDP) → accès en lecture très restreint,
-- collecte minimale (e-mail + contexte), opt-in côté UI. Réutilise les helpers SECURITY
-- DEFINER de la migration init_rails (is_circle_member / is_circle_owner).

-- ─────────────────────────────────────────────────────────────────────────────
-- simulation_log : une ligne par simulation (le plus souvent ANONYME — configurateur public)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.simulation_log (
  id          uuid primary key default gen_random_uuid(),
  share_token uuid not null default gen_random_uuid(),                       -- lien de rapport partageable
  circle_id   uuid references public.circles (id) on delete set null,        -- null si anonyme
  created_by  uuid references auth.users (id) on delete set null,
  preset      text,
  profile     jsonb not null,
  verdict     jsonb,
  total_cost  numeric(12, 2),
  setup_cost  numeric(12, 2),
  created_at  timestamptz not null default now()
);
create unique index on public.simulation_log (share_token);
create index on public.simulation_log (circle_id);
create index on public.simulation_log (created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- lead_capture : e-mail exit-intent (PII — collecte minimale, lecture restreinte)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.lead_capture (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  simulation_id uuid references public.simulation_log (id) on delete set null,
  circle_id     uuid references public.circles (id) on delete set null,
  context       text not null default 'exit_intent' check (context in ('exit_intent', 'report', 'other')),
  created_at    timestamptz not null default now()
);
create index on public.lead_capture (created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS : activée sur les deux tables
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.simulation_log enable row level security;
alter table public.lead_capture   enable row level security;

-- simulation_log : insert ouvert (anon + authenticated) — on logue toute simulation ;
-- si circle_id est fourni, l'auteur doit être membre du cercle.
create policy simulation_insert on public.simulation_log for insert to anon, authenticated
  with check (circle_id is null or public.is_circle_member(circle_id));
-- select direct réservé aux membres du cercle (les lignes anonymes ne sont lisibles que
-- via la RPC de rapport partageable ci-dessous — jamais en masse).
create policy simulation_select on public.simulation_log for select to authenticated
  using (circle_id is not null and public.is_circle_member(circle_id));

-- lead_capture : insert ouvert (capture e-mail) ; lecture réservée au PROPRIÉTAIRE du cercle
-- (PII). Les leads anonymes (circle_id null) ne sont lisibles que par le service role (bypass RLS).
create policy lead_insert on public.lead_capture for insert to anon, authenticated
  with check (circle_id is null or public.is_circle_member(circle_id));
create policy lead_select on public.lead_capture for select to authenticated
  using (circle_id is not null and public.is_circle_owner(circle_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- Rapport partageable : lecture par jeton sans exposer toute la table (SECURITY DEFINER)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_simulation_by_token(token uuid)
returns setof public.simulation_log
language sql stable security definer set search_path = public, pg_temp as $$
  select * from public.simulation_log where share_token = token;
$$;

grant execute on function public.get_simulation_by_token(uuid) to anon, authenticated;
