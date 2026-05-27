-- Veille temps réel du catalogue (S-036) : audit trail des composants proposés par la veille
-- (Firecrawl + LiteLLM) — quel composant retenu, par quelle source, quelle provenance/confiance,
-- et quand. Sert la traçabilité DÉFCON 1 (aucun candidat sans source) et la preuve d'absence de
-- biais vendor. RLS ACTIVÉE (règle absolue AGENTS.md §4). Pivot multi-tenant `circle_id` (null si
-- anonyme, comme simulation_log). Réutilise le helper SECURITY DEFINER is_circle_member (init_rails).

create table public.catalog_observations (
  id           uuid primary key default gen_random_uuid(),
  circle_id    uuid references public.circles (id) on delete set null,   -- null si anonyme (configurateur public)
  created_by   uuid references auth.users (id) on delete set null,
  slot         text not null check (slot in ('c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6')),
  component    text not null,                                            -- composant retenu pour la couche
  role         text not null,
  sovereignty  text not null check (sovereignty in ('sovereign', 'eu-hosted', 'api-third-party')),
  provenance   text not null check (provenance in ('live', 'seed', 'flagged')),
  confidence   text not null check (confidence in ('high', 'medium', 'low')),
  source_url   text not null,                                            -- DÉFCON 1 : toujours présent
  source_label text,
  checked_at   text,                                                     -- fraîcheur de la source (date ISO)
  assembled_at text not null,                                            -- date d'assemblage du catalogue
  created_at   timestamptz not null default now()
);
create index on public.catalog_observations (circle_id);
create index on public.catalog_observations (created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS : activée
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.catalog_observations enable row level security;

-- Insert ouvert (anon + authenticated) : on logue toute veille ; si circle_id est fourni, l'auteur
-- doit être membre du cercle.
create policy catalog_obs_insert on public.catalog_observations for insert to anon, authenticated
  with check (circle_id is null or public.is_circle_member(circle_id));
-- Lecture réservée aux membres du cercle (les observations anonymes ne sont pas lisibles en masse).
create policy catalog_obs_select on public.catalog_observations for select to authenticated
  using (circle_id is not null and public.is_circle_member(circle_id));
