-- Veille live des régimes réglementaires par pays (S-077) : audit trail des régimes DÉCOUVERTS par la
-- veille (SearXNG/Crawl4AI + LiteLLM) — quel pays, quel régime, quelle portée, par quelle source, quelle
-- provenance (live/seed) et quand. Sert la traçabilité DÉFCON 1 (jamais un régime sans date + source) +
-- l'historique des révisions. On ne logue QUE les régimes issus de la veille (provenance live) ; le seed
-- daté (lib/legal/regime-seed) n'est pas une observation. Jumeau de transfer_status_observations (S-062).
-- RLS ACTIVÉE (règle absolue AGENTS.md §4). Pivot multi-tenant `circle_id` (null si anonyme).
-- Réutilise le helper SECURITY DEFINER is_circle_member (init_rails).

create table public.regime_observations (
  id           uuid primary key default gen_random_uuid(),
  circle_id    uuid references public.circles (id) on delete set null,   -- null si anonyme (configurateur public)
  created_by   uuid references auth.users (id) on delete set null,
  country      text not null,                                            -- code pays (catalogue geography)
  regime_code  text check (regime_code in ('rgpd', 'cndp', 'aiact', 'hipaa', 'secret-pro', 'none')), -- null = régime libre (hors énum moteur)
  regime_name  text not null,
  scope        text not null check (scope in ('data-protection', 'ai', 'sector', 'other')),
  provenance   text not null check (provenance in ('live', 'seed')),
  confidence   text not null check (confidence in ('high', 'medium', 'low')),
  source_url   text,
  source_label text,
  checked_at   text not null,                                            -- date de relevé / découverte (ISO)
  note         text,
  created_at   timestamptz not null default now()
);
create index on public.regime_observations (circle_id);
create index on public.regime_observations (created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS : activée
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.regime_observations enable row level security;

-- Insert ouvert (anon + authenticated) : on logue toute découverte ; si circle_id est fourni, l'auteur
-- doit être membre du cercle.
create policy regime_obs_insert on public.regime_observations for insert to anon, authenticated
  with check (circle_id is null or public.is_circle_member(circle_id));
-- Lecture réservée aux membres du cercle (les observations anonymes ne sont pas lisibles en masse).
create policy regime_obs_select on public.regime_observations for select to authenticated
  using (circle_id is not null and public.is_circle_member(circle_id));
