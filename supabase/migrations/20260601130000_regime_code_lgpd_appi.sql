-- Correctif (suite S-077 T5) : l'énum moteur `Regulation` a gagné `lgpd` (Brésil) et `appi` (Japon)
-- comme régimes phares MODÉLISÉS, mais la contrainte CHECK de `regime_observations.regime_code`
-- (migration 20260601120000) ne les autorisait pas → une observation live d'un régime LGPD/APPI
-- (regime_code = 'lgpd'/'appi') violait le CHECK et n'était jamais persistée (perte silencieuse, la
-- persistance étant non bloquante). On réaligne la contrainte sur l'énum applicatif courant.
--
-- ⚠ Migration prod = MANUELLE (SSH on-LAN OU terminal web Coolify, cf. ALERTE passation) : non
-- appliquée automatiquement au déploiement.

alter table public.regime_observations
  drop constraint if exists regime_observations_regime_code_check;

alter table public.regime_observations
  add constraint regime_observations_regime_code_check
  check (regime_code in ('rgpd', 'cndp', 'aiact', 'hipaa', 'secret-pro', 'lgpd', 'appi', 'none'));
