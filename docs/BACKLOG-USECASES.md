# Backlog — use-cases à modéliser (post-refonte Strate)

> Capturé pendant S-020 (retour Amine, 2026-05-27). Le modèle couvre déjà beaucoup de cas réels,
> mais plusieurs usages structurants **ne sont pas encore** dans le profil / le moteur / le
> dimensionnement. À traiter **APRÈS** la refonte en cours (S-021 → S-024), en nouvelles stories
> (S-025+). Ne pas démarrer avant la fin de la refonte.

## 1. Besoins de sauvegarde (backup) comme dimension chiffrable

- **Aujourd'hui** : le bundle Exit Escrow (S-010) décrit un runbook backup 3-2-1, et la couche C6
  mentionne Restic/Backblaze — mais le **profil** ne demande aucun besoin de backup, et le `sizing`
  ne chiffre ni le stockage de sauvegarde, ni l'egress, ni la rétention/fréquence.
- **À modéliser** : fréquence, rétention, **RPO/RTO**, 3-2-1 (multi-support / multi-site), coût du
  stockage de backup + egress, restauration testée. Impact sur C5/C6 + une ligne de coût dédiée.

## 2. Stockage multi-continent / résidence multi-juridiction

- **Aujourd'hui** : `Profile.zone` est **une seule** zone ; `regulations[]` peut être multiple —
  mais rien ne modélise une exigence de **résidence des données dans plusieurs régions** quand
  l'organisation doit être conforme à **plusieurs lois à la fois** (ex. RGPD + HIPAA + CNDP), ni le
  surcoût de réplication multi-région, ni la latence/souveraineté par région.
- **À modéliser** : résidence requise par juridiction, réplication multi-région (coût + bande
  passante), latence inter-région, règle `max(juridictions)`. Impact fort sur C5/C6 et les scores
  souveraineté/conformité.

## 3. Chasse systématique aux use-cases manquants

- Amine signale qu'« on est passé sur beaucoup de vrais use-cases ». **Lancer une revue de
  complétude** à la fin de la refonte (skill `moat-hunter` / analogies inter-industries) pour
  débusquer les lacunes. Pistes à valider (non exhaustif, **non confirmé**) : DR/PRA, conservation
  légale / legal hold, archivage froid, e-discovery, chiffrement par client / BYOK,
  anonymisation/pseudonymisation, quotas & SLA, multi-langue, suppression certifiée.

## Statut

À convertir en stories `S-025+` après **S-024**. Source de la demande : retour Amine du 2026-05-27.
