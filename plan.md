# Plan — Strate

Plateforme souveraine de choix, déploiement et exploitation d'infrastructures de base mémorielle IA. **Spec complète : `PRD.md`.** Chasse au moat : `docs/MOAT-HUNT.md`.

## Objectif Lot 1 (en cours)

Conseil + les 3 moats, **production-ready**, vendable seul. Features F1→F9. Détail des stories : `.ralph/prd.json`.

## Séquençage (dépendances)

```
S-001 scaffold
  ├─ S-002 design system ─┐
  ├─ S-003 moteur (lib) ──┼─ S-005 wizard ── S-006 résultats ─┬─ S-007 ensemble
  │     └─ S-004 tests    │                                    ├─ S-009 livrable
  │                       │                                    └─ S-010 exit escrow
  ├─ S-008 price feed ────┘
  ├─ S-011 fiduciary
  ├─ S-012 supabase + RLS + consentement
  ├─ S-013 playwright e2e
  └─ S-014 CLAUDE.md + README + CI
```

## Lots suivants (cf. PRD §5)

- **Lot 2** — Cuisine payante : provisioning hybride (F10), coffre (F11), monitoring IHS+MEL (F12), Network actif (F13).
- **Lot 3** — Écosystème : migration garantie (F14), re-optimisation continue (F15), produits dérivés.

## Règles du loop

Une story à la fois · validation complète avant passes=true · commit+push par story · max 25 itérations · circuit breaker à 3 échecs identiques.
