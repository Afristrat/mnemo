# CLAUDE.md

Guidage pour Claude Code (claude.ai/code) sur ce dépôt.

## Nature du dépôt

Application **Next.js 15 (App Router) + React 19 + TypeScript strict + Tailwind v3 +
Supabase (RLS)** — **Mnémo**, configurateur d'infrastructure de base mémorielle IA
souveraine (positionnement : « base mémorielle » d'une organisation). **Lot 1 = conseil
+ moats** : le configurateur recommande une stack 7 couches, chiffre les coûts (sourcés,
±30 %), explore l'incertitude (ensemble), exporte un livrable, génère un bundle de
redéploiement reproductible (Exit Escrow), affiche une charte fiduciaire, et pose les
rails multi-tenant (RLS) du réseau d'intelligence.

> Le dépôt a démarré comme une collection de maquettes Stitch ; celles-ci sont conservées
> dans `design-reference/` (dont `mn_mo_brand_identity/DESIGN.md`, la source de vérité du
> design). L'application réelle a été portée depuis ces maquettes.

## Commandes

```bash
npm run dev          # serveur de dev (http://localhost:3000)
npm run build        # build de production
npm run start        # serveur de production (après build)
npm run typecheck    # tsc --noEmit (0 erreur exigée)
npm run lint         # ESLint CLI (flat config, 0 erreur / 0 warning exigés)
npm test             # Vitest (tests unitaires)
npm run test:e2e     # Playwright (parcours critiques, desktop + mobile)

npx supabase start   # stack Supabase locale (Docker) — pour S-012 / rails F9
npx supabase status  # URLs + clés locales
npx supabase db reset # ré-applique les migrations
```

## Architecture

- `app/` — routes : `/` (accueil), `/configurateur` (wizard), `/resultats` (reco),
  `/fiduciaire` (charte), `/api/pricing` (price feed serveur).
- `components/` — `ui/` (primitives : Button, Card, Chip, Input, StatusDot),
  `wizard/`, `results/`.
- `lib/` — cœur métier, **fonctions pures et testées** :
  - `engine/` — moteur de reco : `recommend(profile) → Recommendation` (preset, 7 couches,
    8 scores, coûts, modules, diagnostics) + `buildEnsemble` (incertitude multi-config).
  - `pricing/` — price feed Firecrawl (extraction, empreinte, cache, repli seed).
  - `export/` — livrable MD + PDF (modèle pur partagé).
  - `exit/` — bundle Exit Escrow (IaC + runbook + scripts) zippé via fflate.
  - `fiduciary/` — charte (donnée pure).
  - `supabase/` — clients `@supabase/ssr` (browser/serveur) + types.
  - `network/` — consentement réseau horodaté.
  - `wizard/`, `charts/`, `utils/`.
- `hooks/` — `useWizardProfile` (état + persistance localStorage).
- `supabase/migrations/` — schéma + RLS (pivot `circle`, consentement, coût réel).
- `e2e/` — specs Playwright. `.github/workflows/ci.yml` — CI (qualité + e2e).
- `.ralph/` — pilotage (PRD `prd.json`, journal `progress.md`). `docs/DECISIONS.md` — ADR.

## Conventions (non négociables)

1. **Zéro dette** : avant de marquer une story faite → typecheck 0, lint 0, tests verts,
   build OK (+ e2e/live si pertinent). « Non bloquant » n'existe pas.
2. **TypeScript** : `strict`, pas de `any`/`as`/`!` (cf. `~/.claude/rules/typescript.md`) ;
   `type` plutôt qu'`enum` (unions `as const`) ; return types sur fonctions exportées.
3. **Moteur pur** : toute la logique de reco dans `lib/engine/`, sans dépendance UI, testée.
4. **Français irréprochable** : UI et contenu en français, **accents sur les majuscules
   obligatoires** (É À È Ç…), ponctuation française.
5. **Design** : tokens de `design-reference/mn_mo_brand_identity/DESIGN.md` portés dans
   `tailwind.config.ts`. Space Grotesk (titres), Inter (corps), JetBrains Mono (données).
6. **Sources** : tout coût affiché → URL + date + pastille de confiance + disclaimer.
7. **Sécurité** : jamais de secret hardcodé (env uniquement) ; **RLS activée sur toutes
   les tables Supabase** ; clé secrète serveur uniquement, jamais dans le bundle client.

## Pointeurs

- `PRD.md` — spec (features F1→F9, archi, threat model, modèle éco).
- `docs/DECISIONS.md` — ADR (arbitrages d'architecture).
- `docs/MOAT-HUNT.md` — les 3 moats.
- `.ralph/prd.json` + `.ralph/progress.md` — stories + patterns + log.
- `design-reference/mn_mo_brand_identity/DESIGN.md` — système de design.
