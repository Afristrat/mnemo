-- Veille live des statuts juridiques de transfert (S-062) : audit trail des RÉVISIONS de statut
-- (Firecrawl + LiteLLM, réconciliées vs le repli daté de lib/legal/transfers.ts) — quel flux, quel
-- statut retenu, par quelle source, quelle provenance (live/seed/flagged) et quand. Sert la traçabilité
-- DÉFCON 1 (jamais un statut sans date + caractère révisable) + l'historique des révisions juridiques.
-- RLS ACTIVÉE (règle absolue AGENTS.md §4). Pivot multi-tenant `circle_id` (null si anonyme, comme
-- catalog_observations / simulation_log). Réutilise le helper SECURITY DEFINER is_circle_member (init_rails).

create table public.transfer_status_observations (
  id           uuid primary key default gen_random_uuid(),
  circle_id    uuid references public.circles (id) on delete set null,   -- null si anonyme (configurateur public)
  created_by   uuid references auth.users (id) on delete set null,
  from_region  text not null check (from_region in ('eu', 'maroc', 'us', 'other')),
  to_region    text not null check (to_region in ('eu', 'maroc', 'us', 'other')),
  status       text not null check (status in ('ok', 'restricted', 'forbidden')),
  legal_basis  text not null,
  provenance   text not null check (provenance in ('live', 'seed', 'flagged')),
  confidence   text not null check (confidence in ('high', 'medium', 'low')),
  volatile     boolean not null,                                         -- statut juridiquement révisable
  source_url   text,                                                     -- null légitime (résidence stricte / même juridiction)
  source_label text,
  checked_at   text not null,                                            -- date de relevé / révision (ISO)
  note         text,
  created_at   timestamptz not null default now()
);
create index on public.transfer_status_observations (circle_id);
create index on public.transfer_status_observations (created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS : activée
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.transfer_status_observations enable row level security;

-- Insert ouvert (anon + authenticated) : on logue toute révision ; si circle_id est fourni, l'auteur
-- doit être membre du cercle.
create policy transfer_obs_insert on public.transfer_status_observations for insert to anon, authenticated
  with check (circle_id is null or public.is_circle_member(circle_id));
-- Lecture réservée aux membres du cercle (les observations anonymes ne sont pas lisibles en masse).
create policy transfer_obs_select on public.transfer_status_observations for select to authenticated
  using (circle_id is not null and public.is_circle_member(circle_id));
