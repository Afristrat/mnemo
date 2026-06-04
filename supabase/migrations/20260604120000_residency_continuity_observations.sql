-- Preuve de résidence continue (S-095) : audit trail horodaté des relevés de continuité de résidence
-- (composants × région × drapeau in-zone/restricted/out-of-zone/unverified + empreinte d'intégrité).
-- Trace la DÉRIVE de résidence dans le temps. RLS ACTIVÉE (AGENTS.md §4). Pivot multi-tenant `circle_id`
-- (null si anonyme). Réutilise le helper SECURITY DEFINER is_circle_member (init_rails). Jumelle de
-- transfer_status_observations / regime_observations.

create table public.residency_continuity_observations (
  id                uuid primary key default gen_random_uuid(),
  circle_id         uuid references public.circles (id) on delete set null,   -- null si anonyme (configurateur public)
  created_by        uuid references auth.users (id) on delete set null,
  primary_region    text not null check (primary_region in ('eu', 'maroc', 'us', 'other')),
  out_of_zone_count integer not null default 0,
  unverified_count  integer not null default 0,
  components        jsonb not null,                                           -- [{id, region, flag, legalBasis}]
  integrity_hash    text not null,                                            -- SHA-256 du rapport canonique
  observed_at       text not null,                                            -- date de relevé (ISO)
  created_at        timestamptz not null default now()
);
create index on public.residency_continuity_observations (circle_id);
create index on public.residency_continuity_observations (created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS : activée
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.residency_continuity_observations enable row level security;

-- Insert ouvert (anon + authenticated) : on logue tout relevé ; si circle_id est fourni, l'auteur
-- doit être membre du cercle.
create policy residency_cont_insert on public.residency_continuity_observations for insert to anon, authenticated
  with check (circle_id is null or public.is_circle_member(circle_id));
-- Lecture réservée aux membres du cercle (les observations anonymes ne sont pas lisibles en masse).
create policy residency_cont_select on public.residency_continuity_observations for select to authenticated
  using (circle_id is not null and public.is_circle_member(circle_id));
