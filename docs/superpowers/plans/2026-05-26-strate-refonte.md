# Plan d'implémentation — Refonte Strate

> **Pour les workers agentiques :** SOUS-SKILL REQUIS : `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans`, story par story. Le pilotage de référence reste **Ralph** : chaque story de `.ralph/prd.json` (S-015→S-024) doit avoir `typecheck 0 · lint 0/0 · tests verts · build OK` avant `passes=true`, puis commit `[S-XXX] …` + push. Étapes en checkbox (`- [ ]`).

**Goal :** transformer le simulateur en **Strate** — une plateforme qui designe une infra de base mémorielle selon besoins + contraintes et la chiffre, avec un chemin 90 s, un wizard 4 blocs, un dimensionnement multimodal intégré aux couches (mémoriser + créer), et de la conversion/data.

**Architecture :** moteur pur déterministe (`lib/engine/`) — les besoins (dont multimodal) sont traduits en **ressources** par `sizing.ts` (GPU mutualisé compté une fois, stockage indexé sur le volume), qui **dimensionnent les couches C4/C5/C6**. UI en 4 blocs + chemin 90 s. Prix sourcés (seed + feed Firecrawl). Le LLM ne touche jamais le calcul.

**Tech Stack :** Next.js 15 (App Router), React 19, TS strict, Tailwind v3, Vitest, Playwright, Supabase (RLS), Firecrawl.

**Spec de référence :** `docs/superpowers/specs/2026-05-26-refonte-simulateur-strate-design.md` (types complets §4, dimensionnement §5).

---

## Structure de fichiers (décomposition)

| Fichier | Responsabilité | Statut |
|---|---|---|
| `lib/engine/types.ts` | `Profile` (étendu), `MediaNeed`, `Sizing`, `WorkloadLine`, `Recommendation` (étendu), `Verdict` | modifier |
| `lib/engine/sizing.ts` | besoins → ressources (GPU mutualisé, stockage, embeddings, setup) | **créer** |
| `lib/engine/recommend.ts` | orchestration : appelle `sizing`, injecte coûts dans les couches, calcule `verdict`, `setupCost` | modifier |
| `lib/engine/layers.ts` · `cost.ts` | C4/C5/C6 dimensionnés par `Sizing` ; `costBand` réutilisé | modifier |
| `lib/engine/scores.ts` | `audit`/`bitemporal` booléens ; score `mm` selon `mediaNeeds` | modifier |
| `lib/engine/modules.ts` | libellés clairs (usages costables) | modifier |
| `lib/pricing/` (médias) | seed sourcé (URL+date+confiance) + feed Firecrawl, repli seed | **créer/étendre** |
| `lib/quick/profile-mappers.ts` | réponses qualitatives 90 s → `Profile` | **créer** |
| `hooks/useWizardProfile.ts` · `lib/wizard/defaultProfile.ts` · `options.ts` | nouveaux champs + libellés | modifier |
| `components/wizard/Wizard.tsx` | 6 étapes → 4 blocs | modifier |
| `components/wizard/{MediaNeedsBlock,BudgetMeter,InfoBubble,ContinuousSlider}.tsx` | bloc ④, budget-mètre, infobulle, slider continu | **créer** |
| `components/quick-profile/QuickProfileForm.tsx` | formulaire 90 s | **créer** |
| `components/results/{ResultsView,CostMap}.tsx` | mode verdict + décomposition multimodale dans les couches + setup | modifier |
| `app/page.tsx` | entrée 90 s par défaut | modifier |
| `supabase/migrations/*` | log des simulations + capture e-mail (RLS) | **créer** |
| `e2e/*.spec.ts` | 3 parcours critiques | créer/modifier |

---

## Stories (détail ; acceptance dans `.ralph/prd.json`)

### S-015 — Migration des types (moteur pur, fondation)
**Deps :** — · **Files :** `lib/engine/types.ts`, `scores.ts`, `lib/wizard/defaultProfile.ts`, `lib/engine/__tests__/types.test.ts`
- [ ] Test : un `Profile` avec `audit:true`/`bitemporal:false` (booléens) compile et `scores` les lit ; un `Profile` avec `mediaNeeds: []` et `freeNotes: {}` est valide.
- [ ] Impl : ajouter `MediaNeed`, `Sizing`, `WorkloadLine`, `Verdict` (cf. spec §4.2-4.4) ; passer `audit`/`bitemporal` en `boolean` ; ajouter `mediaNeeds?`, `freeNotes?` au `Profile` ; étendre `Recommendation` (`sizing`, `setupCost`, `costSources`, `verdict`). Supprimer `Requirement` si inutilisé.
- [ ] Adapter `scores.ts` (tests `=== "required"` → booléen) et `defaultProfile.ts`.
- [ ] `npm run typecheck && npm test` verts. Commit `[S-015] Migration des types Strate`.
**DÉFCON 1 :** aucun prix ici (types seulement).

### S-016 — Module `sizing.ts` (cœur du dimensionnement)
**Deps :** S-015 · **Files :** `lib/engine/sizing.ts`, `lib/engine/__tests__/sizing.test.ts`
- [ ] Tests table-driven (cf. spec §5.6) : modalités × {ingest, generate} × {api, sovereign} × paliers. **Cas critiques :**
  - **GPU compté une seule fois** : un profil avec embeddings souverains (C4) + transcription souveraine + génération vidéo souveraine → `sizing.gpu` est **un seul** poste, dimensionné sur la charge **totale**, jamais la somme de 3 GPU.
  - **Mode `api`** : la charge correspondante ne consomme pas le GPU souverain (coût à l'usage porté ailleurs).
  - **Monotonie** : intensive ≥ medium ≥ light.
  - **`mediaNeeds = []`** → `sizing` neutre (gpu tier minimal, storageGb de base).
  - **Génération > mémorisation** sur la charge GPU (volet « créer » pèse plus lourd).
  - Stockage croissant avec le volume ; chaque coût porte une `PriceSource`.
- [ ] Impl : `costMultimodalSizing(profile, prices) → Sizing` pure, déterministe, sans UI. Prix **injectés** (testabilité). `costBand` réutilisé.
- [ ] Commit `[S-016] sizing.ts — GPU mutualisé + stockage indexé + setup`.
**DÉFCON 1 :** prix **injectés** via `prices` (fixtures de test) ; aucune valeur réelle codée en dur ici (elles viennent de S-017).

### S-017 — Sourcing & pricing médias (seed + feed)
**Deps :** S-015 · **Files :** `lib/pricing/media-seed.ts`, `lib/pricing/media-feed.ts`, tests
- [ ] **Sourcing (recherche web réelle, AVANT le code)** : relever les tarifs (transcription, OCR, embeddings multimodaux, GPU souverain €/mois, génération) chez les fournisseurs listés au spec §5.5 — pour chacun : **URL + date + pastille de confiance**. Consigner dans `docs/pricing/media-wtp-sources.md`.
- [ ] Test : `getMediaPrices()` renvoie une `MultimodalPriceTable` ; chaque entrée a `{ url, date, confidence }` ; repli sur seed si feed indispo.
- [ ] Impl : seed sourcé (±30 %) + intégration au feed Firecrawl existant (`lib/pricing/`), repli seed. Source incertaine → `confidence: "low"` + libellé « estimation, à confirmer par devis ».
- [ ] Commit `[S-017] Pricing médias sourcé (seed + feed)`.
**DÉFCON 1 :** **bloquant** — pas de prix non sourcé. Toute valeur a URL + date + confiance.

### S-018 — Intégration sizing → couches dans `recommend`
**Deps :** S-016, S-017 · **Files :** `lib/engine/recommend.ts`, `layers.ts`, `cost.ts`, tests
- [ ] Tests : `recommend(profile)` avec `mediaNeeds` → coûts apparaissent **dans** C4/C5/C6 (pas en ligne séparée) ; `setupCost` reflète le backlog initial ; `verdict` rempli (risque/gain/prix ferme `[PLACEHOLDER]`/coût ±30 %/setup) ; `totalCost = baseCost + moduleCost + (couches dimensionnées)`.
- [ ] Impl : `recommend` appelle `sizing`, dimensionne C4/C5/C6 via `Sizing`, calcule `setupCost` et `verdict`. CostMap reçoit la décomposition (workloads → couches).
- [ ] Commit `[S-018] Intégration sizing dans recommend/layers/cost`.

### S-019 — Wizard 4 blocs + primitives
**Deps :** S-015, S-002 · **Files :** `components/wizard/Wizard.tsx`, `InfoBubble.tsx`, `ContinuousSlider.tsx`, `hooks/useWizardProfile.ts`, `lib/wizard/options.ts`
- [ ] Restructurer en 4 blocs (spec §6) ; `InfoBubble` (pourquoi + conséquence) ; `ContinuousSlider` (volume/débit) ; binaires Oui/Non (audit/bitemporal) ; note libre par bloc (`freeNotes`). Usages costables renommés (spec §9).
- [ ] Hydration localStorage testée (profil chargé hors composant) ; round-trip.
- [ ] Commit `[S-019] Wizard 4 blocs + infobulles + sliders continus`.

### S-020 — Bloc ④ Médias + budget-mètre
**Deps :** S-016, S-019 · **Files :** `components/wizard/MediaNeedsBlock.tsx`, `BudgetMeter.tsx`
- [ ] `MediaNeedsBlock` : par modalité (audio/vidéo/images) — « **mémoriser ?** » (palier/volume) **et** « **créer/générer ?** » (palier/volume) + toggle 🟢 souverain / 💳 API + champ backlog initial. Live preview du dimensionnement (« ~X €/mois d'infra, dont GPU »).
- [ ] `BudgetMeter` flottant vert/jaune/rouge ; dépassement → cause dominante (souvent GPU de génération) + levier.
- [ ] Commit `[S-020] Bloc Médias (mémoriser + créer) + budget-mètre`.

### S-021 — Chemin 90 s + mode verdict
**Deps :** S-018, S-019 · **Files :** `lib/quick/profile-mappers.ts`, `components/quick-profile/QuickProfileForm.tsx`, `app/page.tsx`, tests mappers
- [ ] Tests : chaque réponse qualitative → `Profile` attendu (défauts documentés). 
- [ ] Impl : formulaire 3-4 questions → `Profile` → `/resultats` en mode verdict ; entrée 90 s par défaut sur l'accueil ; lien « Affiner » → `/configurateur` pré-rempli (source de vérité `useWizardProfile`).
- [ ] Commit `[S-021] Chemin 90 s + mappers + mode verdict`.

### S-022 — Résultats : CostMap étendu + verdict/expert
**Deps :** S-018, S-021 · **Files :** `components/results/ResultsView.tsx`, `CostMap.tsx`
- [ ] Mode verdict (douleur/risque/gain/prix ferme/coût ±30 %/setup/next step) et mode expert (stack, radar, CostMap décomposant l'apport multimodal **dans** les couches + ligne setup, pastilles 🟢/💳, sources cliquables, disclaimer devis).
- [ ] Commit `[S-022] Résultats verdict + CostMap multimodal`.

### S-023 — Conversion/data (moat)
**Deps :** S-012, S-018 · **Files :** `supabase/migrations/*`, route API log, composant capture e-mail
- [ ] Migration : tables `simulation_log` + `lead_capture` avec **RLS** (cf. patterns S-012). Log des simulations (moat data) ; capture e-mail exit-intent ; rapport partageable (lien).
- [ ] Tests RLS (un tenant ne lit pas les données d'un autre).
- [ ] Commit `[S-023] Conversion/data — log simulations + capture e-mail (RLS)`.

### S-024 — E2E + nettoyage
**Deps :** S-020, S-021, S-022, S-023 · **Files :** `e2e/*.spec.ts`
- [ ] 3 parcours (spec §13) : (a) 90 s → verdict ; (b) wizard 4 blocs → expert ; (c) bloc ④ génération vidéo souveraine → budget rouge + levier. Round-trip `/configurateur` ↔ `/resultats`. Desktop + mobile.
- [ ] Supprimer le code mort du wizard 6-steps ; `Requirement` si inutilisé. typecheck 0 / lint 0/0 / build OK.
- [ ] Commit `[S-024] E2E parcours Strate + nettoyage code mort`.

---

## Self-review

- **Couverture spec** : §4 → S-015 ; §5 (sizing/GPU/stockage/setup) → S-016+S-018 ; §5.5 (prix sourcés) → S-017 ; §6 (4 blocs) → S-019 ; §6 bloc ④ + §8 budget-mètre → S-020 ; §7 (90 s) + §10 verdict → S-021 ; §10 expert/CostMap → S-022 ; §12 conversion/data → S-023 ; §13 tests → S-024 ; §9 usages → S-019. **Hors-scope** (§15 : offre commerciale, homepage, prix de vente, renommage code) : non planifié ici, conforme.
- **Cohérence types** : `Sizing`/`MediaNeed`/`Verdict` définis en S-015, consommés en S-016/S-018/S-020/S-022 — noms alignés sur spec §4.
- **Placeholders** : seul `[PLACEHOLDER]` = prix de vente (intentionnel, §11) ; prix médias = sourcés en S-017 (jamais inventés).

## Hand-off d'exécution

Voir la question d'exécution en fin de session (subagent-driven recommandé vs inline).
