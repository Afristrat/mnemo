-- Lead gate (S-068) : capter le lead (nom + e-mail) AVANT de déverrouiller la recette experte
-- (stack, carte de coûts, ensemble, radar, export, Exit Escrow). Le VERDICT 90 s reste libre.
-- RLS ACTIVÉE (règle absolue AGENTS.md §4). L'e-mail + le nom sont des DONNÉES PERSONNELLES
-- (RGPD/CNDP) → collecte minimale (nom + e-mail + preset courant facultatif), AUCUNE lecture
-- publique : anon peut UNIQUEMENT INSERT. La lecture en masse est interdite (pas de policy
-- SELECT pour anon) ; seul le service role (bypass RLS, côté serveur) lit les leads collectés.
-- Pivot `circle_id` (null si anonyme, comme simulation_log / lead_capture / shared_reco).

create table public.leads (
  id          uuid primary key default gen_random_uuid(),
  circle_id   uuid references public.circles (id) on delete set null,   -- null si anonyme (configurateur public)
  created_by  uuid references auth.users (id) on delete set null,
  name        text not null,
  email       text not null,
  preset      text,                                                     -- preset courant au moment de la capture (facultatif)
  created_at  timestamptz not null default now()
);
create index on public.leads (circle_id);
create index on public.leads (created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS : activée
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.leads enable row level security;

-- Insert ouvert (anon + authenticated) : on capture le lead à l'ouverture de la recette experte ;
-- si circle_id est fourni, l'auteur doit être membre du cercle. AUCUNE policy SELECT pour anon :
-- la table de leads n'est jamais lisible publiquement (PII). Les membres d'un cercle lisent leurs
-- propres leads ; les leads anonymes (circle_id null) ne sont accessibles qu'au service role.
create policy leads_insert on public.leads for insert to anon, authenticated
  with check (circle_id is null or public.is_circle_member(circle_id));
create policy leads_select on public.leads for select to authenticated
  using (circle_id is not null and public.is_circle_owner(circle_id));
