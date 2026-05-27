# Plan d'implémentation — Strate : LLM plateforme + Reco vivante

> **Pour les workers agentiques :** SOUS-SKILL REQUIS : `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans`, story par story. Pilotage **Ralph** : chaque story de `.ralph/prd.json` (S-034→S-040) doit avoir `typecheck 0 · lint 0/0 · tests verts · build OK` (+ e2e si pertinent) avant `passes=true`, puis commit `[S-XXX] …` + push. Étapes en checkbox (`- [ ]`).

**Goal :** brancher un LLM **au niveau plateforme** (proxy LiteLLM) et rendre la recommandation **vivante** (composants sourcés par recherche web temps réel au lieu du catalogue figé `layers.ts`), sans casser DÉFCON 1 ni les 3 moats ; plus 3 usages (Q&A, intake libre, narration).

**Architecture :** « **tout vivant + filet** ». `recommend()` reste **pur/déterministe étant donné un catalogue + des prix** ; le **catalogue de composants** devient **injecté** (comme les prix depuis S-018). Le LLM **propose** des candidats sourcés via le proxy LiteLLM + Firecrawl ; un **garde-fou** valide (existence/licence/souveraineté/classement → sinon repli **seed** = l'actuel `layers.ts`) ; le moteur **filtre + calcule** (le LLM ne calcule jamais un coût). Assemblage **temps réel** (pattern prix : seed immédiat → live async → recalcul + cache court + repli). Snapshot daté à l'export = reproductibilité.

**Tech Stack :** Next.js 15 (App Router) · React 19 · TS strict (pas de `any`/`as`/`!`) · Tailwind v3 · Supabase (RLS) · Vitest · Playwright · Firecrawl (existant). Conventions : `~/.claude/rules/typescript.md`, apostrophes JSX `’`, secrets au **coffre GLOBAL DPAPI** serveur only.

**Spec de référence :** `docs/superpowers/specs/2026-05-27-llm-plateforme-reco-vivante-design.md`. **Hors-scope :** choix provider/modèle (réglé **dans** LiteLLM), résidence/DR (spec n°2), i18n, renommage `mnemo`, recalcul des prix par LLM.

---

## Contrats clés (verrouillés par la spec §4–§5)

```typescript
// lib/llm/types.ts — fondation
type LlmResult = { ok: true; content: string } | { ok: false; reason: string };
// callLLM(messages, { model?, fetchImpl?, signal? }) => Promise<LlmResult>  (jamais throw → repli appelant)

// lib/catalog/types.ts — reco vivante
type Provenance = "live" | "seed" | "flagged";
type ComponentSovereignty = "sovereign" | "eu-hosted" | "api-third-party";
type ComponentCandidate = {
  name: string; role: string; license?: string; sovereignty: ComponentSovereignty;
  benchmarkRank?: string; sourceUrl: string; checkedAt: string; confidence: Confidence;
  provenance: Provenance; note?: string;
};
type SlotId = "c0" | "c1" | "c2" | "c3" | "c4" | "c5" | "c6";
type CatalogSlot = { slot: SlotId; recommended: ComponentCandidate; alternatives: ComponentCandidate[] };
type Catalog = { slots: Record<SlotId, CatalogSlot>; assembledAt: string; source: "live" | "seed" | "mixed" };
```

---

## Structure de fichiers

| Fichier | Responsabilité | Statut |
|---|---|---|
| `lib/llm/types.ts` · `lib/llm/client.ts` | `LlmResult` + `callLLM` (proxy LiteLLM, `fetch` injectable, jamais throw, clé serveur) | **créer** |
| `app/api/llm/{chat,intake,narrate}/route.ts` | routes serveur (clé jamais exposée, Node runtime) | **créer** |
| `lib/catalog/types.ts` | `Catalog`, `ComponentCandidate`, `CatalogSlot`, `Provenance` | **créer** |
| `lib/catalog/catalog-seed.ts` | `seedCatalog(preset, profile): Catalog` = extraction **à l'identique** de `layers.ts` | **créer** |
| `lib/catalog/reconcile.ts` | `reconcileCatalog(live, seed, profile)` (garde-fou pur, jumeau de `pricing/reconcile`) | **créer** |
| `lib/catalog/live-catalog.ts` · `cache.ts` | `assembleLiveCatalog(profile, deps)` (Firecrawl+LLM, parallèle par slot) + cache TTL | **créer** |
| `app/api/catalog/live/route.ts` | assemblage live (serveur) | **créer** |
| `lib/engine/layers.ts` | `buildLayers(preset, profile, catalog = seedCatalog(...))` lit le catalogue | modifier |
| `lib/engine/recommend.ts` · `ensemble.ts` | signature `catalog?` threadée (pur) | modifier |
| `lib/engine/types.ts` | `Recommendation` inchangé ; `Catalog` importé pour la signature | modifier |
| `components/results/{ResultsView,CatalogProvenance}.tsx` | seed→live→recalcul + provenance (jumeau `LivePriceStatus`) | créer/modifier |
| `lib/export/model.ts` · `lib/exit/bundle.ts` | **snapshot** catalogue (provenance + date) | modifier |
| `components/intake/*` · `components/wizard/Wizard.tsx` · `app/page.tsx` | intake libre → `Profile` | créer/modifier |
| `components/assistant/*` | panneau Q&A contextuel | **créer** |
| `supabase/migrations/*_catalog_observations.sql` | audit trail (RLS, pivot circle) | **créer** |
| `.env.example` | noms `LITELLM_BASE_URL` / `LITELLM_API_KEY` | modifier |
| tests unitaires/e2e associés | par story | créer/modifier |

---

## Stories (acceptance détaillée à reporter dans `.ralph/prd.json`)

### S-034 — Fondation LLM plateforme (proxy LiteLLM)
**Deps :** — · **Files :** `lib/llm/{types,client}.ts`, `lib/llm/__tests__/client.test.ts`, `app/api/llm/chat/route.ts` (squelette), `.env.example`
- [ ] **Vérif proxy AVANT code** : charger le coffre (`load-secrets.ps1`), confirmer que `proxy.ai-mpower.com` répond (`GET /v1/models`, **clé jamais affichée**, preuve = code HTTP + **noms** de modèles) → fixer l'alias applicatif (`strate-default`). Si indisponible → documenter et coder le repli quand même.
- [ ] Test : `callLLM` avec `fetch` **mocké** — succès (`{ ok: true, content }`), 5xx / timeout / réseau KO → `{ ok: false, reason }` **sans throw** ; clé lue de l'env serveur, **absente du payload retourné** ; pas d'appel si `LITELLM_API_KEY` manquante (repli).
- [ ] Impl : `lib/llm/types.ts` (`LlmResult`) + `lib/llm/client.ts` (`callLLM(messages, opts)`, base `LITELLM_BASE_URL`, Bearer `LITELLM_API_KEY` **serveur only**, `fetchImpl` injectable, `AbortSignal` timeout, jamais throw). Route `app/api/llm/chat` minimale (echo contextualisé, étoffée en S-040). `.env.example` += noms LiteLLM. Ajouter les noms au coffre DPAPI (hors chat).
- [ ] Commit `[S-034] Fondation LLM plateforme (client proxy LiteLLM + route serveur)`.
**Sécurité bloquante :** clé serveur only, jamais `NEXT_PUBLIC`, jamais dans le bundle ni le transcript.

### S-035 — Catalogue : seed + types + garde-fou + injection `recommend`
**Deps :** — · **Files :** `lib/catalog/{types,catalog-seed,reconcile}.ts`, `lib/engine/{layers,recommend,ensemble}.ts`, `lib/catalog/__tests__/*`, MAJ tests moteur
- [ ] Test : `seedCatalog(preset, profile)` couvre les 7 slots pour LIGHT/MEDIUM/HARD × multimodal × bitemporel ; `buildLayers(preset, profile, seedCatalog(...))` produit **exactement** les mêmes `Layer[]` qu'aujourd'hui (snapshot des sorties actuelles) → **tous les tests existants restent verts** ; `reconcileCatalog` : candidat live valide → `live` ; sans `sourceUrl` / licence incohérente / souveraineté incompatible avec le profil / classement aberrant → `flagged` + `confidence: low` + **repli seed**.
- [ ] Impl : `lib/catalog/types.ts` (contrats ci-dessus) ; `catalog-seed.ts` (transpose les littéraux conditionnels de `layers.ts` en `Catalog`) ; `reconcile.ts` (pur, jumeau `pricing/reconcile.ts`) ; `buildLayers(preset, profile, catalog = seedCatalog(preset, profile))` lit `catalog.slots[ci]` ; `recommend(profile, prices, catalog?)` + `buildEnsemble(profile, prices?, catalog?)` threadent le catalogue (défaut seed). **Lecture JSON inconnu sans `as`/`any`** (type guard).
- [ ] Commit `[S-035] Catalogue injecté (seed = layers.ts) + garde-fou + recommend(catalog)`.
**DÉFCON 1 :** chaque `ComponentCandidate` du seed porte `sourceUrl` + `checkedAt` (repris des sources existantes / `docs/`).

### S-036 — Veille temps réel (Firecrawl + LLM) + audit trail
**Deps :** S-034, S-035 · **Files :** `lib/catalog/{live-catalog,cache}.ts`, `app/api/catalog/live/route.ts`, `supabase/migrations/*_catalog_observations.sql`, `lib/supabase/types.ts`, tests
- [ ] Test (mocks Firecrawl + `callLLM`) : `assembleLiveCatalog(profile, deps)` → candidats promus quand valides ; **flag + repli seed** si LLM/Firecrawl KO ou candidat aberrant ; **filtre contraintes dures** (`secret` ⇒ pas d'`api-third-party`) ; `cache` (`now` injectable) ne relance pas une requête identique dans la fenêtre ; **zéro pondération vendor** (invariant : aucune justification `commission|partenariat`).
- [ ] Impl : `live-catalog.ts` (par slot : recherche web Firecrawl + `callLLM` → `ComponentCandidate[]` → `reconcileCatalog` ; parallélisé ; repli seed total si indispo) ; `cache.ts` (TTL court) ; route `app/api/catalog/live` (POST profil → `Catalog`, clé serveur). Migration `catalog_observations` (**RLS**, pivot `circle`) + builder pur d'enregistrement d'audit ; test RLS gated (skip CI).
- [ ] Commit `[S-036] Veille temps réel catalogue + garde-fou + audit trail RLS`.
**DÉFCON 1 :** jamais de candidat sans `sourceUrl` ; aberrant/non vérifié → `flagged` + confiance basse + repli.

### S-037 — Snapshot reproductible + provenance UI
**Deps :** S-035, S-036 · **Files :** `components/results/{ResultsView,CatalogProvenance}.tsx`, `lib/export/model.ts`, `lib/exit/bundle.ts`, tests + e2e
- [ ] Test : `ResultsView` rend d'abord avec le **seed** puis bascule sur le live (`/api/catalog/live`) → `recommend(profile, prices, liveCatalog)` recalcule ; `CatalogProvenance` affiche provenance (live/seed/flagged) + source + fraîcheur + confiance ; `buildDeliverable`/`buildExitBundle` **figent** le catalogue retenu (candidats + sources + `assembledAt`) → rejouable (test de cohérence snapshot).
- [ ] Impl : `CatalogProvenance.tsx` (jumeau `LivePriceStatus`) ; `ResultsView` fetch live + recalcul ; `model.ts` + `bundle.ts` consignent le snapshot du catalogue. e2e : la reco affiche la provenance et reste cohérente seed→live.
- [ ] Commit `[S-037] Snapshot reproductible + provenance catalogue (UI + export + Exit Escrow)`.

### S-038 — Intake libre → `Profile`
**Deps :** S-034 · **Files :** `app/api/llm/intake/route.ts`, `components/intake/IntakeField.tsx`, `components/wizard/Wizard.tsx`/`app/page.tsx`, `lib/quick/*`, tests + e2e
- [ ] Test : route `intake` (callLLM mocké) → JSON parsé **validé par schéma** vers `Profile` (champs hors-bornes rejetés → re-prompt/repli) ; texte ambigu → **défauts prudents documentés** (jamais sous-dimensionné) ; le `Profile` écrit dans `localStorage` (`STORAGE_KEY`) est consommable par `recommend`.
- [ ] Impl : route `app/api/llm/intake` (prompt → `Profile` structuré, validation par garde de schéma, le LLM **ne calcule pas**) ; `IntakeField` (« Décrivez votre besoin » + dictée navigateur si dispo) sur l'accueil / tête de wizard → pré-remplit puis « Affiner ». Repli : saisie manuelle toujours dispo.
- [ ] Commit `[S-038] Intake libre → Profile (route LLM + validation + pré-remplissage)`.

### S-039 — Narration (infobulles / verdict)
**Deps :** S-034 · **Files :** `app/api/llm/narrate/route.ts`, intégration `ResultsView`/`InfoBubble`, tests
- [ ] Test : route `narrate` (callLLM mocké) reçoit les **chiffres injectés** et les **préserve** (invariant : aucun montant régénéré/altéré) ; repli = textes actuels si LLM KO ; disclaimer IA présent.
- [ ] Impl : route `app/api/llm/narrate` (réécrit infobulles + verdict selon profil, chiffres en entrée non modifiables) ; branchement progressif côté UI avec repli sur les textes statiques existants.
- [ ] Commit `[S-039] Narration LLM (infobulles/verdict, chiffres préservés)`.

### S-040 — Assistant Q&A
**Deps :** S-034, S-037 · **Files :** `components/assistant/AssistantPanel.tsx`, `app/api/llm/chat/route.ts` (étoffée), tests + e2e
- [ ] Test : route `chat` (callLLM + Firecrawl mockés) → réponse avec **contexte de la reco** ; question hors catalogue → recherche web **sourcée** ; **aucun chiffre inventé** (les montants cités == ceux de la reco/feed) ; disclaimer IA.
- [ ] Impl : `AssistantPanel` (chat contextuel sur `/resultats`) + route `chat` étoffée (contexte reco sérialisé, recherche web sourcée, garde anti-invention). e2e : poser une question → réponse sourcée.
- [ ] Commit `[S-040] Assistant Q&A contextuel (chat + recherche web sourcée)`.

---

## Self-review

- **Couverture spec** : §4 fondation LLM → S-034 ; §5.1/5.2/5.3 catalogue+seed+injection → S-035 ; §5.4 veille temps réel+garde-fou → S-036 ; §5.5 snapshot → S-037 ; §5.6 fiduciaire/audit trail → S-036 ; §6-III Q&A → S-040 ; §6-IV intake → S-038 ; §6-V narration → S-039 ; §7 sécurité → S-034 (clé) + S-036 (RLS) ; §9 tests → chaque story + e2e (S-037/S-038/S-040). **Hors-scope** (provider/modèle, résidence/DR, i18n, renommage) : non planifié, conforme.
- **Placeholders** : aucun ; `firmPriceTier=[PLACEHOLDER]` (prix de vente) reste intentionnel et hors plan.
- **Cohérence des types** : `LlmResult` (S-034) ; `Catalog`/`ComponentCandidate`/`CatalogSlot`/`Provenance` définis en S-035, consommés en S-036/S-037 ; `recommend(profile, prices, catalog?)` signature unique threadée (S-035) puis injectée live (S-037). Noms alignés sur le spec §4/§5.
- **Séquencement** : S-034 (LLM) et S-035 (catalogue, refacto pur) indépendants → parallélisables ; S-036 = jonction (LLM+catalogue) ; S-037 dépend de S-035+S-036 ; usages S-038/S-039 sur S-034 ; S-040 sur S-034+S-037.

## Hand-off d'exécution

Ralph inline (story par story, validation entre chaque) **recommandé** ici (cohérent avec le pilotage `.ralph/prd.json` du projet), ou subagent-driven (un subagent par story + revue). Question posée en fin de plan.
