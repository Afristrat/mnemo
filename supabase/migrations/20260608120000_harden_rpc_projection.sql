-- Durcissement (reliquat S-15) : les RPC de lecture publique par identifiant imprévisible projetaient
-- `select *` → toute évolution de schéma (ajout d'une colonne) aurait fuité automatiquement par la RPC.
-- On remplace `select *` par une PROJECTION EXPLICITE de colonnes (défense en profondeur, principe du
-- moindre privilège). Changer le type de retour d'une fonction impose un DROP préalable (create or replace
-- ne peut pas modifier la signature de sortie). ⚠ Migration prod = MANUELLE (terminal web Coolify / SSH).

-- ─────────────────────────────────────────────────────────────────────────────
-- get_shared_reco : la route /api/share/[id] ne consomme QUE `encoded` → projection minimale.
-- (id/circle_id/created_by/created_at sont des métadonnées inutiles au lecteur public.)
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.get_shared_reco(uuid);
create function public.get_shared_reco(reco_id uuid)
returns table (encoded text)
language sql stable security definer set search_path = public, pg_temp as $$
  select encoded from public.shared_reco where id = reco_id;
$$;
grant execute on function public.get_shared_reco(uuid) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- get_simulation_by_token : rapport partageable par jeton. Expose le CONTENU du rapport
-- (preset/profil/verdict/coûts) mais JAMAIS les métadonnées d'identité (share_token, circle_id,
-- created_by) — celles-ci n'ont aucune raison d'apparaître dans un rapport public.
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.get_simulation_by_token(uuid);
create function public.get_simulation_by_token(token uuid)
returns table (
  id uuid,
  preset text,
  profile jsonb,
  verdict jsonb,
  total_cost numeric,
  setup_cost numeric,
  created_at timestamptz
)
language sql stable security definer set search_path = public, pg_temp as $$
  select id, preset, profile, verdict, total_cost, setup_cost, created_at
  from public.simulation_log
  where share_token = token;
$$;
grant execute on function public.get_simulation_by_token(uuid) to anon, authenticated;
