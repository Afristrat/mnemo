# Spec de design — Refonte du simulateur Mnémo

- **Date** : 2026-05-26
- **Statut** : en revue (HARD GATE — validation d'Amine requise avant tout code, puis `writing-plans`)
- **Périmètre** : refonte du parcours de simulation (configurateur → résultats) + nouveau sous-moteur de costing multimodal + conversion/data. La homepage de vente est un volet connexe traité à part (brouillon `homepage-draft.html`).
- **Sources de décision** : `PASSATION.md` (12 décisions verrouillées + angles morts du conseil), brainstorming 2026-05-26 (5 partis-pris d'architecture + 2 clarifications), cartographie du code existant.

---

## 1. Contexte & objectif

Mnémo est un configurateur d'infrastructure de base mémorielle IA souveraine. Le simulateur actuel (`/configurateur`, wizard 6 étapes, 15 paramètres) effraie le décideur non technique et masque la valeur derrière du jargon (« souverain ») et une fourchette de coût ±30 % nue. Le moteur de reco (`lib/engine/`) est déterministe, pur et testé, mais **ignore le coût de la création de contenu multimodale** (audio/vidéo/images/formations) : seul le coût d'embedding C4 bouge de +20/60/100 €, aucun coût de transcription, d'extraction vidéo, d'OCR ou de GPU souverain n'est chiffré — sous-estimation possible de plusieurs centaines d'euros par mois.

**Objectif de la refonte :**
1. Une entrée par la **douleur** (chemin 90 s, zéro jargon) → verdict clair : risque / gain / prix ferme par palier / next step. Le configurateur complet devient le **mode expert**.
2. Un questionnaire restructuré en **4 blocs** lisibles, avec vraies infobulles (pourquoi + conséquence), sliders continus, binaires Oui/Non et notes libres.
3. Un **costing multimodal** honnête (le chantier neuf), sourcé, qui ne ment pas sur les coûts de création de contenu.
4. Une **carte budget-mètre** flottante (vert → rouge) qui explique les dépassements et propose un levier.
5. Des **usages costables** (ex-« modules avancés ») renommés en clair et présentés comme des usages, pas de l'infra.
6. De la **conversion/data** : rapport partageable, capture e-mail exit-intent, log des simulations (moat data).

**Non-objectifs (cette itération) :** écran d'administration d'organisation ; choix du LLM par organisation (configuré au niveau plateforme, super-admin, via LiteLLM) ; figer le prix de vente Mnémo (reste `[PLACEHOLDER]` jusqu'aux réponses du sondage Van Westendorp).

---

## 2. Décisions verrouillées (rappel)

Reprises de `PASSATION.md` (section « DÉCISIONS DE REFONTE DU SIMULATEUR »), considérées comme acquises :

1. Entrée = paradigme B : structuré **+** expression libre/dictée (note libre par étape).
2. Chemin 90 s en tête (entrée par la douleur) ; configurateur 16 params = mode expert.
3. Questionnaire en 4 blocs : ① Profil & contraintes · ② Infra pure · ③ Usage-Mémoire · ④ Création de contenu (NOUVEAU).
4. Pattern d'étape : label + vraie infobulle (pourquoi + conséquence) · sliders continus · « voix » → « À qui sert cette mémoire ? » · binaire Oui/Non (fin du « souhaité ») · note libre.
5. Carte flottante « budget-mètre » vert → rouge ; dépassement → explique pourquoi + un levier.
6. Honnêteté brutale : rien masqué, incohérences pointées, étiquettes 🟢 open-source / 💳 payant.
7. Modules avancés → **usages costables** renommés (opt-in « en faire une base mémorielle »).
8. Multi-tenant : super-admin + membres ; rôles RLS déjà en base ; pas d'écran admin d'org ; LLM au niveau plateforme.
9. Moteur de coût **déterministe** (±30 % sourcé) ; le **LLM ne touche jamais le calcul** (il interprète l'intake libre, réécrit infobulles/cas d'usage, narre le rapport).
10. Thème clair par défaut + sombre.
11. Homepage de vente : 4 promesses (« −risques » = preuve dure Exit Escrow + Fiduciary ; les 3 autres = « voici comment on le mesure », jamais de stat inventée).
12. Rapport partageable + encadrés valeur ; capture e-mail exit-intent ; log des simulations (moat data).

**Partis-pris d'architecture validés (brainstorming 2026-05-26) :**

- **A.** Costing multimodal = module pur isolé `lib/engine/multimodal-costing.ts` + champ optionnel `multimodalUsage?` sur `Profile` + `multimodalCost` sur `Recommendation`. Prix via `lib/pricing/` étendu (seed sourcé + feed Firecrawl, repli seed).
- **B.** Migration = **remplacement net** (pré-lancement, pas d'utilisateurs réels). Pas de feature flag, code mort supprimé.
- **C.** Chemin 90 s = entrée principale ; `/configurateur` = mode expert ; mapping qualitatif → `Profile` via `lib/quick/profile-mappers.ts`.
- **D.** Modules → usages : renommage + recatégorisation, structure `Profile.modules` (Record) inchangée, pas de table Supabase dédiée.
- **E.** Prix de vente Mnémo = paramètre centralisé `[PLACEHOLDER]` jusqu'au sondage ; le spec définit *où* il s'injecte, pas *combien*.

**Clarifications (brainstorming 2026-05-26) :**

- **Granularité du costing multimodal = hybride** : paliers qualitatifs (léger/moyen/intensif) en mode 90 s ; volumes quantifiés (h audio, min vidéo, nb images) en mode expert.
- **Source des prix multimodaux = les deux** : matrice seed sourcée à la main (URL + date + pastille de confiance + ±30 %) **comme socle de repli** + price feed Firecrawl quand une source est fiable. Même pattern que les 7 couches.

---

## 3. Architecture cible (vue d'ensemble)

```
Accueil (/)
  ├─ Chemin 90 s (entrée par défaut, par la douleur)
  │     └─ lib/quick/profile-mappers : réponses qualitatives → Profile complet (défauts intelligents)
  │           └─ /resultats (verdict : risque / gain / prix par palier / next step)
  │                 └─ lien « Affiner en mode expert » → /configurateur (profil pré-rempli)
  │
  └─ /configurateur (mode expert, wizard 4 blocs + budget-mètre flottant + notes libres)
        ① Profil & contraintes  ② Infra pure  ③ Usage-Mémoire  ④ Création de contenu
              └─ recommend(profile) → Recommendation (+ multimodalCost)
                    └─ /resultats (stack 7 couches, scores, coûts décomposés, ensemble, exports, moats)

Moteur pur (lib/engine/, sans dépendance UI, déterministe, testé)
  recommend(profile)
    ├─ preset / layers / scores / modules (existant)
    ├─ costMultimodalStack(profile.multimodalUsage, preset)   ← NOUVEAU module pur
    └─ Recommendation { …, multimodalCost, … }

Pricing (lib/pricing/)
  ├─ seed sourcé (couches + multimodal)  ← repli
  └─ feed Firecrawl (rafraîchit quand source fiable)

Conversion/data (Supabase, RLS déjà en place)
  ├─ log des simulations (moat data)
  ├─ capture e-mail exit-intent
  └─ rapport partageable (lien)
```

Le **LLM** (plateforme, LiteLLM `proxy.ai-mpower.com`) intervient uniquement sur : interprétation de l'intake libre/dictée, réécriture contextuelle des infobulles/cas d'usage, narration du rapport. **Il ne touche jamais au calcul de coût** (déterministe).

---

## 4. Modèle de données

### 4.1 Changements au type `Profile` (`lib/engine/types.ts`)

| Champ | Avant | Après | Raison |
|---|---|---|---|
| `audit` | `Requirement` (`no`/`desired`/`required`) | `boolean` | Décision 4 : binaire Oui/Non, fin du « souhaité » |
| `bitemporal` | `Requirement` (3 états) | `boolean` | idem |
| `voices` | `Voices` (`solo`/`multi`/`many`) | conservé, **relibellé** « À qui sert cette mémoire ? » (UI) | Décision 4 (sémantique, pas structure) |
| `modules` | `Record<ModuleId, number>` | **conservé**, libellés clairs (UI) | Décision 7 (renommage, pas refonte structurelle) |
| `freeNotes` | — | `Partial<Record<BlockId, string>>` (NOUVEAU) | Décision 1/4 : note libre par bloc |
| `multimodalUsage` | — | `MultimodalUsage \| undefined` (NOUVEAU) | Bloc ④ |

> Le passage de `audit`/`bitemporal` à `boolean` impacte `scores.ts` (qui teste `=== "required"`) et `defaultProfile.ts`. À traiter dans la migration (section 12). Le type `Requirement` reste utilisé ailleurs si pertinent, sinon supprimé (zéro code mort).

### 4.2 Nouveau type `MultimodalUsage`

Quatre catégories, chacune optionnelle. Mode hybride : soit un **palier** (90 s), soit un **volume** quantifié (expert) ; le palier se traduit en volume médian de référence côté moteur.

```typescript
// lib/engine/types.ts
type MMTier = "none" | "light" | "medium" | "intensive";
type MMMode = "sovereign" | "api";              // souverain (self-host GPU) vs API tierce

type MMAudio = {
  kind: "transcription" | "diarization" | "podcast";
  tier: MMTier;
  hoursPerMonth?: number;                        // mode expert (override le palier)
  mode: MMMode;
};
type MMVideo = {
  kind: "frame-extraction" | "subtitles" | "synthesis";
  tier: MMTier;
  minutesPerMonth?: number;
  mode: MMMode;
};
type MMImages = {
  kind: "ocr" | "annotation" | "indexing";
  tier: MMTier;
  countPerMonth?: number;
  mode: MMMode;
};
type MMTraining = {
  kind: "video-synthesis" | "slide-deck" | "interactive";
  tier: MMTier;
  mode: MMMode;
};

type MultimodalUsage = {
  audio?: MMAudio;
  video?: MMVideo;
  images?: MMImages;
  training?: MMTraining;
};
```

### 4.3 Changements au type `Recommendation`

```typescript
type Recommendation = {
  // … existant (preset, layers, baseCost, moduleCost, scores, …)
  multimodalCost: number;                        // NOUVEAU — 0 si pas de multimodalUsage
  multimodalDetail: MultimodalCostLine[];        // NOUVEAU — décomposition par catégorie
  totalCost: number;                             // = baseCost + moduleCost + multimodalCost
  verdict: Verdict;                              // NOUVEAU — résumé pour le chemin 90 s
};

type MultimodalCostLine = {
  category: "audio" | "video" | "images" | "training";
  label: string;                                 // libellé clair
  mode: MMMode;                                  // souverain / API
  monthlyCost: number;                           // valeur centrale
  band: { low: number; high: number };           // ±30 %
  source: PriceSource;                           // URL + date + confiance (DÉFCON 1)
};

type Verdict = {
  pain: string;                                  // reformulation de la douleur (LLM, narratif)
  risk: string;                                  // risque principal exposé
  gain: string;                                  // gain mesurable (pas de stat inventée)
  firmPriceTier: string;                         // palier de prix ferme (service Mnémo, [PLACEHOLDER])
  variableCostBand: { low: number; high: number };// coût infra ±30 %
  nextStep: string;                              // appel à l'action
};
```

---

## 5. Costing multimodal (le cœur neuf)

### 5.1 Principe

Fonction **pure et déterministe** `costMultimodalStack(usage, preset) → { lines, total }`, sans dépendance UI, entièrement testée. Le LLM ne l'appelle jamais.

```typescript
// lib/engine/multimodal-costing.ts
export function costMultimodalStack(
  usage: MultimodalUsage | undefined,
  preset: Preset,
  prices: MultimodalPriceTable,                  // injecté (seed ou feed) — testabilité
): { lines: MultimodalCostLine[]; total: number };
```

### 5.2 Du palier au volume

Chaque palier `MMTier` mappe vers un **volume médian de référence** (documenté et sourcé), pour que paliers et volumes utilisent la même formule :

| Catégorie | `light` | `medium` | `intensive` | Unité |
|---|---|---|---|---|
| Audio | à sourcer | à sourcer | à sourcer | h/mois |
| Vidéo | à sourcer | à sourcer | à sourcer | min/mois |
| Images | à sourcer | à sourcer | à sourcer | unités/mois |
| Formation | forfait | forfait | forfait | livrables/mois |

> Les volumes de référence et les tarifs unitaires seront **renseignés au sourcing** (section 5.4), jamais inventés dans ce spec (DÉFCON 1). Un volume saisi en mode expert (`hoursPerMonth`, etc.) **override** le palier.

### 5.3 Formule

Pour chaque catégorie active :
```
volume         = usage.<cat>.<volumeField> ?? volumeRéférence(tier, catégorie)
tarifUnitaire  = prices[catégorie][mode][kind]      // mode = sovereign | api
coûtCentral    = volume × tarifUnitaire (+ coût fixe GPU/mois si mode = sovereign)
band           = costBand(coûtCentral, 0.30)        // réutilise lib/engine/cost.ts
```
`total = Σ coûtCentral` ; ce total alimente `Recommendation.multimodalCost` et s'ajoute à `totalCost`. Le mode **souverain** ajoute un **coût fixe d'infra GPU mensuel** (amorti), distinct du coût à l'usage de l'API tierce — c'est précisément ce que le moteur actuel ignore.

### 5.4 Sources à sourcer (DÉFCON 1, à remplir à l'implémentation)

Aucun chiffre n'est figé ici. Les tarifs seront sourcés (URL + date + pastille de confiance), avec ±30 %, et seedés dans `lib/pricing/` :

- **Audio (transcription/diarisation)** : OpenAI Whisper API, AssemblyAI, Deepgram (API) ; Whisper large-v3 self-host sur GPU (souverain).
- **Vidéo (synthèse/sous-titres/extraction)** : Synthesia, HeyGen (API synthèse) ; ffmpeg + modèles open-source self-host (souverain) ; coût d'hébergement/stockage vidéo.
- **Images (OCR/annotation/indexation)** : Google Cloud Vision, AWS Textract, Mistral OCR (API) ; Tesseract / modèles vision open-source self-host (souverain).
- **Formation (vidéo synthétisée, decks, interactif)** : forfaits Synthesia/équivalents (API) ; pipeline self-host (souverain).
- **GPU souverain** : RunPod, Lambda, Scaleway, OVH (€/h ou €/mois amorti).

Chaque source obtient une `PriceSource { url; date; confidence }`. Le feed Firecrawl rafraîchit quand la page est exploitable ; sinon repli sur le seed. Si une source est introuvable/incertaine → la ligne est marquée « estimation, à confirmer par devis » dans le rapport (jamais présentée comme certaine).

### 5.5 Tests (obligatoires, table-driven)

`lib/engine/__tests__/multimodal-costing.test.ts` : matrice **4 catégories × {api, sovereign} × {light, medium, intensive}** + cas volume-override + cas `usage = undefined` (total = 0). Vérifie monotonie (intensive ≥ medium ≥ light), présence de `source` sur chaque ligne, cohérence `total = Σ lines`.

---

## 6. Les 4 blocs du questionnaire

Pattern commun par bloc : titre + sous-titre orienté bénéfice · contrôles avec **infobulle (pourquoi + conséquence)** · **note libre** facultative · le budget-mètre flottant reste visible.

### Bloc ① — Profil & contraintes
`activity`, `zone`, `users` (stepper), `regulations` (multi), `sensitivity`, `techLevel`, `budget`.
Copy orientée **peur/conformité** (CNDP / Cloud Act / RGPD) plutôt que « souverain ».

### Bloc ② — Infra pure
`volume` (slider continu), `reqPerDay` (slider continu « débit »), `latency`, `growth`. Souveraineté traitée ici comme conséquence des contraintes du bloc ① (zone + régulations), pas comme jargon.

### Bloc ③ — Usage-Mémoire
- « Cette mémoire doit-elle être **interrogeable** ? » (binaire) ;
- « **À qui sert cette mémoire ?** » (ex-`voices` : solo / équipe / large) ;
- « Que faut-il mémoriser ? » (`contentTypes`, multi) ;
- **Usages costables** (ex-modules, opt-in « en faire une base mémorielle ») — voir section 9.

### Bloc ④ — Création de contenu (NOUVEAU)
Pour chaque catégorie (audio / vidéo / images / formation) : binaire « En avez-vous besoin ? » → si oui : `kind`, **palier** (léger/moyen/intensif) ou **volume** (mode expert), toggle **🟢 souverain / 💳 API**. Live preview « + X €/mois pour la création de contenu » via `costMultimodalStack`. Composant `components/wizard/ContentCreationBlock.tsx`.

---

## 7. Chemin 90 s

Entrée par défaut depuis l'accueil. 3 à 4 questions qualitatives orientées douleur (ex. « Quel métier ? », « Qu'est-ce qui vous fait peur aujourd'hui ? », « Combien de personnes ? », « Créez-vous du contenu audio/vidéo ? »). `lib/quick/profile-mappers.ts` traduit en `Profile` complet par **défauts intelligents** documentés (ex. « PME qui démarre » → `activity=pme-startup`, `users=5`, `budget=50to200`, etc.). Résultat → `/resultats` en mode **verdict** (section 10). Lien « Affiner » → `/configurateur` pré-rempli avec ce `Profile`.

Composants : `app/(quick)/` ou section dédiée de l'accueil + `components/quick-profile/QuickProfileForm.tsx`. Décision d'emplacement de route à finaliser au plan d'implémentation (réutilise `useWizardProfile` comme source de vérité).

---

## 8. Budget-mètre flottant

`components/wizard/BudgetMeter.tsx` — carte sticky, visible dans le wizard et le verdict. Compare `totalCost` (coût variable infra) au `budget` choisi : vert (< budget), jaune (proche), rouge (dépassement). En dépassement : **explique pourquoi** (la ligne de coût dominante) **+ propose un levier** (ex. « passer ce bloc audio en mode API », « réduire le volume »). Ne touche jamais au prix de vente Mnémo (séparé).

---

## 9. Modules → usages costables

Renommage (UI + libellés moteur), structure `Profile.modules: Record<ModuleId, number>` inchangée :

| ModuleId | Avant | Après (clair) |
|---|---|---|
| `bisect` | Recherche binaire épistémique | **Traçage des revirements** |
| `reversal` | Intégrité par construction | **Mémoire infalsifiable** |
| `prereg` | Pre-registration horodatée | **Décisions horodatées** |
| `mel` | MEL + dégradation | **Plan de panne** |
| `conflict` | Détecteur de conflits | **Détecteur de conflits** |

Présentés dans le bloc ③ comme des **usages** activables (opt-in « en faire une base mémorielle »), pas comme de l'infra. Coût inchangé côté moteur (`lib/engine/modules.ts`), seuls les libellés/`label` changent.

---

## 10. Page résultats

Deux modes d'affichage du même `Recommendation` :

- **Verdict (90 s)** : `Verdict` lisible — douleur reformulée, risque, gain (mesurable, jamais inventé), **palier de prix ferme** (service Mnémo, `[PLACEHOLDER]`), **coût variable infra** ±30 %, next step. Encadrés valeur. Bouton « Affiner ».
- **Expert** : stack 7 couches, radar 8 scores, **CostMap étendu** avec une ligne dédiée « Création de contenu » décomposée par catégorie (`multimodalDetail`, sources cliquables), ensemble multi-config, exports MD/PDF, Exit Escrow, Fiduciary.

`components/results/CostMap.tsx` étendu pour afficher `multimodalDetail` (avec pastilles 🟢/💳 et sources). Disclaimer multimodal : « ces coûts varient fortement selon le volume et le fournisseur ; demandez un devis avant le go ».

---

## 11. Honnêteté & DÉFCON 1

- Tout coût affiché → URL + date + pastille de confiance + ±30 % + disclaimer (déjà la norme pour les couches ; étendu au multimodal).
- Incohérences pointées explicitement (ex. petit budget + souveraineté max → message + levier).
- Étiquettes 🟢 open-source / 💳 payant sur chaque choix.
- **Prix de vente Mnémo** : `[PLACEHOLDER]` centralisé tant que le sondage Van Westendorp n'a pas de réponses. Le spec définit l'emplacement d'injection (`Verdict.firmPriceTier`, constante centralisée), pas la valeur.
- « Prouvé » uniquement pour « −risques » (preuve dure Exit Escrow + Fiduciary, déjà livrés) ; les autres promesses = « voici comment on le mesure », jamais de stat inventée.

---

## 12. Migration & périmètre fichiers

Remplacement net (pas de feature flag, pré-lancement). Zéro code mort, zéro dette.

**À créer :**
- `lib/engine/multimodal-costing.ts` + tests.
- `lib/quick/profile-mappers.ts` + tests.
- `components/wizard/ContentCreationBlock.tsx`, `components/wizard/BudgetMeter.tsx`, `components/wizard/InfoBubble.tsx`, `components/wizard/ContinuousSlider.tsx`.
- `components/quick-profile/QuickProfileForm.tsx`.
- Section pricing multimodal dans `lib/pricing/` (seed + intégration feed).

**À modifier :**
- `lib/engine/types.ts` (`Profile`, `Recommendation`, nouveaux types), `recommend.ts` (appel costing + `verdict`), `scores.ts` (`audit`/`bitemporal` booléens), `cost.ts` (réutilisation `costBand`).
- `components/wizard/Wizard.tsx` (6 étapes → 4 blocs + budget-mètre), `hooks/useWizardProfile.ts` + `lib/wizard/defaultProfile.ts` (nouveaux champs), `lib/wizard/options.ts` (libellés).
- `components/results/ResultsView.tsx`, `CostMap.tsx` (mode verdict + ligne multimodale).
- Accueil (`app/page.tsx`) : entrée 90 s par défaut.
- Migration Supabase : table/colonnes pour log des simulations + capture e-mail (RLS).

**À supprimer :** étapes du wizard 6-steps devenues obsolètes, état `Requirement` si plus utilisé.

---

## 13. Stratégie de test

- **Unitaires (moteur pur)** : `multimodal-costing` (matrice exhaustive, section 5.5), `profile-mappers` (chaque mapping qualitatif → Profile attendu), `recommend` étendu (multimodalCost intégré, verdict), `scores` (audit/bitemporal booléens). Cible : couverture ≥ 80 % sur `lib/engine/`.
- **E2E (Playwright, desktop + mobile)** : 3 parcours critiques — (a) chemin 90 s → verdict ; (b) wizard 4 blocs → résultats expert ; (c) bloc ④ création de contenu avec budget-mètre qui passe au rouge + levier. Round-trip `/configurateur` ↔ `/resultats` (cohérence localStorage).
- **Garde-fou** : typecheck 0, lint 0/0, build OK avant chaque story (zéro dette).

---

## 14. Risques & mitigations

| # | Risque | Gravité | Mitigation |
|---|---|---|---|
| 1 | Coûts multimodaux faux (DÉFCON 1) | 🔴 | Sources URL+date+confiance, ±30 %, disclaimer devis, tests matrice, repli seed |
| 2 | Dégradation UX wizard (hydration localStorage 4 blocs) | 🟠 | Chargement du profil hors composant, tests hydration mobile, e2e parcours complet |
| 3 | Explosion de la surface de test | 🟠 | Tests table-driven dès le départ, e2e limité à 3 parcours, couverture CI |
| 4 | Couplage localStorage ↔ état de route | 🟠 | `Profile` localStorage = source unique, round-trip testé |
| 5 | Incohérence feed couches vs costing multimodal | 🟡 | Timestamp + version de matrice exposés, disclaimer, audit trail `/api/pricing` |

---

## 15. Hors-scope de ce spec (volets connexes)

- **Homepage de vente** (`homepage-draft.html`) : marketing distinct du simulateur, traité séparément (déjà en brouillon).
- **Pricing de vente ferme** : dépend des réponses du sondage Van Westendorp (collecte en cours).
- **Écran d'administration d'organisation** et **choix LLM par org** : non prévus (décision 8).

---

## 16. Découpage indicatif pour `writing-plans`

Ordre suggéré des stories (à confirmer/affiner par `writing-plans`) : (1) types + `audit`/`bitemporal` booléens + migration moteur ; (2) sous-moteur `multimodal-costing` + tests + seed sourcé ; (3) pricing multimodal (seed + feed) ; (4) wizard 4 blocs + infobulles + sliders continus + notes libres ; (5) bloc ④ Création de contenu + budget-mètre ; (6) chemin 90 s + mappers + mode verdict ; (7) CostMap étendu + résultats ; (8) conversion/data (log simulations + capture e-mail, RLS) ; (9) e2e + nettoyage code mort.
