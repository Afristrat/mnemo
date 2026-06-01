-- Réseau actif — broadcast d'alertes vendor (F13, Lot 2 · D, S-084). Quand la veille prix (S-025)
-- détecte une VARIATION d'un poste vendor (prix baseline daté → prix live daté promu), on logue une
-- alerte SOURCÉE (ancien → nouveau + écart relatif + source datée), diffusable au réseau. DÉFCON 1 :
-- une alerte est un FAIT chiffré et sourcé — JAMAIS une recommandation d'achat ni un jugement. Une
-- variation nulle ou sous le plancher anti-bruit ne produit pas d'alerte. Jumeau des tables d'audit
-- (RLS pivot circle). Les alertes globales (circle_id null) sont un broadcast public de faits de prix
-- publics. RLS ACTIVÉE (règle absolue AGENTS.md §4). Réutilise le helper is_circle_member (init_rails).
-- ⚠ Migration prod = MANUELLE (SSH on-LAN OU terminal web Coolify) : non auto au déploiement.

create table public.vendor_alerts (
  id          uuid primary key default gen_random_uuid(),
  circle_id   uuid references public.circles (id) on delete set null,   -- null = broadcast global (faits publics)
  created_by  uuid references auth.users (id) on delete set null,
  vendor      text not null,                                            -- ex. Scaleway
  item        text not null,                                            -- libellé du poste vendor
  old_price   numeric not null,                                         -- prix baseline daté (€)
  new_price   numeric not null,                                         -- prix live promu (€)
  currency    text not null,
  delta_pct   numeric not null,                                         -- écart relatif (%) nouveau vs ancien
  direction   text not null check (direction in ('increase', 'decrease')),
  severity    text not null check (severity in ('info', 'notable', 'major')),
  source_url  text not null,                                            -- DÉFCON 1 : toujours présent
  checked_at  text not null,                                            -- fraîcheur de la source (date ISO)
  created_at  timestamptz not null default now()
);
create index on public.vendor_alerts (circle_id);
create index on public.vendor_alerts (created_at);

alter table public.vendor_alerts enable row level security;

-- Insert ouvert (anon + authenticated) : la veille serveur écrit (service-role) ; une alerte de cercle
-- exige l'appartenance.
create policy vendor_alerts_insert on public.vendor_alerts for insert to anon, authenticated
  with check (circle_id is null or public.is_circle_member(circle_id));
-- Lecture : les alertes globales (broadcast, faits publics sourcés) sont lisibles de tous ; les alertes
-- de cercle restent réservées aux membres.
create policy vendor_alerts_select on public.vendor_alerts for select to anon, authenticated
  using (circle_id is null or public.is_circle_member(circle_id));
