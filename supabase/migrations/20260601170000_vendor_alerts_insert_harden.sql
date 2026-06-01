-- Durcissement S-084 (audit de sécurité avant ouverture) : la policy d'INSERT de `vendor_alerts` était
-- ouverte à anon/authenticated y compris pour les alertes GLOBALES (circle_id null) → un client anonyme
-- pouvait injecter une fausse alerte de prix « sourcée », lisible par tous (vecteur de désinformation,
-- DÉFCON 1 : le flux est affiché comme factuel). On restreint : côté client, seul un INSERT de CERCLE par
-- un membre est autorisé ; les alertes globales (broadcast) ne peuvent venir QUE de la veille serveur
-- (service-role, qui contourne RLS). Le select reste inchangé (broadcast public lisible).
-- ⚠ Migration prod = MANUELLE (SSH on-LAN OU terminal web Coolify) : non auto au déploiement.

drop policy if exists vendor_alerts_insert on public.vendor_alerts;
create policy vendor_alerts_insert on public.vendor_alerts for insert to anon, authenticated
  with check (circle_id is not null and public.is_circle_member(circle_id));
