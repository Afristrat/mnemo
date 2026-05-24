# Progress — Mnémo (Ralph Loop)

## Codebase Patterns

> Conventions à suivre pour rester cohérent. À enrichir à chaque nouveau pattern.

- **Stack** : Next.js 15 App Router, React 19, TypeScript strict, Tailwind v3, Supabase (RLS), Vitest (unit), Playwright (e2e).
- **Langue** : UI + contenu en français (accents sur majuscules obligatoires) ; code/identifiants en anglais.
- **Moteur** : logique de reco en `lib/engine/` — fonctions **pures**, sans dépendance UI, testées unitairement. Portée depuis `design-reference/.../simulator-archi-base-memorielle-v2.html`.
- **Design** : tokens de `design-reference/mn_mo_brand_identity/DESIGN.md`. Polices Space Grotesk (titres), Inter (corps), JetBrains Mono (données/chiffres/clés/chemins). Cartes 14px, champs 10px, boutons pilule. Données numériques TOUJOURS en JetBrains Mono.
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

## Log

- 2026-05-24 — Itération 0 : fondation. git init, remote Afristrat/mnemo (vide), rangement maquettes → design-reference/, génération artefacts Ralph. Stack actée.
- 2026-05-24 — **S-001 ✅** Scaffold Next.js 15.5 + React 19 + TS strict + Tailwind v3 + ESLint + Vitest + polices next/font. Build OK (5 s, 4 pages statiques), typecheck 0, lint 0, test 1/1. Fichiers : package.json, tsconfig, next.config.mjs, tailwind.config.ts, postcss, .eslintrc.json, vitest.config.ts, app/{layout,page,globals.css}, lib/__tests__/smoke.test.ts. Learning : next/font fonctionne (réseau build dispo). Prochaine : S-002 (design system).
