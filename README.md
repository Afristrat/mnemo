# Strate

**Infrastructure de base mémorielle IA souveraine.** Strate aide une organisation à
**choisir, déployer et exploiter** sa base mémorielle — sans migration, sans verrouillage,
sans coûts cachés. Ce dépôt couvre le **Lot 1 (conseil + moats)** : un configurateur qui
recommande une stack, la chiffre (prix sourcés, ±30 %), explore l'incertitude, produit un
livrable exportable et un bundle de redéploiement, et pose les rails multi-tenant.

## Prérequis

- **Node.js 22+**
- **Docker Desktop** (pour la stack Supabase locale, optionnelle au dev pur)

## Installation

```bash
npm install
cp .env.example .env.local   # renseignez vos clés (voir ci-dessous)
npm run dev                  # http://localhost:3000
```

### Variables d'environnement (`.env.local`)

| Variable | Usage |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase (locale : `http://127.0.0.1:54321`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé **publishable** (publique, client) |
| `SUPABASE_SERVICE_ROLE_KEY` | clé **secret** (serveur uniquement, bypass RLS) |
| `FIRECRAWL_API_KEY` | price feed (re-vérification des prix vendor) |

Le price feed et Supabase sont facultatifs pour explorer le configurateur : sans clé, le
price feed retombe sur des sources datées (seed) et le reste fonctionne.

## Supabase local (rails F9)

```bash
npx supabase start    # démarre la stack (Docker)
npx supabase status   # affiche URLs + clés à coller dans .env.local
npx supabase db reset # (ré)applique les migrations (schéma + RLS)
```

## Parcours

`/` → `/configurateur` (wizard 6 étapes, 16 paramètres) → `/resultats` (stack 7 couches,
radar 8 dimensions, carte de coûts sourcée, ensemble d'incertitude, export MD/PDF, bundle
Exit Escrow) · `/fiduciaire` (charte : zéro commission cachée).

## Qualité

```bash
npm run typecheck   # 0 erreur
npm run lint        # ESLint CLI, 0 erreur / 0 warning
npm test            # Vitest (unitaire)
npm run test:e2e    # Playwright (desktop + mobile) — libérez le port 3000 au préalable
npm run build       # build de production
```

> Le test d'intégration RLS s'exécute si `SUPABASE_TEST_URL` / `SUPABASE_TEST_ANON_KEY` /
> `SUPABASE_TEST_SECRET_KEY` sont fournis (sinon il est ignoré). La CI (`.github/workflows/ci.yml`)
> enchaîne qualité (typecheck/lint/test/build/audit) puis e2e Playwright.

## Structure

`app/` (routes + `/api/pricing`) · `components/` (`ui`, `wizard`, `results`) · `lib/`
(`engine`, `pricing`, `export`, `exit`, `fiduciary`, `supabase`, `network`, `wizard`,
`charts`, `utils`) · `hooks/` · `supabase/migrations/` · `e2e/` · `design-reference/`
(maquettes Stitch + `DESIGN.md`) · `.ralph/` (pilotage) · `docs/` (`DECISIONS.md`, `MOAT-HUNT.md`).

Détails d'architecture et conventions : [`CLAUDE.md`](./CLAUDE.md) · spec : [`PRD.md`](./PRD.md).

---

> Strate produit des **projections sourcées** (±30 %), pas des engagements. Une IA peut se
> tromper : vérifiez chaque source avant décision.
