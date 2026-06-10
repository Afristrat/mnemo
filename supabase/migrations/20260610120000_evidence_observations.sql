-- Audit trail de la preuve sourcée (brique lib/evidence) : une ligne par SourcedEvidence issu d'une veille
-- LIVE (SearXNG + LLM). Sert la traçabilité DÉFCON 1 (jamais une preuve sans date + verdict + provenance).
-- On ne logue QUE le live (le repli seed n'est pas une observation). Jumeau de regime_observations (S-077).
-- RLS ACTIVÉE (règle absolue). Pivot multi-tenant circle_id (null si anonyme). Helper is_circle_member (init_rails).

create table public.evidence_observations (
  id             uuid primary key default gen_random_uuid(),
  circle_id      uuid references public.circles (id) on delete set null,
  created_by     uuid references auth.users (id) on delete set null,
  kind           text not null check (kind in ('citation', 'external_drift', 'cross_check')),
  subject        text not null,
  verdict        text not null,
  confidence     text not null check (confidence in ('low', 'dated')),
  provenance     text not null check (provenance in ('live', 'seed')),
  sources        jsonb not null default '[]'::jsonb,   -- [{url,title,snippet,retrievedAt}]
  integrity_hash text,                                 -- SHA-256 du pack (si scellé en lot)
  generated_at   text not null,                        -- date de relevé (ISO court)
  created_at     timestamptz not null default now()
);
create index on public.evidence_observations (circle_id);
create index on public.evidence_observations (created_at);

alter table public.evidence_observations enable row level security;

-- Insert ouvert (anon + authenticated) ; si circle_id fourni, l'auteur doit être membre.
create policy evidence_obs_insert on public.evidence_observations for insert to anon, authenticated
  with check (circle_id is null or public.is_circle_member(circle_id));
-- Lecture réservée aux membres du cercle.
create policy evidence_obs_select on public.evidence_observations for select to authenticated
  using (circle_id is not null and public.is_circle_member(circle_id));
