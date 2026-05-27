# Spec de design — Strate : LLM plateforme + Reco vivante (spec n°3)

> Brainstorm validé avec Amine (2026-05-27). Déclenché par une question fondamentale : « où est branché
> le LLM qui répond aux questions de l'utilisateur ? » → constat vérifié dans le code : **aucun LLM n'est
> branché** (Strate est 100 % déterministe ; le seul appel IA est Firecrawl pour extraire les *prix*).
> Et insight d'Amine : **les recommandations techniques sont figées** (`lib/engine/layers.ts`, catalogue
> daté ~mai 2026) alors que la recherche web doit permettre de proposer **au-delà du figé**.
> Discipline : ce spec → `writing-plans` → stories `S-034+` (Ralph). Production-ready, zéro dette, DÉFCON 1.

## 1. Objectif & contexte

Brancher un LLM **au niveau plateforme** (via le proxy **LiteLLM `proxy.ai-mpower.com`**, décision produit #8)
et l'utiliser pour rendre la recommandation **vivante** — les composants techniques (modèles, outils,
versions) proposés par **recherche web sourcée** au lieu d'un catalogue figé — **sans** sacrifier DÉFCON 1
ni les 3 moats (déterminisme du calcul, Exit Escrow reproductible, Fiduciary Mode). Plus trois usages
applicatifs du LLM : assistant **Q&A**, interprétation de l'**intake libre**, **narration** du rapport.

**Frontière validée par Amine : « tout vivant + filet ».** Le web/LLM peut reconsidérer **tout** (structure
comprise), MAIS : le **calcul de coût reste déterministe sur des prix sourcés** (le LLM ne calcule jamais),
chaque reco est **figée dans un snapshot daté + sourcé** (reproductible), et un **garde-fou DÉFCON 1**
valide chaque candidat (repli seed si invalide/indisponible). **Assemblage en temps réel** (à chaque reco),
pas de catalogue périodique stocké.

## 2. Principe directeur (la réconciliation)

On ne change **pas la nature** de `recommend()` : il reste **pur et déterministe étant donné un catalogue
et des prix**. Ce qui devient vivant, c'est le **catalogue de composants** — aujourd'hui figé dans
`layers.ts` — désormais **injecté**, exactement comme les prix le sont déjà (`recommend(profile, prices)`
depuis S-018). Le LLM **propose** des candidats sourcés ; le **garde-fou** valide ; le **moteur filtre**
selon les contraintes dures (souveraineté, conformité, budget) et **calcule** sur les prix du feed.
La garantie de fiabilité se **déplace** de « déterministe atemporel » vers « **sourcé + vérifié + horodaté**
+ reproductible par snapshot ».

## 3. Périmètre

**Dans ce spec** :
1. Fondation LLM plateforme (client serveur tapant le proxy LiteLLM, sécurité, repli).
2. Reco vivante : `Catalog` injecté, seed de repli (= l'actuel `layers.ts`), service de veille temps réel
   (Firecrawl + LLM), garde-fou de validation, snapshot reproductible.
3. Trois usages : Q&A chat, intake libre → `Profile`, narration (infobulles/verdict).

**Hors-scope** : le **choix du provider/modèle** (fait par Amine **dans LiteLLM**, pas dans l'app — l'app
référence un alias) ; la résidence multi-juridiction / DR (spec n°2) ; l'epic i18n ; le renommage technique
`mnemo`. Les **prix** restent gérés par le feed existant (S-025) — cette spec ne les recalcule pas via LLM.

## 4. Brique (I) — Fondation LLM plateforme (`lib/llm/`)

- **Client serveur pur-ish** `callLLM(messages, opts)` : `fetch` **injectable** (testabilité), **jamais
  throw** → renvoie un résultat typé `{ ok: true, content } | { ok: false, reason }` (repli géré par
  l'appelant). Cible le proxy LiteLLM (`LITELLM_BASE_URL` + `LITELLM_API_KEY`, **lus côté serveur
  uniquement**, jamais `NEXT_PUBLIC_*`, jamais dans le bundle client). Alias de modèle applicatif
  (`strate-default`) — le provider/modèle réel se règle **dans LiteLLM** (super-admin = Amine).
- **Routes serveur** `app/api/llm/*` (Node runtime, dynamic) : le navigateur ne parle qu'à **nos** routes,
  jamais au proxy directement (clé jamais exposée). Rate-limit + cache court (coût tokens).
- **Recherche web** : réutilise le client Firecrawl existant (`lib/pricing/firecrawl.ts`,
  `scrapeStructuredJson` / search) pour alimenter le LLM en sources fraîches.
- Secrets : noms `LITELLM_BASE_URL`, `LITELLM_API_KEY` à ajouter au coffre GLOBAL DPAPI (jamais affichés).
  `.env.example` mis à jour (noms seulement).

## 5. Brique (II) — Reco vivante (`lib/catalog/`)

### 5.1 Modèle de données

```typescript
type Provenance = "live" | "seed" | "flagged";          // d'où vient le candidat + statut garde-fou
type ComponentSovereignty = "sovereign" | "eu-hosted" | "api-third-party";

type ComponentCandidate = {
  name: string;                 // ex. "Qwen3-Embed-7B"
  role: string;                 // ex. "embeddings multimodaux self-host"
  license?: string;             // ex. "Apache-2.0" (vérifié par le garde-fou)
  sovereignty: ComponentSovereignty;
  benchmarkRank?: string;       // ex. "#1 MMEB-V2" (sourcé)
  sourceUrl: string;            // DÉFCON 1 : toujours présent
  checkedAt: string;            // fraîcheur
  confidence: Confidence;       // high | medium | low (type StatusDot existant)
  provenance: Provenance;
  note?: string;
};

type SlotId = "c0" | "c1" | "c2" | "c3" | "c4" | "c5" | "c6";
type CatalogSlot = { slot: SlotId; recommended: ComponentCandidate; alternatives: ComponentCandidate[] };
type Catalog = { slots: Record<SlotId, CatalogSlot>; assembledAt: string; source: "live" | "seed" | "mixed" };
```

### 5.2 Seed (= repli + baseline de plausibilité)

Le catalogue **figé actuel** de `layers.ts` est **extrait en données** : `lib/catalog/catalog-seed.ts`
expose `seedCatalog(preset, profile): Catalog` qui reproduit **à l'identique** la logique conditionnelle
existante (preset × multimodal × bitemporel). Il devient le **repli daté** (le réseau/LLM échoue → seed)
**et** la **baseline de plausibilité** (un candidat live aberrant est rejeté au profit du seed). C'est la
transposition exacte de la doctrine prix (`prix-jamais-hardcodes-feed-live`) au **catalogue**.

### 5.3 `buildLayers` & `recommend` injectés

- `buildLayers(preset, profile, catalog = seedCatalog(preset, profile))` : lit
  `catalog.slots[ci].recommended` (nom/note/alternatives) au lieu des littéraux. Défaut = seed ⇒ **sortie
  identique à aujourd'hui** ⇒ **tous les tests existants restent verts** (déterminisme préservé).
- `recommend(profile, prices, catalog?)` : signature étendue (même pattern que `prices` en S-018). Pur.
  `ensemble.ts` threade `catalog`.

### 5.4 Service de veille **temps réel** + garde-fou

- `lib/catalog/live-catalog.ts` `assembleLiveCatalog(profile, deps)` : **pour chaque slot**, recherche web
  (Firecrawl) + LLM (proxy) → candidats → **`reconcileCatalog(liveCandidate, seedCandidate, profile)`**
  (pur) : valide **existence + licence cohérente + souveraineté compatible avec le profil + classement
  plausible** ; sinon `provenance: "flagged"` + `confidence: low` + **repli sur le seed**. Le **moteur
  filtre** les candidats incompatibles avec les contraintes dures (secret ⇒ pas d'`api-third-party`, etc.).
- **Temps réel** : déclenché à la reco. UX = **pattern prix** (`/api/pricing/live`) : la page rend d'abord
  avec le **seed** (repli immédiat) → `app/api/catalog/live` assemble le live (async) → `ResultsView`
  recalcule `recommend(profile, prices, liveCatalog)`. **Cache court** (TTL, `now` injectable) pour ne pas
  relancer une recherche identique en rafale ; **repli seed** si Firecrawl/LLM indisponible (la reco reste
  fonctionnelle, jamais bloquante). LLM **ne calcule jamais** un coût.

### 5.5 Reproductibilité (snapshot)

À l'**export** (MD/PDF) et à l'**Exit Escrow**, on **fige** le `Catalog` retenu (candidats + sources +
`assembledAt`) **et** les prix utilisés dans le livrable → **rejouable**. Le snapshot est l'unité
reproductible (≠ déterminisme atemporel). `model.ts` (export) et `bundle.ts` (Exit Escrow) consignent la
provenance + la date.

### 5.6 Fiduciaire & audit trail (DÉFCON 1)

- **Zéro pondération vendor** : le prompt **interdit** tout biais commercial ; un filtre rejette toute
  justification de type « partenariat/commission ». Invariant testé (comme la charte S-011).
- **Audit trail** persisté (table Supabase `catalog_observations`, **RLS**) : par reco, les candidats
  proposés + source + confiance + provenance → traçabilité fiduciaire même en temps réel.
- **Aucun composant** présenté sans `sourceUrl` + `checkedAt` + pastille de confiance (comme les coûts).

## 6. Briques (III–V) — Usages du LLM

- **(III) Q&A chat** : surface UI neuve (`components/assistant/`) + route serveur `app/api/llm/chat`.
  Entrée = question + **contexte de la reco courante** (preset/couches/coûts/sources). Question hors
  catalogue → recherche web sourcée. **Jamais de chiffre inventé** : les montants viennent de la reco/feed,
  cités avec leur source. Disclaimer « une IA peut se tromper ».
- **(IV) Intake libre → `Profile`** : route `app/api/llm/intake`. Texte/dictée « décrivez votre besoin »
  → LLM → **`Profile` structuré validé par schéma** (rejet/again si invalide) → écrit dans la source de
  vérité (`localStorage` `STORAGE_KEY`) → le **moteur calcule**. Le LLM **ne calcule pas**. Pré-remplit le
  wizard (« Affiner »). Défauts prudents documentés si le texte est ambigu (jamais sous-dimensionné).
- **(V) Narration** : route `app/api/llm/narrate`. Réécrit **infobulles** et **verdict** selon le profil,
  **chiffres injectés inchangés** (le LLM reçoit les valeurs, ne les régénère pas). Repli = textes actuels.

## 7. Sécurité

- Clé LiteLLM **serveur only** (coffre DPAPI), jamais `NEXT_PUBLIC`, jamais bundle client. Le client ne
  parle qu'à nos routes `app/api/llm/*` et `app/api/catalog/live`.
- Rate-limit + cache (maîtrise du coût tokens). Timeouts + repli (jamais bloquer la reco).
- RLS sur `catalog_observations` (pivot `circle`, comme les autres tables).

## 8. Coût & performance (assumés)

- Temps réel = appels Firecrawl + LLM **par reco** → latence (secondes) + coût tokens. Mitigation : **seed
  immédiat** (UX non bloquante), **cache court** (requêtes identiques rapprochées), recherche **par slot
  parallélisée**, repli seed si lent/indispo. À documenter (±, comme les hypothèses de modélisation).

## 9. Stratégie de test

- **Fondation LLM** : `callLLM` avec `fetch` mocké (succès / 5xx / timeout → repli typé, jamais throw).
- **Catalogue** : `seedCatalog` déterministe ; `buildLayers(catalog=seed)` ⇒ sortie identique (snapshot des
  tests existants verts) ; `reconcileCatalog` (candidat halluciné/licence incohérente/souveraineté
  incompatible → `flagged` + repli seed) ; `recommend(profile, prices, seed)` = invariants existants verts.
- **Live** : `assembleLiveCatalog` avec Firecrawl+LLM mockés (promotion live valide / flag aberrant / repli
  total) ; cache (`now` injectable).
- **Snapshot** : export + Exit Escrow figent le catalogue (provenance + date présentes, rejouable).
- **Usages** : intake → `Profile` valide (schéma) ; narration → **chiffres préservés** (invariant) ; Q&A →
  pas d'invention de chiffre (les montants cités == ceux de la reco).
- **Fiduciaire** : invariant « aucun candidat sans source », « aucune pondération vendor ».
- **E2E** : reco rend en seed puis bascule live (provenance affichée) ; intake libre → wizard pré-rempli →
  verdict ; chat répond avec sources. Desktop + mobile. Garde-fou : typecheck 0 · lint 0/0 · build OK.

## 10. UI

- **Provenance des composants** dans les résultats (live/seed/flagged + source + fraîcheur + confiance),
  jumelle de `LivePriceStatus` pour les prix.
- **Intake libre** : champ « Décrivez votre besoin » (+ dictée navigateur si dispo) sur l'accueil / en tête
  du wizard → pré-remplit.
- **Assistant Q&A** : panneau de chat contextuel sur `/resultats`.
- Français accents majuscules ; responsive ; disclaimers IA.

## 11. Risques & mitigations

| # | Risque | Grav. | Mitigation |
|---|--------|-------|------------|
| 1 | LLM hallucine un composant | 🔴 | garde-fou `reconcileCatalog` (existence/licence/classement) + repli seed + confiance + source obligatoire |
| 2 | Perte de testabilité (vivant) | 🟠 | tests sur **seed** (déterministe) + invariants ; le live est testé sur garde-fou/repli, pas sur valeurs |
| 3 | Coût/latence temps réel | 🟠 | seed immédiat + cache court + parallélisation + repli ; documenter le coût |
| 4 | Biais vendor (anti-fiduciaire) | 🔴 | prompt sans biais + filtre + audit trail + invariant testé |
| 5 | Fuite de clé LLM | 🔴 | clé serveur only (coffre), routes proxy, jamais bundle client |
| 6 | LLM/Firecrawl down | 🟠 | repli seed total → la reco reste fonctionnelle et sourcée (datée) |
| 7 | Intake mal interprété | 🟠 | validation par schéma + défauts prudents + « Affiner » manuel toujours dispo |

## 12. Migration & fichiers

**Créer** : `lib/llm/{client,types}.ts` ; `app/api/llm/{chat,intake,narrate}/route.ts` ;
`lib/catalog/{types,catalog-seed,reconcile,live-catalog,cache}.ts` ; `app/api/catalog/live/route.ts` ;
`components/assistant/*` (chat) + `components/intake/*` (intake libre) + `components/results/CatalogProvenance.tsx` ;
migration `catalog_observations` (RLS) ; tests dédiés.
**Modifier** : `lib/engine/layers.ts` (lit `catalog`) ; `recommend.ts` + `ensemble.ts` (signature `catalog`) ;
`ResultsView.tsx` (fetch live catalog + recalcul + provenance) ; `lib/export/model.ts` + `lib/exit/bundle.ts`
(snapshot catalogue) ; `components/wizard/Wizard.tsx` + accueil (intake libre) ; `.env.example` (noms LiteLLM).

## 13. Découpage en stories (Ralph)

- **S-034** — Fondation LLM plateforme (`lib/llm/` client serveur + routes + proxy LiteLLM + repli + secrets coffre + tests).
- **S-035** — Catalogue : `types` + `catalog-seed` (extraction de `layers.ts`, **sortie identique**) + `reconcileCatalog` (garde-fou) + `buildLayers(…, catalog)` + `recommend(…, catalog)` (déterministe sur seed) + tests.
- **S-036** — Veille **temps réel** (`assembleLiveCatalog` Firecrawl+LLM → candidats sourcés) + cache court + repli + filtre contraintes + audit trail (`catalog_observations` RLS) + route `app/api/catalog/live` + tests.
- **S-037** — Snapshot reproductible (export + Exit Escrow figent le catalogue + provenance) + `CatalogProvenance` UI + `ResultsView` (seed→live→recalcul) + e2e provenance.
- **S-038** — Intake libre → `Profile` (route LLM + validation schéma + pré-remplissage wizard + tests + e2e).
- **S-039** — Narration (infobulles/verdict réécrits, **chiffres préservés**, repli textes actuels + tests).
- **S-040** — Assistant Q&A (surface chat + route + contexte reco + recherche web sourcée + disclaimers + e2e).

## 14. Articulation & séquençage

Cette spec passe **n°1** (demande prioritaire d'Amine). Derrière, dans l'ordre : bloc **backup**
(S-028→S-031, moteur déjà prêt) · **spec n°2** (résidence/DR) · **epic i18n**. Numérotation : S-034+ libres
(S-032/033 déjà pris).

## 15. Pointeurs

`PRD.md` · `docs/DECISIONS.md` (ADR à venir) · spec n°1 backup
(`docs/superpowers/specs/2026-05-27-strate-backup-design.md`) · `.ralph/prd.json` (stories S-034+) ·
`AGENTS.md` · mémoires (`prix-jamais-hardcodes-feed-live` = doctrine étendue au catalogue,
`definition-de-termine`, `strate-avis-critique-non-oriente`, `secrets-handling-protocol`).
Proxy : LiteLLM `proxy.ai-mpower.com` (clé au coffre GLOBAL DPAPI).
