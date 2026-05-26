# Spec de design — Strate (refonte du simulateur)

- **Date** : 2026-05-26
- **Statut** : en revue (HARD GATE — validation d'Amine requise avant tout code, puis `writing-plans`)
- **Produit** : **Strate** (ex-« Mnémo »). Nom acté le 2026-05-26 (une *strate* = mémoire sédimentée qui se conserve **+** une *couche* d'infra ; designer l'infra = empiler les bonnes strates).
- **Sources de décision** : `PASSATION.md` (12 décisions verrouillées + angles morts du conseil), brainstorming 2026-05-26 (recadrages produit + 5 partis-pris + clarifications), cartographie du code existant.

---

## 1. Nature exacte du produit (cadre)

**Strate est une plateforme qui DESIGNE des infrastructures de base mémorielle IA souveraine selon les besoins et contraintes de l'utilisateur, et en chiffre le coût. Rien d'autre.**

- **Ce n'est pas** un hébergeur, ni un exécuteur de la base mémorielle, ni un producteur/vendeur de contenu.
- **Entrée** : besoins (quoi mémoriser / quoi faire) + contraintes (budget, conformité, souveraineté, volume, latence, croissance).
- **Sortie** : un **design d'infra** (les couches et composants qui répondent au besoin) + son **coût sourcé** (±30 %) + des diagnostics (scores, incohérences, conformité).

Tout le simulateur obéit à une seule équation : **besoins + contraintes → design d'infra chiffré**. Il n'y a pas de sous-système « spécial » : chaque besoin (y compris multimodal) **dimensionne les couches existantes** (C0→C6).

Le **LLM** (plateforme, LiteLLM `proxy.ai-mpower.com`) sert uniquement à : interpréter l'intake libre/dictée, réécrire les infobulles/cas d'usage selon le profil, narrer le rapport. **Il ne touche jamais au calcul de coût** (déterministe).

---

## 2. Objectif & non-objectifs

**Objectif :** remplacer le wizard actuel (6 étapes, 15 paramètres, jargon « souverain », fourchette ±30 % nue) par :
1. un **chemin 90 s** (entrée par la douleur, zéro jargon) → verdict clair (risque / gain / prix ferme par palier / next step) ; le configurateur complet devient le **mode expert** ;
2. un questionnaire en **4 blocs** lisibles (infobulles « pourquoi + conséquence », sliders continus, binaires Oui/Non, notes libres) ;
3. un **dimensionnement honnête du multimodal** (le chantier neuf) : les besoins audio/vidéo/images **dimensionnent les couches** (embeddings, stockage, GPU), avec un **GPU mutualisé** et un **stockage indexé sur le volume** ;
4. une **carte budget-mètre** flottante (vert → rouge) qui explique les dépassements et propose un levier ;
5. des **usages costables** (ex-« modules avancés ») renommés en clair ;
6. de la **conversion/data** : rapport partageable, capture e-mail exit-intent, log des simulations (moat data).

**Non-objectifs (cette itération) :**
- **Produire / vendre du contenu** (synthèses vidéo, formations) : c'est une **offre commerciale** (palier de monétisation entre la « recette » gratuite et la « cuisine » payante), traitée ailleurs (homepage/offre) — **jamais dans le moteur de costing d'infra**.
- Figer le **prix de vente Strate** : reste `[PLACEHOLDER]` jusqu'aux réponses du sondage Van Westendorp.
- Écran d'administration d'organisation ; choix du LLM par organisation (au niveau plateforme).
- Renommage complet du code/repo (Mnémo → Strate) : story dédiée, pas dans le périmètre fonctionnel de ce spec.

---

## 3. Décisions verrouillées & partis-pris

**Décisions produit** (`PASSATION.md`, considérées acquises) : entrée structurée + expression libre (1) ; chemin 90 s + mode expert (2) ; 4 blocs ① Profil & contraintes · ② Infra pure · ③ Usage-Mémoire · ④ Médias (3) ; pattern d'étape infobulle/sliders/binaires/note libre (4) ; budget-mètre vert→rouge + levier (5) ; honnêteté brutale + étiquettes 🟢/💳 (6) ; modules → usages costables (7) ; multi-tenant RLS, LLM plateforme (8) ; moteur déterministe, LLM hors calcul (9) ; thème clair + sombre (10) ; rapport partageable + capture e-mail + log (12).

**Partis-pris d'architecture (brainstorming 2026-05-26, validés) :**

- **A — Multimodal intégré, pas de sous-moteur parallèle.** Les besoins multimodaux sont des champs d'entrée qui **dimensionnent les couches** C4 (embeddings), C5 (stockage), C6 (GPU/compute). Pas de ligne `multimodalCost` séparée flottant à côté ; les coûts apparaissent dans les couches concernées, avec une **décomposition lisible** dans la CostMap.
- **B — Remplacement net** (pré-lancement, pas d'utilisateurs réels) : pas de feature flag, code mort supprimé, zéro dette.
- **C — Chemin 90 s = entrée principale** ; `/configurateur` = mode expert ; mapping qualitatif → `Profile` via `lib/quick/profile-mappers.ts`.
- **D — Modules → usages costables** : renommage + recatégorisation, structure `Profile.modules` (Record) inchangée, pas de table Supabase dédiée.
- **E — Prix de vente = paramètre `[PLACEHOLDER]`** centralisé ; le spec définit *où* il s'injecte, pas *combien*.

**Clarifications :**
- **Granularité multimodale = hybride** : paliers qualitatifs (léger/moyen/intensif) en mode 90 s ; volumes quantifiés (h audio, min vidéo, nb images) en mode expert.
- **Sources de prix = les deux** : seed sourcé à la main (URL + date + pastille de confiance + ±30 %) comme socle de repli **+** feed Firecrawl quand fiable (même pattern que les 7 couches).
- **Multimodal = deux volets, tous deux dimensionnant l'infra** : **mémoriser/traiter** l'existant (transcription, OCR, embeddings, indexation) **et** **créer/générer** sur l'infra de l'user (génération = GPU/compute bien plus lourd, modèles génératifs à héberger). Strate ne produit/facture aucun contenu : il dimensionne et chiffre l'infra qui supporte ces capacités.

---

## 4. Modèle de données

### 4.1 Changements au type `Profile` (`lib/engine/types.ts`)

| Champ | Avant | Après | Raison |
|---|---|---|---|
| `audit` | `Requirement` (`no`/`desired`/`required`) | `boolean` | Décision 4 : binaire Oui/Non |
| `bitemporal` | `Requirement` | `boolean` | idem |
| `voices` | `Voices` | conservé, relibellé « À qui sert cette mémoire ? » (UI) | Décision 4 (sémantique) |
| `modules` | `Record<ModuleId, number>` | conservé, libellés clairs (UI) | Décision 7 (renommage) |
| `freeNotes` | — | `Partial<Record<BlockId, string>>` | Note libre par bloc |
| `mediaNeeds` | — | `MediaNeed[]` | Bloc ④ (besoins multimodaux, 2 volets) |

> Le passage `audit`/`bitemporal` → `boolean` impacte `scores.ts` (qui teste `=== "required"`) et `defaultProfile.ts`. Le type `Requirement` est supprimé s'il n'est plus utilisé (zéro code mort).

### 4.2 Besoins multimodaux (entrée qui dimensionne les couches)

```typescript
type MMTier   = "none" | "light" | "medium" | "intensive";
type MMMode   = "sovereign" | "api";          // self-host GPU vs service tiers
type Modality = "audio" | "video" | "images";

type MediaNeed = {
  modality: Modality;
  mode: MMMode;                                 // souverain / API, par modalité
  // Volet 1 — MÉMORISER (traiter l'existant)
  ingest: { tier: MMTier; volume?: number };    // volume override le palier (h, min, ou nb/mois)
  // Volet 2 — CRÉER (générer sur l'infra de l'utilisateur)
  generate: { tier: MMTier; volume?: number };  // tier "none" = pas de génération
};
// Profile.mediaNeeds?: MediaNeed[]   (une entrée par modalité activée)
```

### 4.3 Sortie : dimensionnement des ressources → couches

```typescript
type Sizing = {                                 // ressources déduites des besoins
  gpu: { tier: GpuTier; monthlyCost: number };  // UN pool GPU, dimensionné par la charge TOTALE
  storageGb: number;                            // médias mémorisés + générés
  embeddingsMultimodal: boolean;
  workloads: WorkloadLine[];                    // d'où vient la charge (traçabilité)
};
type WorkloadLine = {
  source: "ingest" | "generate";
  modality: Modality;
  mode: MMMode;
  estimate: string;                             // ex. "transcription 100 h/mois"
  contributesTo: ("C4" | "C5" | "C6")[];
};
```

### 4.4 Changements au type `Recommendation`

```typescript
type Recommendation = {
  // … existant (preset, layers, baseCost, moduleCost, scores, …)
  sizing: Sizing;                               // NOUVEAU — dimensionnement déduit
  setupCost: number;                            // NOUVEAU — coût one-time (ingestion initiale)
  costSources: PriceSource[];                   // URL + date + confiance (DÉFCON 1)
  totalCost: number;                            // récurrent €/mois (couches incluant le multimodal)
  verdict: Verdict;                             // NOUVEAU — résumé pour le chemin 90 s
};
type Verdict = {
  pain: string; risk: string; gain: string;     // gain mesurable, jamais inventé
  firmPriceTier: string;                         // prix ferme service Strate ([PLACEHOLDER])
  variableCostBand: { low: number; high: number };// coût infra ±30 %
  setupCostBand: { low: number; high: number };  // mise en route (one-time)
  nextStep: string;
};
```

---

## 5. Dimensionnement des couches par les besoins (le cœur)

Principe : un module pur **`lib/engine/sizing.ts`** traduit les besoins (volume, reqPerDay, `mediaNeeds`) en **ressources** (GPU, stockage, embeddings multimodaux), puis ces ressources **alimentent le coût des couches existantes**. Déterministe, testé, sans dépendance UI, jamais appelé par le LLM.

### 5.1 GPU mutualisé (résout le double-comptage)

Il existe **un seul pool GPU** (porté par C6 « Infra »), dimensionné par la **charge totale** :
```
chargeGPU = Σ ingest(transcription/vision/embeddings) + Σ generate(inférence générative)
gpuTier   = palier couvrant cette charge (avec marge)
coûtGPU   = coût mensuel du palier GPU (souverain) — compté UNE FOIS dans C6
```
En mode `api` (par modalité), la charge correspondante **ne** consomme **pas** le GPU souverain mais un **coût à l'usage** (API tierce) porté par la couche concernée. La **génération** pèse typiquement bien plus lourd que la mémorisation sur le GPU → c'est précisément pourquoi le volet « créer » est interrogé (sinon sous-dimensionnement).

### 5.2 Stockage indexé sur le volume (C5)

`storageGb = f(volume médias mémorisés + générés)` (et non plus un forfait fixe par preset). C5 = coût/Go × `storageGb` + bande passante estimée pour la vidéo. Un usage vidéo lourd fait croître C5 de façon visible et honnête.

### 5.3 Embeddings multimodaux (C4)

Si `mediaNeeds` contient une modalité non-texte → C4 utilise un modèle d'embedding multimodal (coût supérieur, déjà partiellement géré par `hasMultimodal`). Le choix souverain/API par modalité oriente le modèle retenu.

### 5.4 Setup / ingestion initiale (one-time)

`setupCost` = coût ponctuel d'ingestion du **backlog existant** (transcription/OCR/embeddings du corpus déjà là), distinct du récurrent. Affiché en ligne séparée (verdict + CostMap). Dépend du volume initial déclaré (champ d'intake dédié).

### 5.5 Prix & sources (DÉFCON 1)

Aucun chiffre figé dans ce spec. Les tarifs (transcription, OCR, embeddings multimodaux, GPU souverain, génération) seront **sourcés à l'implémentation** (URL + date + pastille de confiance, ±30 %) et seedés dans `lib/pricing/`, avec feed Firecrawl quand la source est exploitable (repli seed sinon). Fournisseurs à investiguer : OpenAI Whisper / AssemblyAI / Deepgram (audio API) ; Whisper large-v3 self-host (souverain) ; Google Vision / AWS Textract / Mistral OCR ; Tesseract self-host ; RunPod / Lambda / Scaleway / OVH (GPU). Toute source incertaine → ligne marquée « estimation, à confirmer par devis », jamais présentée comme certaine.

### 5.6 Tests (obligatoires, table-driven)

`lib/engine/__tests__/sizing.test.ts` : matrice **modalités × {ingest, generate} × {api, sovereign} × paliers**. Vérifie : GPU **compté une seule fois** (pas de double-comptage entre C4/C6), monotonie (intensive ≥ medium ≥ light), stockage croissant avec le volume, `mediaNeeds = []` → sizing neutre, présence de `PriceSource` sur chaque coût.

---

## 6. Les 4 blocs du questionnaire

Pattern commun : titre orienté bénéfice · contrôles avec **infobulle (pourquoi + conséquence)** · **note libre** facultative · budget-mètre flottant visible.

- **① Profil & contraintes** : `activity`, `zone`, `users`, `regulations`, `sensitivity`, `techLevel`, `budget`. Copy orientée **peur/conformité** (CNDP / Cloud Act / RGPD), pas « souverain ».
- **② Infra pure** : `volume` (slider continu), `reqPerDay` (slider « débit »), `latency`, `growth`. Souveraineté = conséquence des contraintes du bloc ①.
- **③ Usage-Mémoire** : « Mémoire interrogeable ? » (binaire) · « **À qui sert cette mémoire ?** » (ex-`voices`) · « Que mémoriser ? » (`contentTypes`) · **usages costables** (ex-modules, opt-in « en faire une base mémorielle », §9).
- **④ Médias** (NOUVEAU) : pour chaque modalité (audio / vidéo / images) — « **Devez-vous la mémoriser ?** » (volume/palier) **et** « **Votre infra doit-elle la créer/générer ?** » (volume/palier) + toggle 🟢 souverain / 💳 API. Plus un champ « **volume de backlog initial** » (→ `setupCost`). Live preview du dimensionnement (« cet usage ajoute ~X €/mois d'infra, dont GPU »). Composant `components/wizard/MediaNeedsBlock.tsx`.

---

## 7. Chemin 90 s

Entrée par défaut. 3-4 questions qualitatives orientées douleur. `lib/quick/profile-mappers.ts` traduit en `Profile` complet par **défauts intelligents documentés**. Résultat → `/resultats` en mode **verdict** (§10). Lien « Affiner » → `/configurateur` pré-rempli. Réutilise `useWizardProfile` comme source de vérité unique. Emplacement exact de la route à finaliser au plan d'implémentation.

## 8. Budget-mètre flottant

`components/wizard/BudgetMeter.tsx` — carte sticky, visible dans le wizard et le verdict. Compare `totalCost` (coût variable infra) au `budget` : vert / jaune / rouge. En dépassement : **explique pourquoi** (couche/charge dominante, souvent le GPU de génération) **+ propose un levier** (« passer cette modalité en API », « réduire le volume », « pas de génération »). Ne touche jamais au prix de vente.

## 9. Usages costables (ex-modules)

Renommage UI + libellés moteur, structure `Profile.modules` inchangée : `bisect` → **Traçage des revirements** · `reversal` → **Mémoire infalsifiable** · `prereg` → **Décisions horodatées** · `mel` → **Plan de panne** · `conflict` → **Détecteur de conflits**. Présentés dans le bloc ③ comme des usages opt-in, pas de l'infra. Coût inchangé (`lib/engine/modules.ts`).

## 10. Page résultats

Deux modes du même `Recommendation` :
- **Verdict (90 s)** : douleur reformulée, risque, gain (mesurable, jamais inventé), **palier de prix ferme** (service Strate, `[PLACEHOLDER]`), **coût variable infra** ±30 %, **mise en route** (one-time), next step. Encadrés valeur. Bouton « Affiner ».
- **Expert** : stack 7 couches, radar 8 scores, **CostMap étendu** décomposant l'apport du multimodal **dans** les couches (GPU partagé, stockage médias, embeddings) + ligne setup one-time, avec pastilles 🟢/💳 et sources cliquables ; ensemble multi-config ; exports MD/PDF ; Exit Escrow ; Fiduciary. Disclaimer multimodal : « ces coûts varient fortement selon le volume et le fournisseur ; demandez un devis avant le go ».

## 11. Honnêteté & DÉFCON 1

Tout coût → URL + date + pastille de confiance + ±30 % + disclaimer. Incohérences pointées (petit budget + souveraineté max + génération vidéo → message + levier). Étiquettes 🟢 open-source / 💳 payant. **Prix de vente = `[PLACEHOLDER]` centralisé** tant que le sondage n'a pas de réponses (le spec fixe l'emplacement d'injection, pas la valeur). « Prouvé » uniquement pour « −risques » (Exit Escrow + Fiduciary déjà livrés) ; autres promesses = « voici comment on le mesure », jamais de stat inventée.

## 12. Migration & périmètre fichiers

Remplacement net, zéro code mort, zéro dette.

**À créer :** `lib/engine/sizing.ts` (+ tests) ; `lib/quick/profile-mappers.ts` (+ tests) ; `components/wizard/MediaNeedsBlock.tsx`, `BudgetMeter.tsx`, `InfoBubble.tsx`, `ContinuousSlider.tsx` ; `components/quick-profile/QuickProfileForm.tsx` ; section pricing médias dans `lib/pricing/` (seed + feed).

**À modifier :** `lib/engine/types.ts` (`Profile`, `Recommendation`, `MediaNeed`, `Sizing`, `Verdict`) ; `recommend.ts` (appel `sizing`, intégration coûts dans les couches, `verdict`, `setupCost`) ; `scores.ts` (`audit`/`bitemporal` booléens, score `mm` selon `mediaNeeds`) ; `layers.ts` / `cost.ts` (C4/C5/C6 dimensionnés par `Sizing`, `costBand` réutilisé) ; `components/wizard/Wizard.tsx` (6 étapes → 4 blocs + budget-mètre) ; `hooks/useWizardProfile.ts` + `defaultProfile.ts` ; `lib/wizard/options.ts` (libellés) ; `components/results/ResultsView.tsx`, `CostMap.tsx` (mode verdict + décomposition multimodale + setup) ; `app/page.tsx` (entrée 90 s) ; migration Supabase (log des simulations + capture e-mail, RLS).

**À supprimer :** étapes du wizard 6-steps obsolètes ; type `Requirement` si inutilisé.

## 13. Stratégie de test

- **Unitaires (moteur pur)** : `sizing` (matrice §5.6, anti double-comptage GPU), `profile-mappers` (chaque mapping → Profile attendu), `recommend` étendu (sizing intégré, verdict, setupCost), `scores` (booléens + `mm`). Couverture ≥ 80 % sur `lib/engine/`.
- **E2E (Playwright desktop + mobile)** : (a) chemin 90 s → verdict ; (b) wizard 4 blocs → résultats expert ; (c) bloc ④ avec génération vidéo souveraine → budget-mètre rouge + levier. Round-trip `/configurateur` ↔ `/resultats` (cohérence localStorage).
- **Garde-fou** : typecheck 0, lint 0/0, build OK avant chaque story.

## 14. Risques & mitigations

| # | Risque | Gravité | Mitigation |
|---|---|---|---|
| 1 | Sous-dimensionnement GPU (oubli du volet « créer ») | 🔴 | Volet génération interrogé ; sizing dimensionne sur charge totale ; tests anti-sous-estimation |
| 2 | Double-comptage GPU (multimodal vs C4/C6) | 🔴 | Un seul pool GPU compté une fois dans C6 ; test dédié |
| 3 | Coûts médias faux (DÉFCON 1) | 🔴 | Sources URL+date+confiance, ±30 %, disclaimer devis, repli seed |
| 4 | Dégradation UX wizard (hydration 4 blocs) | 🟠 | Profil chargé hors composant, tests hydration mobile, e2e complet |
| 5 | Explosion surface de test | 🟠 | Tests table-driven, e2e limité à 3 parcours, couverture CI |

## 15. Hors-scope (volets connexes)

- **Offre commerciale « synthèses / formations »** : palier de monétisation entre « recette » gratuite et « cuisine » payante — **pas de l'infra**, traité dans l'offre/homepage, jamais dans le moteur.
- **Homepage de vente** (`homepage-draft.html`) : marketing distinct, à part.
- **Prix de vente ferme** : dépend du sondage Van Westendorp (collecte en cours).
- **Renommage code/repo Mnémo → Strate** : story dédiée.
- **Écran d'admin d'org** et **choix LLM par org** : non prévus.

## 16. Découpage indicatif pour `writing-plans`

(1) types + `audit`/`bitemporal` booléens + migration moteur ; (2) `sizing.ts` (GPU partagé + stockage indexé + setup) + tests ; (3) pricing médias (seed sourcé + feed) ; (4) intégration `sizing` dans `recommend`/`layers`/`cost` + tests ; (5) wizard 4 blocs + infobulles + sliders continus + notes libres ; (6) bloc ④ Médias (mémoriser + créer) + budget-mètre ; (7) chemin 90 s + mappers + mode verdict ; (8) CostMap étendu + résultats ; (9) conversion/data (log + capture e-mail, RLS) ; (10) e2e + nettoyage code mort.
