-- Network actif — collecte du coût RÉEL par poste (F13, Lot 2 · D, S-082). L'utilisateur consentant
-- (opt-in F9) déclare son coût réel ; on logue l'écart vs l'estimé du moteur. Alimente la recalibration
-- (S-083) et les propositions de re-optimisation (S-086). Jumeau des tables d'audit (RLS pivot circle).
-- RLS ACTIVÉE (règle absolue AGENTS.md §4). ⚠ Migration prod = MANUELLE (SSH/terminal web).

create table public.real_cost_entries (
  id          uuid primary key default gen_random_uuid(),
  circle_id   uuid references public.circles (id) on delete set null,   -- null si anonyme
  created_by  uuid references auth.users (id) on delete set null,
  poste       text not null,                                            -- libellé du poste de coût
  estimated   numeric not null,                                         -- coût estimé du moteur (€)
  real_cost   numeric not null,                                         -- coût réel déclaré (€)
  delta_pct   numeric not null,                                         -- écart relatif (%) réel vs estimé
  status      text not null check (status in ('within', 'over', 'under')),
  checked_at  text not null,                                            -- date du relevé (ISO)
  created_at  timestamptz not null default now()
);
create index on public.real_cost_entries (circle_id);
create index on public.real_cost_entries (created_at);

alter table public.real_cost_entries enable row level security;

-- Insert ouvert (anon + authenticated) ; si circle_id fourni, l'auteur doit en être membre.
create policy real_cost_insert on public.real_cost_entries for insert to anon, authenticated
  with check (circle_id is null or public.is_circle_member(circle_id));
-- Lecture réservée aux membres du cercle (les relevés anonymes ne sont pas lisibles en masse).
create policy real_cost_select on public.real_cost_entries for select to authenticated
  using (circle_id is not null and public.is_circle_member(circle_id));
