# PASSATION — Mnémo (repo Infra)

> Passation de quart (protocole nucléaire). Le quart suivant doit pouvoir reprendre **sans relire d'autre fichier que celui-ci** — les pointeurs vers les docs détaillées sont en bas.

```
== PASSATION MNEMO 2026-05-25T03:15 ==
[ETAT]    Lot 1 (conseil+moats) ✅ COMPLET | 14/14 stories ✓ | branche main propre | build ✓ | typecheck 0 | lint 0/0 | unit 76+4skip | e2e 5+1skip
[ENCOURS] RAS — Lot 1 terminé. Suite = Lot 2 (agent provisioning human-in-the-loop).
[FAIT]    S-001→S-014 (toutes). Migration ESLint CLI (dette résorbée). CLAUDE.md+README à jour. docs/DECISIONS.md ADR-001..008
[ALERTE]  !! Supabase = nouvelles clés sb_publishable/sb_secret (≠ JWT anon/service_role) → adapter .env.example en S-012 | RLS obligatoire S-012 | scaffold supabase/ untracked (intégrer en S-012) | baseline prix datée 2026-05-25 (régénérer via scripts/capture-baseline.mts)
[BLOQUE]  RAS
[NEXT]    S-009 → S-010 → S-011 → S-012 → S-013 → S-014
[CTX]     session 2026-05-24→25 | 8 commits | OneDrive en pause ~2h (I/O OK) | Supabase Studio http://127.0.0.1:54323
[MEMO]    "reprends en Ralph" relit .ralph/prd.json + progress.md + AGENTS.md AVANT toute action
```

---

## COMMENT REPRENDRE (étape par étape)

1. Ouvrir une session dans `C:\Users\amans\OneDrive\Projets\Infra` et écrire **« reprends en Ralph »**.
2. Lire **`.ralph/prd.json`** → la story prioritaire est la première `passes:false` dont les `deps` sont tous `passes:true` = **S-007**.
3. Lire **`.ralph/progress.md`** → section « Codebase Patterns » (conventions) + « Dette identifiée » + le log par story.
4. Lire **`AGENTS.md`** → règles absolues (zéro dette, RLS, français accents majuscules, sources, etc.).
5. Travailler **une seule story**, valider (typecheck+lint+test+build), puis `passes:true` + log + commit `[S-XXX] …` + `git push origin main`.

**Vérif rapide d'entrée** : `git log --oneline -1` doit montrer le commit `[S-008] …` (dernier commit de code). `npm test` doit donner 60/60. Pour S-012 : Supabase local déjà démarré (`npx supabase status` pour les URLs/clés ; sinon `npx supabase start`). Price feed live : `npm start` puis `GET /api/pricing`.

---

## [ETAT] — détaillé

- **Repo** : `https://github.com/Afristrat/mnemo` (compte gh `Afristrat`, déjà authentifié). Branche `main`, suivie de `origin/main`. Working tree propre (hors ce fichier de passation).
- **Dernier commit code** : `08e020f [S-006] Page resultats (stack + radar + carte de couts sourcee)`.
- **Stack installée** : Next.js 15.5 (App Router) · React 19 · TypeScript strict · Tailwind v3 · Vitest 2 + jsdom + @testing-library/react + jest-dom · `@vitejs/plugin-react@^4` (épinglé). **Pas encore installés** : Playwright (S-013), Supabase client (S-012), Firecrawl/SDK (S-008).
- **Commandes** : `npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint` · `npm test` · `npm run test:e2e` (Playwright, à venir).
- **Tests** : 30/30 verts (6 fichiers : smoke, engine 16, ui 5, wizard 2, results 1, radar 5).
- **Routes** : `/` (accueil), `/configurateur` (wizard), `/resultats` (reco). Toutes statiques.

## [FAIT] cette session — 6 stories (toutes validées + poussées)

| Story | Livré | Commit |
|---|---|---|
| S-001 | Scaffold Next/TS/Tailwind/ESLint/Vitest | `3660f74` |
| S-002 | Design system (tokens DESIGN.md → tailwind.config + primitives Button/Card/Chip/Input/StatusDot + `cn()`) | `d2a7e48` |
| S-003 | Moteur de reco pur en TS (`lib/engine/*` : types, modules, presets, preset, layers, cost, scores, diagnostics, recommend, index) | `a5c0138` |
| S-004 | 14 tests moteur | `f7bcc78` |
| S-005 | Wizard 6 étapes (16 params + modules + récap), `hooks/useWizardProfile`, `lib/wizard/*`, composants `components/wizard/*` | `f9d89ec` |
| S-006 | Page résultats : radar SVG (`lib/charts/radar`), LayerStack, CostMap (bandes ±30 % + sources `lib/pricing/sources`), slider projection | `08e020f` |

En amont (avant le build) : cadrage produit, stress-test, **Moat Hunt** (`docs/MOAT-HUNT.md`), **PRD** (`PRD.md`), maquettes Stitch rangées dans `design-reference/`.

## [NEXT] — S-007 et la suite

**S-007 — Ensemble multi-config (F5)** — *prochaine story*. Acceptance (cf. `.ralph/prd.json`) : ≥ 3 configs candidates (ex. « souveraineté max », « coût min », « time-to-V1 min »), écart de coût/score affiché comme **incertitude**, libellé d'incertitude explicite. Analogie : ensemble forecasting météo (le spread = l'incertitude). **Approche suggérée** : une fonction pure `lib/engine` qui prend le profil et génère N variantes (via overrides ciblés du profil : forcer zone UE + modules sécurité pour « souveraineté max » ; budget bas + LIGHT-friendly pour « coût min » ; techLevel haut + LIGHT pour « time-to-V1 »), appelle `recommend()` sur chacune, et renvoie la divergence (min/max/écart de `totalCost` et `scoreAvg`). UI : nouvelle section dans `/resultats` ou onglet. Tester la fonction de génération + le calcul d'écart.

Stories restantes (ordre par dépendances, cf. `plan.md`) :
- **S-008** Price feed Firecrawl (rafraîchit `lib/pricing/sources.ts` ; clé `FIRECRAWL_API_KEY` en `.env.local`).
- **S-009** Export livrable (MD + PDF, sources cliquables, disclaimer « une IA peut se tromper »).
- **S-010** Exit Escrow F7 (génération bundle reproductible : IaC + vault + runbook ; **moat ①**).
- **S-011** Fiduciary Mode F8 (page divulgation, zéro commission cachée ; **moat ②**).
- **S-012** Supabase + **RLS sur TOUTES les tables** + auth + consentement réseau opt-in horodaté (**moat ③ = rails**).
- **S-013** Playwright e2e (wizard→résultats→export) + responsive + CI.
- **S-014** CLAUDE.md projet + README + CI GitHub Actions + **migration `next lint` → ESLint CLI** (dette).

## [ALERTE] — pièges & risques

- **Secrets** : S-008 (`FIRECRAWL_API_KEY`) et S-012 (clés Supabase) → uniquement dans `.env.local` (déjà couvert par `.gitignore` via `.env*`). `.env.example` documente les noms. **Jamais de clé en clair / commitée.**
- **RLS** : à S-012, RLS activé sur **toutes** les tables (champ tenant/`circle` pivot), sans exception. Threat model dans `PRD.md §8`.
- **OneDrive** : le repo est dans OneDrive → I/O `node_modules`/`.next` parfois lents (sync). Non bloquant.
- **next lint déprécié** (retrait Next 16) : lint passe (0 erreur) mais migrer vers ESLint CLI en **S-014**.

## [MEMO] — conventions & learnings (ne pas réapprendre)

1. **Validation par story obligatoire avant `passes:true`** : `typecheck` 0 → `test` vert → `lint` 0 → `build` OK. Puis commit + push.
2. **`decidePreset()` renvoie `reason`** ; c'est `recommend()` qui expose `presetReason`. Ne pas confondre.
3. **Pas de générique sur union de tableaux** (erreur TS « méthode non appelable ») → togglers dédiés (cf. `useWizardProfile`).
4. **`afterEach(cleanup)`** dans `test/setup.ts` est requis (sinon DOM jsdom s'accumule → faux `findByText` multiples).
5. **Apostrophes dans le texte JSX** → utiliser « ’ » typographique (corrige `react/no-unescaped-entities` + bonne typo FR).
6. **Le champ `expected` des `PRESET_PROFILES` est une étiquette d'auteur, PAS le résultat calculé** (« Coach » → LIGHT par les règles). Ne jamais tester contre `expected`.
7. **`@vitejs/plugin-react` épinglé `^4`** (v6 exige vite 8, incompatible vitest 2/vite 5). Pas de `--force`.
8. **`noUncheckedIndexedAccess` n'est pas dans `strict`** → indexation tableau renvoie `T` (pas `T|undefined`).
9. **Français** : accents sur majuscules obligatoires partout dans l'UI/contenu.
10. **Règles TS du poste** (`~/.claude/rules/typescript.md`) : pas de `any`/`as`/`!`, return types sur fonctions exportées, `const` objects au lieu d'enums, `unknown` plutôt qu'`any`.

## DÉCISIONS PRODUIT VERROUILLÉES (ne pas re-litiger)

- **Cœur = conseil puis déploiement, séquencés** ; modèle **« recette ouverte, cuisine payante »**.
- **Production-ready, zéro dette, PAS de MVP** ; lots tous au niveau prod, ordre dicté seulement par la dépendance causale (moat ③ Network n'a pas de données tant qu'aucun déploiement monitoré → démarre en rails).
- **±30 % assumé** : c'est un simulateur, le slider de projection est la réponse honnête. Prix via price feed Firecrawl, pas de table figée.
- **Agent (Lot 2) = provisioning hybride human-in-the-loop** : l'utilisateur crée le compte (lien+procédure, sa carte), l'agent optimise après via OAuth/MCP. **L'agent ne crée jamais de compte ni ne saisit de carte** (lève CGU + responsabilité).
- **Trio de moats** (cf. `docs/MOAT-HUNT.md`) : ① Exit Escrow (S-010), ② Fiduciary Mode (S-011), ③ Intelligence Network (rails S-012). **Jamais de commission vendor cachée** (leçon Flipper).
- **Cible MVP = P1 (communauté d'Amine) + P2 (PME tech)** ; ETI/grand groupe hors périmètre.

## POINTEURS

- `PRD.md` — spec complète (features F1→F15, archi, sécurité/threat model, modèle éco, métriques, risques).
- `docs/MOAT-HUNT.md` — les 3 moats + 8 analogies sourcées.
- `.ralph/prd.json` — les 14 stories + acceptance + dépendances.
- `.ralph/progress.md` — patterns + dette + log détaillé par story.
- `AGENTS.md` — règles opératoires pour l'agent.
- `plan.md` — vue d'ensemble + séquençage.
- `design-reference/mn_mo_brand_identity/DESIGN.md` — système de design (tokens).
- `design-reference/.../simulator-archi-base-memorielle-v2.html` — simulateur source (déjà porté en `lib/engine`, à reconsulter seulement pour `computeV1vsV1plus`/`computeRoadmap`/`computeCriticalDecisions` non encore portés).
- Mémoire projet : `~/.claude/projects/C--Users-amans-OneDrive-Projets-Infra/memory/mnemo-cadrage-produit.md`.
```
== FIN PASSATION ==
```
