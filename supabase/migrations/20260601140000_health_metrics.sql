-- Monitoring — snapshots d'Infra Health Score (F12, Lot 2 · C, S-081). Chaque ligne = un relevé daté
-- du score composite (0–100), de son statut et de ses sous-scores par dimension. Sert l'historique de
-- santé + la traçabilité. Jumeau de regime_observations / transfer_status_observations (audit RLS).
-- RLS ACTIVÉE (règle absolue AGENTS.md §4). Pivot multi-tenant `circle_id` (null si anonyme).
-- ⚠ Migration prod = MANUELLE (SSH on-LAN OU terminal web Coolify) : non auto au déploiement.

create table public.health_metrics (
  id          uuid primary key default gen_random_uuid(),
  circle_id   uuid references public.circles (id) on delete set null,   -- null si anonyme
  created_by  uuid references auth.users (id) on delete set null,
  score       int check (score is null or (score >= 0 and score <= 100)),  -- IHS composite ; null = rien mesuré
  status      text not null check (status in ('ok', 'warn', 'critical', 'unknown')),
  measured    int not null check (measured >= 0),                        -- nb dimensions mesurées
  total       int not null check (total >= 0),                           -- nb dimensions
  subscores   jsonb not null,                                            -- [{dimension, score, status}]
  checked_at  text not null,                                             -- date du relevé (ISO)
  created_at  timestamptz not null default now()
);
create index on public.health_metrics (circle_id);
create index on public.health_metrics (created_at);

alter table public.health_metrics enable row level security;

-- Insert ouvert (anon + authenticated) : on logue tout relevé ; si circle_id fourni, l'auteur doit en être membre.
create policy health_metrics_insert on public.health_metrics for insert to anon, authenticated
  with check (circle_id is null or public.is_circle_member(circle_id));
-- Lecture réservée aux membres du cercle (les relevés anonymes ne sont pas lisibles en masse).
create policy health_metrics_select on public.health_metrics for select to authenticated
  using (circle_id is not null and public.is_circle_member(circle_id));
