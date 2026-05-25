# Progress — Mnémo (Ralph Loop)

## Codebase Patterns

> Conventions à suivre pour rester cohérent. À enrichir à chaque nouveau pattern.

- **Stack** : Next.js 15 App Router, React 19, TypeScript strict, Tailwind v3, Supabase (RLS), Vitest (unit), Playwright (e2e).
- **Langue** : UI + contenu en français (accents sur majuscules obligatoires) ; code/identifiants en anglais.
- **Moteur** : logique de reco en `lib/engine/` — fonctions **pures**, sans dépendance UI, testées unitairement. Portée depuis `design-reference/.../simulator-archi-base-memorielle-v2.html`. Fichiers : `types.ts` (unions littérales via `as const`), `modules.ts`, `presets.ts`, `preset.ts` (decidePreset), `layers.ts` (buildLayers), `cost.ts`, `scores.ts` (8 dim avec clé `key`), `diagnostics.ts` (compliance/risks/kmChecks), `recommend.ts` (orchestrateur + bonus modules), `index.ts` (barrel). Point d'entrée : `recommend(profile): Recommendation`.
- **Design** : tokens de `design-reference/mn_mo_brand_identity/DESIGN.md`, portés dans `tailwind.config.ts`. Polices Space Grotesk (titres, `font-display`), Inter (corps, `font-sans`), JetBrains Mono (données/chiffres/clés/chemins, `font-mono`). Cartes `rounded-card` (14px), champs `rounded-input` (10px), boutons `rounded-full`. Élévation `shadow-elevation`. FontSize sémantiques : `text-display-lg`, `text-headline-lg/md`, `text-body-lg/md/sm`, `text-code-md`, `text-label-caps`.
- **Primitives UI** : `components/ui/{Button,Card,Chip,Input,StatusDot}.tsx` + helper `lib/utils/cn.ts` (clsx+tailwind-merge). Type `Confidence` (high/medium/low → 🟢🟡🟠) dans StatusDot. Composants = props typées étendant les attributs HTML, pas de `any`, return type `ReactElement`.
- **Tests** : Vitest + jsdom + @testing-library/react + jest-dom. `test/setup.ts` importe `@testing-library/jest-dom/vitest`. `@vitejs/plugin-react@^4` (épinglé : v6 exige vite 8, incompatible vitest 2/vite 5).
- **Sécurité** : zéro secret hardcodé (env/coffre) ; RLS sur toutes les tables Supabase ; pas de `any` TS sans commentaire justificatif.
- **Sources** : tout chiffre de coût affiché lie sa source (URL + date) + pastille de confiance 🟢🟡🟠 + disclaimer « une IA peut se tromper ».
- **Provisioning** : l'agent (Lot 2) ne crée jamais de compte ni ne saisit de carte — l'utilisateur crée le compte, l'agent optimise après (OAuth/MCP).

## Validation par story (obligatoire avant passes=true)

1. `npm run typecheck` → 0 erreur
2. `npm test` → vert
3. `npm run lint` → 0 erreur
4. `npm run build` → passe
5. (si UI) parcours vérifié
→ puis commit `[S-XXX] Titre` + push origin main.

## Dette identifiée (à résorber)

- `next lint` est déprécié (retrait Next.js 16). Migrer vers ESLint CLI (flat config) en **S-014**. Lint actuel : 0 erreur, donc non bloquant pour les stories intermédiaires.

- **Wizard / formulaires** : état dans `hooks/useWizardProfile.ts` (localStorage `mnemo:profile:v1`, reprise auto). Composants génériques `components/wizard/{RadioCards,CheckboxCards,NumberStepper,ModuleSlider,Wizard}`. Options/labels FR dans `lib/wizard/options.ts`, profil par défaut dans `lib/wizard/defaultProfile.ts`. Éviter le générique sur union de tableaux (erreur TS « méthode non appelable ») → togglers dédiés (`toggleContentType`, `toggleRegulation`).
- **Tests UI** : `test/setup.ts` enregistre `afterEach(cleanup)` (sinon les rendus s'accumulent dans le DOM jsdom → faux échecs `findByText` multiples).
- **Lint** : apostrophes dans le texte JSX → utiliser l'apostrophe typographique « ’ » (corrige `react/no-unescaped-entities` ET respecte la typo française).
- **Note séquencement** : le wizard pointe vers `/resultats` (route créée en S-006 — 404 transitoire jusque-là, build OK).

## Log

- 2026-05-24 — Itération 0 : fondation. git init, remote Afristrat/mnemo (vide), rangement maquettes → design-reference/, génération artefacts Ralph. Stack actée.
- 2026-05-24 — **S-001 ✅** Scaffold Next.js 15.5 + React 19 + TS strict + Tailwind v3 + ESLint + Vitest + polices next/font. Build OK (5 s, 4 pages statiques), typecheck 0, lint 0, test 1/1. Fichiers : package.json, tsconfig, next.config.mjs, tailwind.config.ts, postcss, .eslintrc.json, vitest.config.ts, app/{layout,page,globals.css}, lib/__tests__/smoke.test.ts. Learning : next/font fonctionne (réseau build dispo).
- 2026-05-24 — **S-002 ✅** Design system. Tokens DESIGN.md → tailwind.config (couleurs Material, fontSize sémantiques, rayons card/input, shadow-elevation). Primitives Button/Card/Chip/Input/StatusDot + cn(). Tests 6/6 (jsdom). typecheck 0, lint 0, build OK. Learning : conflit ERESOLVE @vitejs/plugin-react v6↔vitest 2 résolu en épinglant plugin-react@^4 (pas de --force).
- 2026-05-24 — **S-003 ✅** Moteur de reco porté en TS strict (10 fichiers lib/engine). recommend() pur et déterministe. typecheck 0, lint 0, build OK, test 6/6 (tests moteur = S-004). Learning : `noUncheckedIndexedAccess` n'est pas dans `strict` → indexation tableau sûre ; défauts modules en littéral explicite pour éviter `as`.
- 2026-05-24 — **S-004 ✅** Tests moteur (14 tests, total 20/20). Couvre decidePreset (HARD/LIGHT/MEDIUM), computeScores (conf=10 HARD, conf=4 LIGHT+audit requis, audit=10 bitemp requis), profileCostFactors (=465), recommend (invariants 7 couches/8 dim, bonus module conflict, déterminisme). typecheck 0, lint 0, build OK. **Learning capital : le champ `expected` des PRESET_PROFILES est une étiquette d'auteur, PAS le résultat calculé — « Coach » tombe en LIGHT par les règles. Ne jamais tester contre `expected`.**
- 2026-05-24 — **S-005 ✅** Wizard 6 étapes (16 params + modules + récap), persistance localStorage, profils-types, preset décidé inline. Route `/configurateur`. Tests 22/22 (dont 2 wizard). typecheck 0, lint 0, build OK. Learnings : togglers dédiés vs générique union ; `afterEach(cleanup)` obligatoire ; apostrophe typographique en JSX.
- 2026-05-25 — **S-006 ✅** Page `/resultats` : radar SVG maison (lib/charts/radar.ts, pur+testé), LayerStack 7 couches, CostMap (bandes ±30 % via costBand + pastilles 🟢🟡🟠 + sources datées via lib/pricing/sources.ts), slider de projection (volume + users, recalcul live), scores, compliance/risks. Tests 30/30 (radar 5, costBand 2, results 1). typecheck 0, lint 0, build OK. Learnings : radar SVG = zéro dépendance charting (pas de souci SSR canvas) ; sources seed réelles issues de la calibration, à rafraîchir par price feed S-008. Prochaine : S-007 (ensemble multi-config).
- 2026-05-25 — **S-007 ✅** Ensemble multi-config (F5). `lib/engine/ensemble.ts` (pur, déterministe) : `buildEnsemble(profile)` → baseline + 3 membres (sovereignty / cost / speed) via overrides ciblés, chaque membre passé dans `recommend()`, puis `computeSpread()` = dispersion (costRange/costRangePct, scoreRange, presetsSpan, agreement fort/modéré/faible + `uncertaintyLabel` explicite). Analogie prévision d'ensemble météo. UI : `components/results/EnsembleView.tsx` (présentational, prop `ensemble`) intégré dans ResultsView via `useMemo(buildEnsemble)` sur le profil projeté, placé après « Se projeter ». Tests 44/44 (+13 engine ensemble, +1 UI). typecheck 0, lint 0, build OK (/resultats 4.26 kB). Learnings : (a) overrides sécurité honnêtes — on ne baisse JAMAIS la `sensitivity` sous le choix utilisateur ; si elle force HARD, tous les membres convergent en HARD → spread faible = signal honnête de robustesse ; (b) modules max/off construits depuis `MODULES` (pas de littéral fragile, pas de `as`) ; (c) composant présentational (prop `ensemble`) plutôt que hook interne → testable sans localStorage.
- 2026-05-25 — **Infra Supabase local (hors story, demande utilisateur)** : `npx supabase init` + `start` (Docker). `supabase/config.toml` généré (untracked, sera intégré en S-012). Credentials locaux dans `.env.local` (git-ignoré). ⚠ CLI 2.101 = nouveau système de clés (`sb_publishable_…` / `sb_secret_…`) au lieu des JWT anon/service_role → en S-012, mettre à jour `.env.example` (anciens noms) + le client `@supabase/ssr` en conséquence. Services `imgproxy` + `pooler` arrêtés en local (non bloquant pour DB/Auth/REST).
