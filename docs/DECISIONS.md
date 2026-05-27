# Journal de décisions (ADR) — Mnémo

> Registre des arbitrages d'architecture pris en autonomie pendant le Ralph Loop.
> **Protocole** (consigne Amine, 2026-05-25) : en run autonome, à chaque décision à
> trancher, choisir l'option **la plus exhaustive / complète**, même plus complexe,
> et la consigner ici. Ne jamais s'arrêter pour demander tant que l'intégralité n'est
> pas livrée et testée.

Format : décision · contexte · options · choix · conséquences.

---

## ADR-001 — Clés Supabase locales : nouveau système `sb_publishable` / `sb_secret`

- **Contexte** : la CLI Supabase 2.101 (Docker local) émet le nouveau système de clés
  (`sb_publishable_…`, `sb_secret_…`) au lieu des JWT `anon` / `service_role`. Le
  `.env.example` (S-001) référence les anciens noms.
- **Choix** : `.env.local` mappe `NEXT_PUBLIC_SUPABASE_ANON_KEY` ← publishable (clé
  publique client) et `SUPABASE_SERVICE_ROLE_KEY` ← secret (clé serveur, bypass RLS).
- **Conséquence** : en S-012, mettre à jour `.env.example` + le client `@supabase/ssr`
  pour acter la nouvelle terminologie. Aucune clé sensible (instance locale).

## ADR-002 — Baseline du price feed généré par le code, jamais à la main

- **Contexte** : la détection de variation (F4) compare une empreinte de figures à un
  snapshot de référence. Saisir ce snapshot à la main = risque de divergence vs
  l'extracteur réel + risque DÉFCON 1 (donnée fabriquée).
- **Choix** : `scripts/capture-baseline.mts` produit les empreintes via l'extracteur de
  production (`node --experimental-strip-types`). Pages usage-based (0 figure) →
  `fingerprint: null`, confiance medium, note « à vérifier manuellement ».
- **Conséquence** : reproductible, daté, honnête. Régénérer après évolution de
  l'extracteur ou re-calibration.

## ADR-003 — Export PDF (S-009) : génération de fichier réelle via jsPDF (option exhaustive)

- **Contexte** : F6 exige un livrable exportable MD **et** PDF, sources cliquables,
  disclaimer. Options : (a) `window.print()` + CSS print (pas de fichier généré,
  dépend du dialogue navigateur) ; (b) génération programmatique d'un PDF.
- **Choix (le plus exhaustif)** : modèle de livrable **pur** partagé
  (`lib/export/model.ts`) → rendu Markdown pur (`markdown.ts`) **et** rendu PDF réel
  (`pdf.ts`, jsPDF) avec liens cliquables (`textWithLink`) et pagination automatique.
  jsPDF est agnostique du framework → zéro friction React 19.
- **Conséquence** : 2 fichiers téléchargeables. Le parcours de téléchargement navigateur
  est couvert par l'E2E Playwright (S-013).

## ADR-004 — `npm audit` : 7 advisories modérées dev/build-time acceptées

- **Contexte** : `npm audit` remonte 7 vulnérabilités modérées : `esbuild ≤0.24.2`
  (chaîne vite/vitest, **dev-only**) et `postcss <8.5.10` (chaîne next, **build-time**).
  Toutes pré-existantes depuis S-001 ; **aucune** introduite par jsPDF (vérifié :
  jsPDF n'apparaît pas dans le rapport).
- **Choix** : NE PAS lancer `npm audit fix --force` — il imposerait `vitest@4`
  (breaking) et `next@9.3.3` (downgrade majeur absurde), soit une régression pire que
  le risque. Aucune des deux ne s'exécute dans le bundle runtime livré au client.
- **Conséquence** : risque accepté et tracé. À résorber proprement quand Next/vitest
  publieront des versions corrigées non cassantes (à revoir en S-014, avec la
  migration ESLint CLI). Surveillance : `npm audit` au CI.

## ADR-005 — Exit Escrow (S-010) : bundle complet, ZIP client via fflate, manifeste = ancre de cohérence

- **Contexte** : F7 (moat ①) exige un bundle reproductible téléchargeable + un test
  d'intégration prouvant sa cohérence avec la reco. Choix du périmètre et du zippeur.
- **Choix (le plus exhaustif)** : bundle riche — `manifest.json` (machine), `README`,
  `docker-compose.yml` paramétré, `terraform/` (main + tfvars), `vault/` (squelette de
  secrets, **jamais** de valeur), `runbook.md` (déploiement + backup 3-2-1 + MEL +
  incident), `scripts/re-embed.sh` + `backup.sh`. Génération **pure** (`lib/exit/bundle.ts`)
  → ZIP **côté client** via `fflate` (zéro dépendance transitive, vs jszip). Le test
  d'intégration vérifie `manifest == reco` (couches/coût/preset) + round-trip zip/unzip.
- **Conséquence** : `fflate` ajouté (0 vuln). `new Blob([Uint8Array.from(bytes)])` pour
  un BlobPart valide sans `as`. Import dynamique (hors bundle initial). Le redeploy réel
  end-to-end (docker compose up) sera exercé hors-app ; ici on garantit la cohérence
  descriptive, conformément à l'acceptance.

## ADR-006 — Rails Supabase (S-012) : RLS partout, helpers SECURITY DEFINER, test d'intégration gated

- **Contexte** : F9 exige schéma multi-tenant (`circle` pivot), RLS sur TOUTES les
  tables, consentement opt-in horodaté, schéma de coût réel prêt. Plus : prouver
  l'isolation sans casser un CI sans base.
- **Choix (le plus exhaustif)** : migration SQL avec 5 tables + RLS activée partout +
  policies `to authenticated` (anon = zéro accès) + helpers `is_circle_member` /
  `is_circle_owner` en **SECURITY DEFINER** (cassent la récursion des policies) +
  trigger `handle_new_user` créant un cercle personnel à l'inscription. Clients
  `@supabase/ssr` (browser + serveur cookies, `getUser()` côté serveur). Consentement
  via builder pur horodaté. **Test d'intégration live** (création d'utilisateurs,
  isolation cross-tenant, consentement, anon bloqué) **gated** par `SUPABASE_TEST_*` :
  exécuté en local, **skip** automatique en CI sans base (reste vert).
- **Conséquence** : clés secrètes serveur uniquement (jamais le bundle client). L'UI
  d'auth (pages login) n'est PAS dans l'acceptance F9 → reportée au Lot 2 ; les rails et
  la couche d'accès typée sont prêts. CI à venir (S-013) : option de provisionner
  Supabase pour activer le test d'intégration.

## ADR-007 — E2E Playwright (S-013) : serveur de prod, 2 projets, CI à 2 jobs

- **Contexte** : F-tests exige le parcours wizard → résultats → livrable → export, en
  responsive, avec CI prête.
- **Choix (le plus exhaustif)** : Playwright, `webServer` = `npm run build && npm run
  start` (prod, fidèle), 2 projets `desktop-chromium` + `mobile-chrome`. Spec couvrant
  le parcours complet + les 3 exports (MD/PDF/zip via `waitForEvent('download')`) +
  la charte. CI GitHub Actions à 2 jobs : `quality` (typecheck/lint/test/build +
  `npm audit --audit-level=high`) et `e2e` (playwright + artefact rapport).
- **Conséquence / piège** : `reuseExistingServer: !CI` réutilise un serveur déjà sur
  le port 3000 — un `next start` résiduel d'une version antérieure provoque des 404
  trompeurs. **Toujours libérer le port 3000 avant un run local.** Téléchargements
  mobiles non testés (`test.skip` sur projet mobile) : vérifiés sur desktop.

## ADR-008 — Migration `next lint` → ESLint CLI flat config (S-014, dette résorbée)

- **Contexte** : `next lint` est déprécié (retrait Next 16). Migrer sans changer le
  comportement ni introduire de nouvelles erreurs.
- **Choix (le plus exhaustif et pérenne)** : ESLint **9** + flat config
  (`eslint.config.mjs` via `@eslint/eslintrc` `FlatCompat`) extension **stricte** de
  `next/core-web-vitals` (ruleset identique → 0 régression). Script `lint` → `eslint .`.
  `.eslintrc.json` supprimé. `next.config.mjs` : `eslint.ignoreDuringBuilds: true` (le
  lint est explicite via la CLI + CI, pas pendant `next build`).
- **Conséquence** : ESLint 9 lint désormais aussi les fichiers de config racine →
  2 warnings `no-anonymous-default-export` (eslint.config.mjs, postcss.config.mjs)
  corrigés par export nommé. eslint-config-next 15.1 accepte ESLint 9 (pas d'ERESOLVE).
  Lint final : 0 erreur, 0 warning.

## ADR-009 — `audit`/`bitemporal` : `Requirement` (3 états) → `boolean` (S-015, refonte Strate)

- **Contexte** : la refonte Strate (décision 4, « fin du souhaité ») impose des binaires Oui/Non
  dans le wizard. `Profile.audit` et `Profile.bitemporal` étaient des `Requirement` à 3 états
  (`no` / `desired` / `required`).
- **Choix** : migration vers `boolean`, mapping `required → true`, **`desired → false`**, `no → false`.
  L'état « souhaité » disparaît : assimilé à « Non » (pas un besoin ferme). Conséquence **assumée**
  sur le scoring : l'ancien palier intermédiaire de `scores.ts` (auditabilité ≈ 8 si `bitemporal`
  « desired ») n'existe plus → un profil ex-« desired » obtient le score de base (5) sur la dimension
  `audit`. Type `Requirement` supprimé. UI : composant `YesNo` (binaire) remplace
  `RadioCards` + `REQUIREMENT_OPTIONS`.
- **Conséquence / pièges** : (a) profils-types ex-« souhaité » (Coach, PME, Chercheur) remis à `false`
  et **descriptions reformulées** pour ne plus mentir (DÉFCON 1). (b) clé localStorage `mnemo:profile:v1`
  → `v2` pour invalider les profils sérialisés en chaînes (`"required"` truthy ≠ `true`) et éviter une
  hydratation corrompue. (c) types `MediaNeed`/`Sizing`/`WorkloadLine`/`Verdict`/`GpuTier`/`BlockId`
  définis ici (consommés S-016/S-018) ; `GpuTier` provisoire → granularité à valider en S-016 avant tout
  consommateur en aval. (d) à décider en S-018 : `p.audit` devrait-il contribuer à la dimension `audit`
  (aujourd'hui pilotée uniquement par `bitemporal`).

## ADR-010 — Dimensionnement multimédia (S-016) : GPU mutualisé compté une fois, prix injectés, `WorkloadLine.monthlyCost`

- **Contexte** : S-016 implémente `lib/engine/sizing.ts` (`costMultimodalSizing(profile, prices) →
  Sizing`, spec §5). Trois arbitrages à trancher : (1) granularité du `GpuTier` (laissée provisoire
  en S-015, ADR-009) ; (2) où porter le coût **à l'usage** du mode `api` (§5.1 : « porté par la
  couche concernée », imputé en S-018) sans dupliquer la dérivation des quantités ni parser la
  chaîne `estimate` ; (3) comment garantir l'anti double-comptage GPU C4/C6.
- **Choix (le plus exhaustif, zéro dette)** :
  - **GPU compté UNE SEULE FOIS** : toutes les charges `sovereign` (ingest + generate, toutes
    modalités) alimentent **une** charge cumulée → **un seul** palier `Sizing.gpu` (prix du palier,
    pas la somme de N pools). Le mode `api` n'alimente **pas** ce GPU.
  - **`GpuTier` validé à 4 paliers** (`none`/`shared`/`dedicated-small`/`dedicated-large`) — suffisant
    pour le conseil ±30 %. Granularité figée (commentaire de type mis à jour).
  - **Extension additive de la spec §4.3** : `WorkloadLine` gagne `monthlyCost: number` (récurrent
    €/mois de la ligne) — **0** pour `sovereign` (absorbé par le pool GPU unique), **> 0** pour `api`
    (coût à l'usage). Évite, en S-018, soit le parsing de la chaîne `estimate` (fragile, anti-DÉFCON 1),
    soit la **duplication** de la logique de quantités → **une seule source de vérité** (`sizing.ts`),
    et alimente la décomposition CostMap (S-022).
  - **Prix INJECTÉS** : contrat `MultimodalPriceTable` / `MultimodalPriceEntry` (`{amount, unit,
    confidence, source}`) défini par le moteur (le consommateur) ; **implémenté et sourcé en S-017**
    (`getMediaPrices()`). Aucune valeur monétaire codée en dur dans `sizing.ts` (DÉFCON 1).
  - **Facteurs de modélisation** (`TIER_QUANTITY`, `STORAGE_GB_PER_UNIT`, `GPU_LOAD_PER_UNIT`, seuils)
    = **hypothèses de dimensionnement ±30 %**, au même rang que `VOLUME_FACTOR`/`REQ_FACTOR` de
    `cost.ts` — explicitement **pas** des prix, documentées comme « à raffiner ».
- **Conséquence** : `setupCost` (one-time, §5.4) reste S-018 (dépend du champ « backlog initial »
  ajouté au bloc ④, S-020) — hors scope S-016. `import type { Confidence }` depuis
  `@/components/ui/StatusDot` (type-only, erasé au build — aucune dépendance UI runtime, précédent
  `lib/pricing/sources`). Tests table-driven (27) : monotonie, anti double-comptage GPU, `api` hors
  GPU souverain, générer > mémoriser, stockage croissant, neutre sur vide, source présente sur chaque
  prix. **À reporter dans la spec §4.3** : `WorkloadLine.monthlyCost`.

## ADR-011 — Pricing médias (S-017) : devises natives + étage FX sourcé, seed = source de vérité

- **Contexte** : S-017 fournit `getMediaPrices()` (table `MultimodalPriceTable` consommée par
  `sizing.ts`), DÉFCON 1 **bloquant** : aucun prix non sourcé. Sourcing web réel effectué
  (transcription, OCR/vision, embeddings multimodaux, GPU souverain, génération image/vidéo) →
  `docs/pricing/media-cost-sources.md` (figure exacte + unité + URL + date + confiance par fournisseur).
- **Question soulevée par Amine en cours de route** : ne pas figer des montants déjà convertis en €
  (perte de fidélité + taux baké) ; stocker les prix dans leur **devise native** et utiliser une
  **solution de taux de change**.
- **Choix (retenu, plus rigoureux)** :
  - **Devise native dans le seed** : `MultimodalPriceEntry` gagne `currency: "EUR" | "USD"` ; le seed
    stocke le montant **réellement publié** (Scaleway €, OpenAI/Google/Runway $) — zéro conversion
    figée (fidélité DÉFCON 1, et affichage natif+converti possible en UI S-022). `unit` devient le
    **dénominateur** seul (`min`/`image`/`Go·mois`/`mois`), le numérateur = `currency`.
  - **Étage FX dédié** (`media-feed.ts › normalizeMediaPricesToEur`) : conversion en € au **runtime**,
    taux **live** via **Frankfurter** (adossé BCE, gratuit, sans clé), **repli** sur le taux BCE daté
    seedé (`SEED_USD_TO_EUR = 0,85955 = 1/1,1634`, BCE 2026-05-26). `fetchUsdToEur` ne lève jamais
    (repli systématique) ; le moteur consomme `getMediaPricesEur(rate)` (devise unique, précondition
    de `costMultimodalSizing`).
  - **Conversions d'unité** (par caractère/image → par minute pour TTS/analyse vidéo) **bakées dans le
    seed** avec confiance dégradée + note « estimation, à confirmer par devis » (hypothèses d'usage,
    distinctes de la conversion de devise).
  - **Feed Firecrawl** : `refreshMediaPriceFreshness` réutilise le client `scrapePricingMarkdown`
    existant pour signaler la **fraîcheur/disponibilité** des pages source (verified/unavailable,
    repli seed) — il ne **réécrit jamais** un prix dérivé (revue manuelle).
- **Conséquence** : amendement **additif** du contrat S-016 (`MultimodalPriceEntry.currency`) — fixture
  S-016 mise à jour (table de test = € pré-normalisée), tout reste vert. Confiances honnêtes : `high`
  (Scaleway € publié, stockage), `medium` (conversion de devise d'un prix exact), `low` (forfait
  embeddings + dérivations d'unité). **NON TROUVÉ** assumé (Pika, Kling, Cohere Embed unitaire,
  DALL·E 3 retiré) — non inventés. À re-sourcer périodiquement (pages + taux BCE).
- **Revue Amine (2026-05-26)** : référent embeddings multimodaux Voyage (forfait 30 €/mois, low) →
  **Qwen3-VL-Embedding** (open Apache 2.0, **#1 MMEB-V2 77,8**, self-host) — [arXiv 2601.04720] / HF.
  Conséquence : pour une base **souveraine**, l'embedding tourne sur le **GPU déjà compté (C6)** →
  forfait C4 = **0 €** (corrige aussi un double-comptage latent). Alternatives API documentées (Jina v4
  ~0,05 $/1M tokens, Cohere Embed v4, Gemini Embedding 2). Voyage relégué en repère.

## ADR-012 — Intégration sizing → couches dans `recommend` (S-018) : prix injectés, setupCost backlog, GPU une fois

- **Contexte** : S-018 branche `sizing.ts` dans `recommend()` — coûts multimédias **dans** C4/C5/C6
  (jamais en ligne séparée, spec §5), `setupCost` (one-time), `verdict`, `costSources`. Trois
  arbitrages.
- **Choix** :
  - **Prix INJECTÉS, défaut neutre** : `recommend(profile, prices = NEUTRAL_MEDIA_PRICES)`. Le moteur
    reste **pur** (zéro import `lib/pricing`) ; les appelants réels injectent `getMediaPricesEur()`.
    Conséquence : `recommend(profile)` (tests existants, ensemble) garde un coût multimédia **nul** →
    invariant `totalCost = baseCost + moduleCost` préservé, **aucune régression** (les profils sans
    `mediaNeeds` donnent un sizing neutre). Le câblage UI (injection des vrais prix dans `ResultsView`)
    est **S-022**. Footgun documenté (défaut neutre = 0 si on oublie d'injecter).
  - **setupCost via champ backlog avancé en S-018** (décision Amine) : `MediaNeed.backlog?` (corpus
    existant, unité native) ajouté **maintenant** ; `computeSetupCost` chiffre l'ingestion one-time au
    tarif `api.<modality>.ingest` (borne haute conservatrice, quel que soit le mode souverain/api —
    une passe de backlog se sous-traite souvent en batch). La **saisie UI** du backlog reste S-020 ;
    la donnée + le calcul sont prêts dès S-018 → acceptance « setupCost reflète le backlog initial »
    satisfaite sans placeholder.
  - **GPU compté UNE FOIS dans C6** : `applyMultimodalSizing` impute le pool GPU souverain +
    l'usage API à **C6** seulement ; C4 ne reçoit que le forfait embeddings, C5 que le stockage —
    test dédié (`recommend-sizing`) vérifie que C4 ne ré-impute pas le GPU.
- **Conséquence** : `Recommendation` étendu (`sizing`/`setupCost`/`costSources`/`verdict`) — les
  consommateurs (UI, export, ensemble) **lisent** seulement → typecheck 0 sans modif. `buildEnsemble`
  threade `prices` (optionnel, défaut neutre). `costSources` = sources des prix réellement mobilisés
  (dédupliquées) ; vide en neutre. `verdict.firmPriceTier = [PLACEHOLDER]` centralisé (spec §11), gain
  formulé « prouvé » seulement pour −risques (Exit Escrow + Fiduciary), jamais de stat inventée.
  **Décision ADR-009 (d) tranchée** : la dimension `mm` (scores) reste pilotée par `contentTypes` ;
  son raffinement par `mediaNeeds` n'est PAS requis par l'acceptance S-018 → laissé tel quel (pas de
  scope creep), à revoir si besoin avec le bloc Médias (S-020).

## ADR-013 — Conversion & data (S-023) : simulations anonymes loggables, rapport par jeton, leads PII-restreints

- **Contexte** : S-023 = log des simulations (moat data) + capture e-mail exit-intent + rapport
  partageable, RLS partout, test cross-tenant. Réutilise les patterns S-012 (ADR-006 : helpers
  SECURITY DEFINER, test gated).
- **Choix** :
  - **`simulation_log`** : insert ouvert `anon` + `authenticated` (le configurateur est **public** → la
    plupart des simulations sont ANONYMES, `circle_id` null) ; select direct réservé aux membres du
    cercle. Le **rapport partageable** passe par une RPC **SECURITY DEFINER** `get_simulation_by_token`
    (lecture par jeton, sans exposer la table en masse).
  - **`lead_capture`** : e-mail = **PII** → insert ouvert (capture), select réservé au **propriétaire**
    du cercle ; les leads anonymes ne sont lisibles que par le service role. Collecte minimale
    (e-mail + contexte), opt-in côté UI (RGPD/CNDP).
  - **Builders PURS** (`lib/conversion/log.ts`) — payloads testés unitairement ; l'insertion (et le
    respect RLS) est à l'appelant.
  - **Routes HTTP + composant capture exit-intent : DÉFÉRÉS à S-024** (e2e) — le mécanisme (tables +
    RLS + RPC + builders) est complet et **prouvé** ici ; éviter du wiring non testé en isolation.
- **Conséquence / preuve** : **RLS VÉRIFIÉE LIVE (8/8** : isolation simulations + leads cross-tenant,
  rapport par jeton anonyme, anon bloqué en masse) contre la stack Supabase locale. **Learning env** :
  `supabase db reset` peut laisser `auth.uid()` non résolu pour les requêtes authentifiées (casse même
  les tests RLS pré-existants) → **restaurer via `supabase stop && supabase start`** (rebuild propre)
  avant toute vérification RLS live.

## ADR-014 — Wizard 4 blocs (S-019) : infobulles neutres, sliders continus, notes libres, usages renommés

- **Contexte** : configurateur refondu de 6 étapes → 4 blocs (spec §6) + `InfoBubble`, `ContinuousSlider`,
  note libre par bloc, usages costables renommés (§9), a11y `YesNo`.
- **Choix** :
  - **4 blocs** (Profil & contraintes / Infra pure / Usage-Mémoire / Médias). Le bloc ④ **Médias est
    STRUCTUREL ici** (intro + note) ; son contenu détaillé (`MediaNeedsBlock` + budget-mètre) = S-020.
  - **`InfoBubble`** : disclosure accessible (`aria-expanded` + région reliée) présentant une info
    **FACTUELLE et NON ORIENTÉE** (« pourquoi + conséquence ») — jamais une reco (cf. principe « avis
    critique non orienté », retour Amine). Contenu dans une table `INFO` côté Wizard.
  - **`ContinuousSlider`** : `input range` glissant sur des paliers discrets ordonnés (volume, débit),
    `aria-valuetext` = palier courant.
  - **`freeNotes`** : `Profile.freeNotes` (typé S-015) + `setNote(block)` au hook ; `DEFAULT_PROFILE.freeNotes={}` ;
    **additif** (pas de bump de version localStorage — merge sûr).
  - **Usages renommés** (`modules.ts` `name`) : Traçage des revirements / Mémoire infalsifiable /
    Décisions horodatées / Plan de panne / Détecteur de conflits (structure `Profile.modules` inchangée).
  - **`YesNo`** : `role="group"` + `aria-label` (dette a11y S-015 levée) ; `aria-pressed` conservé.
- **Conséquence** : aperçu live (preset + coût) factuel en en-tête (budget-mètre détaillé = S-020).
  e2e parcours mis à jour (3 « Suivant » au lieu de 5) — **vérifié LIVE 3/3 (desktop)**. Hydratation
  localStorage **round-trip testée** (renderHook, profil chargé hors composant). typecheck 0, lint 0/0,
  tests 137 + 8 skip, build OK.

## ADR-015 — Bloc Médias + budget-mètre (S-020)

- **`MediaNeedsBlock`** : par modalité (audio/vidéo/images), volet **mémoriser** + volet **créer**
  (paliers `MMTier` via `ContinuousSlider`), toggle **🟢 souverain / 💳 API**, **backlog initial**
  (→ `setupCost`). **Aperçu live** du dimensionnement : `costMultimodalSizing` + `computeSetupCost`
  (prix € **injectés**, défaut `getMediaPricesEur()`) → « ces besoins ajoutent ≈ X €/mois d'infra,
  dont GPU… » + stockage + mise en route + disclaimer ±30 %.
- **`BudgetMeter`** : logique **pure** `evaluateBudget` (`lib/wizard/budget.ts`) — vert (≤ 80 % du
  plafond) / jaune (≤ 100 %) / rouge (> 100 %) ; en tension : **cause dominante** (GPU de génération /
  API médias / stack de base) + **un levier** concret. **Jamais** le prix de vente (spec §8). Visible
  (sticky) dans le wizard.
- **Wizard** : prix réels **injectés** (`getMediaPricesEur()`) → l'en-tête (coût) et le budget-mètre
  reflètent désormais le dimensionnement multimédia.
- **Conséquence** : tests = budget 7 (statuts + cause/levier) + media-block 6 (aperçu live, propagation
  `mediaNeeds`, budget-mètre rouge). typecheck 0, lint 0/0, **150 + 8 skip**, build OK
  (/configurateur 8,23 kB). Cause/levier restent **neutres** (présentent un fait + une option, cf. principe avis non orienté).

## ADR-016 — Chemin 90 s (S-021) : mappers purs, entrée d'accueil, source de vérité unique

- **`lib/quick/profile-mappers.ts`** : 4 réponses qualitatives (`who`/`data`/`priority`/`media`) →
  `Profile` complet par **défauts documentés et prudents** (jamais sous-dimensionné sur conformité/
  sécurité : régulé/secret ⇒ audit+bitemporel ; RGPD par défaut). Pur, déterministe, testé (8).
- **`QuickProfileForm`** (`components/quick-profile/`) : 4 questions (RadioCards), écrit le `Profile`
  mappé dans la **même source de vérité** que le wizard (`localStorage`, `STORAGE_KEY`) puis navigue
  vers `/resultats?mode=verdict`. « Affiner » → `/configurateur` (pré-rempli). Écriture localStorage
  **synchrone** avant navigation (évite la course avec l'effet de persistance du hook).
- **`app/page.tsx`** : l'accueil devient le **chemin 90 s par défaut** (hero + formulaire). Nom
  « Mnémo » conservé (le renommage Strate est une story dédiée, spec §15).
- **Conséquence** : le **mode verdict** de `/resultats` (rendu réel) est S-022 ; ici on établit le
  chemin + le paramètre `?mode=verdict`. Tests : mappers 8 + form 3 (persistance + navigation,
  `useRouter` mocké via `vi.hoisted`). Vérifié au **navigateur** (accueil 90 s). typecheck 0, lint
  0/0, **161 + 8 skip**, build OK. Script générique `scripts/shoot-page.mjs` ajouté.

## ADR-017 — Résultats : mode verdict + CostMap étendu (S-022)

- **`ResultsView`** injecte `getMediaPricesEur()` dans `recommend`/`buildEnsemble` → les coûts
  multimodaux apparaissent **dans** C4/C5/C6 (câblage UI de S-018). **Mode `verdict` | `expert`** lu
  depuis `?mode=verdict` via `window.location` (pas `useSearchParams` → `/resultats` reste **statique**,
  pas de Suspense forcé) ; toggle bidirectionnel (« Vue verdict » / « Voir le détail »).
- **`VerdictView`** : synthèse **neutre** (besoin / risque / gain mesuré · prix ferme `[PLACEHOLDER]` ·
  coût infra ±30 % · mise en route · prochaine étape) + bascule expert + « Affiner ».
- **`CostMap` étendu** : ligne « Mise en route (une fois) » (`setupCost` + bande) + section **« Apport
  multimédia (déjà compris dans les couches) »** — 🟢 pool GPU (compté 1×) / embeddings / stockage ·
  💳 charges API, + disclaimer « coûts variables, devis avant go ».
- **Conséquence** : vérifié au **navigateur** (vue verdict). Tests : ResultsView verdict/expert +
  VerdictView. typecheck 0, lint 0/0, **163 + 8 skip**, build OK (`/resultats` statique). Reste **S-024**
  (e2e + nettoyage) pour clore la refonte.

## ADR-018 — E2E parcours Strate + nettoyage (S-024, refonte close)

- **`e2e/strate.spec.ts`** : 3 parcours critiques — (a) chemin 90 s → verdict ; (b) bloc Médias
  génération vidéo souveraine → **budget rouge + levier** ; (c) round-trip /configurateur → /resultats
  (la génération souveraine se retrouve dans les coûts). **Desktop + mobile**, 11/11 (+1 skip
  mobile-export). Slider réglé via `focus()` + `press("End")` (déclenche l'onChange React natif).
  Le parcours « wizard 4 blocs → expert » reste couvert par `parcours.spec.ts`.
- **Nettoyage** : aucun code mort — le wizard a été réécrit **en place** (zéro fichier 6-steps
  orphelin), `Requirement` supprimé dès S-015 (ne subsiste qu'en commentaires historiques), usages
  costables renommés. Tous les composants wizard restent utilisés.
- **REFONTE STRATE COMPLÈTE (S-015 → S-024, 10/10).** typecheck 0, lint 0/0, **163 + 8 skip**,
  build OK, **e2e 11 + 1 skip**. Restent hors-refonte : déploiement de la refonte en prod, backlog
  use-cases (S-025+), renommage code Mnémo→Strate, sondage → prix de vente → homepage.
