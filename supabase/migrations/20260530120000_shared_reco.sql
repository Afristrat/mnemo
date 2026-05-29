-- Partage de la recommandation par lien court (S-067) : stocke le profil ENCODÉ (la même chaîne
-- base64 URL-safe que le lien stateless `/resultats?p=`) derrière un identifiant NON DEVINABLE (uuid).
-- Mécanisme jumeau du rapport partageable de simulation_log (get_simulation_by_token) : anon peut
-- CRÉER un lien (insert) ; la lecture publique se fait UNIQUEMENT par id via une RPC SECURITY DEFINER
-- (jamais d'énumération en masse). RLS ACTIVÉE (règle absolue AGENTS.md §4). Pivot `circle_id` (null
-- si anonyme, comme simulation_log / catalog_observations). Donnée non-PII (un profil de configuration),
-- mais lecture encadrée par l'imprévisibilité de l'id.

create table public.shared_reco (
  id           uuid primary key default gen_random_uuid(),
  circle_id    uuid references public.circles (id) on delete set null,   -- null si anonyme (configurateur public)
  created_by   uuid references auth.users (id) on delete set null,
  encoded      text not null,                                            -- profil sérialisé base64 URL-safe
  created_at   timestamptz not null default now()
);
create index on public.shared_reco (circle_id);
create index on public.shared_reco (created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS : activée
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.shared_reco enable row level security;

-- Insert ouvert (anon + authenticated) : on crée un lien partageable ; si circle_id est fourni,
-- l'auteur doit être membre du cercle.
create policy shared_reco_insert on public.shared_reco for insert to anon, authenticated
  with check (circle_id is null or public.is_circle_member(circle_id));
-- Select direct réservé aux membres du cercle (les liens anonymes ne sont lisibles que par la RPC
-- ci-dessous, par id imprévisible — jamais en masse). Aligné sur simulation_select.
create policy shared_reco_select on public.shared_reco for select to authenticated
  using (circle_id is not null and public.is_circle_member(circle_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- Lecture publique par id imprévisible (SECURITY DEFINER) — jumeau de get_simulation_by_token
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_shared_reco(reco_id uuid)
returns setof public.shared_reco
language sql stable security definer set search_path = public, pg_temp as $$
  select * from public.shared_reco where id = reco_id;
$$;

grant execute on function public.get_shared_reco(uuid) to anon, authenticated;
