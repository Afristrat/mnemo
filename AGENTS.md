# AGENTS.md — Mnémo

Instructions pour tout agent (Claude Code / Ralph Loop) travaillant sur ce repo.

## Quoi

Mnémo — plateforme SaaS souveraine de choix + déploiement + exploitation d'infra de base mémorielle IA. Spec : `PRD.md`. Moats : `docs/MOAT-HUNT.md`. Pilotage : `.ralph/prd.json` + `.ralph/progress.md`.

## Avant chaque action

1. Lire `.ralph/prd.json` → story prioritaire `passes:false` dont les `deps` sont `passes:true`.
2. Lire `.ralph/progress.md` → section « Codebase Patterns ».
3. Travailler sur **une seule** story, sans déborder du scope.

## Stack & commandes

- Next.js 15 (App Router) + React 19 + TypeScript strict + Tailwind v3 + Supabase (RLS) + Vitest + Playwright.
- `npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint` · `npm test` · `npm run test:e2e`

## Règles absolues (non négociables)

1. **Zéro dette** : avant `passes:true` → typecheck 0 erreur, lint 0 erreur, tests verts, build passe. « Non bloquant » n'existe pas.
2. **Français irréprochable** dans l'UI et le contenu — accents sur les majuscules (É, À, È, Ç…) obligatoires.
3. **Jamais de secret hardcodé** — variables d'environnement / coffre uniquement.
4. **RLS activé** sur toutes les tables Supabase, sans exception (champ tenant/circle pivot).
5. **Jamais de `any` TS** sans commentaire justificatif explicite.
6. **Pas de rustine** — corriger à la racine ; si on touche un fichier, on corrige ses erreurs pré-existantes.
7. **Sources** : tout coût affiché → URL + date + pastille de confiance + disclaimer « une IA peut se tromper ».
8. **Moteur pur** : `lib/engine/` sans dépendance UI, testé unitairement.
9. **Provisioning** (Lot 2) : l'agent ne crée jamais de compte ni ne saisit de carte.

## Après validation d'une story

1. `.ralph/prd.json` → `passes:true` + `completedAt`.
2. Log dans `.ralph/progress.md` (date, story, fichiers, learnings) + enrichir « Codebase Patterns » si nouveau pattern.
3. Commit `[S-XXX] Titre exact de la story` puis `git push origin main`.

## Design

Tokens & système : `design-reference/mn_mo_brand_identity/DESIGN.md`. Maquettes de référence (Stitch) : `design-reference/*`. Space Grotesk (titres), Inter (corps), JetBrains Mono (toute donnée numérique / clé / chemin). Cartes 14px, champs 10px, boutons pilule.

## Complétion

Toutes les stories `passes:true` → vérifier typecheck+tests+lint+build, puis signaler. Ne jamais déclarer COMPLETE sans cette vérification.
