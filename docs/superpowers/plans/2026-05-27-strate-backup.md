# Plan d'implémentation — Strate : Sauvegarde & Résilience (backup)

> **Pour les workers agentiques :** SOUS-SKILL REQUIS : `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans`, story par story. Pilotage **Ralph** : chaque story de `.ralph/prd.json` (S-025→S-031) doit avoir `typecheck 0 · lint 0/0 · tests verts · build OK` (+ e2e si pertinent) avant `passes=true`, puis commit `[S-XXX] …` + push. Étapes en checkbox (`- [ ]`).

**Goal :** modéliser la **sauvegarde** comme dimension costable de bout en bout (profil → plan → coût sourcé → 9ᵉ dimension `resilience` → runbook Exit Escrow), conformément au spec `docs/superpowers/specs/2026-05-27-strate-backup-design.md`.

**Architecture :** moteur pur déterministe — `lib/engine/backup.ts` traduit `Profile.backup` en `BackupPlan` (dérivation criticité + conformité), `costBackup` chiffre (agrégé + arbitrage vecteurs + PITR, **prix injectés**), `recommend` l'intègre aux couches/verdict, et le scoring gagne une 9ᵉ dimension `resilience`. Prix médias/stockage réutilisés ; egress/archive/bande passante **sourcés** (DÉFCON 1). UI dans le Bloc ② Infra pure.

**Tech Stack :** Next.js 15 · React 19 · TS strict · Tailwind v3 · Vitest · Playwright. Conventions : `~/.claude/rules/typescript.md`, apostrophes JSX `’`.

**Spec de référence :** `docs/superpowers/specs/2026-05-27-strate-backup-design.md` (types §3, dérivation §4, coût §7, scoring §8). **Hors-scope** : DR/failover + multi-région (spec n°2), renommage Strate, déploiement.

---

## Structure de fichiers

| Fichier | Responsabilité | Statut |
|---|---|---|
| `lib/engine/types.ts` | `Backup`, `BackupPlan`, `VectorDecision`, `ThreeTwoOne`, `SCORE_KEYS`+`resilience`, `Recommendation.backup` | modifier |
| `lib/engine/backup.ts` | `deriveBackupPlan(profile, prices)` + `costBackup` (purs) | **créer** |
| `lib/engine/scores.ts` | 9ᵉ dimension `resilience` | modifier |
| `lib/engine/recommend.ts` · `cost.ts` | intègre le coût backup dans les couches + `setupCost` ; expose `recommendation.backup` | modifier |
| `lib/pricing/backup-seed.ts` (+ `docs/pricing/backup-cost-sources.md`) | prix egress / archive retrieval / bande passante hors-site, **sourcés** | **créer** |
| `lib/exit/bundle.ts` | runbook + `backup.sh` dérivés du `BackupPlan` | modifier |
| `components/results/{ResultsView,CostMap}.tsx` · `RadarChart.tsx` | ligne backup + radar **9 axes** + verdict setup | modifier |
| `components/wizard/Wizard.tsx` (+ éventuel `BackupBlock`) | section « Sauvegarde & résilience » du Bloc ② | modifier |
| `e2e/strate.spec.ts` | parcours backup critique | modifier |
| tests unitaires associés | `backup.test.ts`, MAJ `engine/types/results` (8→9 dims) | créer/modifier |

---

## Stories (acceptance détaillée à reporter dans `.ralph/prd.json`)

### S-025 — Pricing backup sourcé (egress / archive / bande passante)
**Deps :** S-017 · **Files :** `lib/pricing/backup-seed.ts`, `docs/pricing/backup-cost-sources.md`, tests
- [ ] **Sourcing web réel (AVANT le code, DÉFCON 1)** : relever **egress €/Go**, **archive retrieval** (tier froid : Glacier-like, Scaleway Glacier, OVH Cold Archive), **bande passante hors-site** chez les fournisseurs déjà retenus (Scaleway, OVH, Backblaze B2) — pour chacun : **URL + date + pastille de confiance**. Consigner dans `docs/pricing/backup-cost-sources.md`. Devises natives + réutiliser l'étage FX (`media-feed`).
- [ ] Test : `getBackupPrices()` renvoie une table `{ egressPerGb, archiveStoragePerGbMonth, archiveRetrievalPerGb, offsiteBandwidthPerGb }`, chaque entrée `{ amount, currency, unit, confidence, source }` ; repli seed.
- [ ] Impl : seed sourcé (±30 %) + normalisation € (réutilise `normalizeMediaPricesToEur`/un équivalent) ; source incertaine → `confidence: "low"` + « estimation, à confirmer par devis ».
- [ ] Commit `[S-025] Pricing backup sourcé (egress/archive/bande passante)`.
**DÉFCON 1 : bloquant** — aucun prix non sourcé.

### S-026 — `lib/engine/backup.ts` (dérivation + coût, purs)
**Deps :** S-015, S-025 · **Files :** `lib/engine/types.ts`, `lib/engine/backup.ts`, `lib/engine/__tests__/backup.test.ts`
- [ ] Test (table-driven, spec §4/§7) : `deriveBackupPlan` mappe chaque `criticality`→params (table §4) ; surcharge conformité (régulé/`secret` → `crypto-shred` + `immutable` + `legalRetentionYears = max(régimes)`) ; `none`→plan neutre. `costBackup` : **monotonie** (criticité ↑ / rétention ↑ / copies ↑ → coût ↑ ; offsite>onsite ; critical>high>standard>none) ; **arbitrage vecteurs** (choisit `min(backup, reembed)`, bascule au bon seuil de volume) ; PITR ajouté si criticité ≥ high ; prix **injectés** ; chaque coût porte une `CostSource`.
- [ ] Impl : types `Backup`/`BackupPlan`/`VectorDecision`/`ThreeTwoOne` (spec §3) dans `types.ts` ; `Profile.backup?`. `lib/engine/backup.ts` = `deriveBackupPlan(profile, prices)` + `costBackup(profile, plan, prices, mediaSizing)` purs. `volumeToGb` = mapping documenté ±30 %. Réutilise les prix stockage existants + `getBackupPrices` (S-025).
- [ ] Commit `[S-026] backup.ts — plan dérivé + coût agrégé + arbitrage vecteurs`.
**DÉFCON 1 :** prix injectés (fixtures de test) ; aucune valeur réelle en dur ici.

### S-027 — 9ᵉ dimension de scoring `resilience`
**Deps :** S-015 · **Files :** `lib/engine/types.ts`, `lib/engine/scores.ts`, `components/results/RadarChart.tsx`, `components/results/ResultsView.tsx`, tests asservis
- [ ] Test : `SCORE_KEYS` contient `resilience` (9 entrées) ; `computeScores(...)` retourne **9** dimensions ; la dimension `resilience` monte avec criticité/3-2-1-1-0/tests/immutable et baisse si RPO/RTO incohérents.
- [ ] Impl : ajouter `resilience` à `SCORE_KEYS` + libellé ; `scores.ts` calcule la dimension (rubrique spec §8, lit `recommendation.backup`/plan — signature à ajuster pour recevoir le plan) ; `RadarChart` rend 9 axes ; `SHORT_LABELS`/labels MAJ. **Mettre à jour TOUS les tests asservis à « 8 dimensions »** (`engine.test`, `types.test`, `results.test`, e2e radar) → 9.
- [ ] Commit `[S-027] Scoring : 9ᵉ dimension resilience`.
**Note :** refonte transverse — inventorier tous les `toHaveLength(8)` / `length).toBe(8)` / axes radar avant de coder.

### S-028 — Intégration backup dans `recommend`
**Deps :** S-026, S-027 · **Files :** `lib/engine/recommend.ts`, `lib/engine/cost.ts`, tests
- [ ] Test : `recommend(profile, prices)` avec `backup.criticality` → `recommendation.backup` rempli ; coût backup **dans** les couches (C5/C6, pas en ligne hors-total) ; `setupCost` inclut le premier full ; `totalCost` cohérent ; dimension `resilience` reflète le plan ; `none` → backup neutre, invariant `totalCost = baseCost + moduleCost` préservé.
- [ ] Impl : `recommend` appelle `deriveBackupPlan` + `costBackup`, ajoute `backup` à `Recommendation`, impute le coût récurrent aux couches via `applyMultimodalSizing` (ou un `applyBackup` jumeau) et le one-time à `setupCost`, passe le plan à `computeScores`.
- [ ] Commit `[S-028] Intégration backup dans recommend/cost/scores`.

### S-029 — Exit Escrow piloté par le plan
**Deps :** S-028 · **Files :** `lib/exit/bundle.ts`, `lib/exit/__tests__/bundle.test.ts`
- [ ] Test : `buildExitBundle(profile, recommendation)` → le `runbook.md` et `scripts/backup.sh` reflètent le `BackupPlan` réel (RPO/rétention/copies/offsite/airgap/immutable/PITR/érasure) ; cohérence manifest↔plan.
- [ ] Impl : `bundle.ts` lit `recommendation.backup` au lieu du texte générique 3-2-1.
- [ ] Commit `[S-029] Exit Escrow — runbook/backup.sh depuis le plan`.

### S-030 — UI Bloc ② « Sauvegarde & résilience »
**Deps :** S-026, S-019 · **Files :** `components/wizard/Wizard.tsx` (+ `components/wizard/BackupBlock.tsx` si utile), tests
- [ ] Test : rendu de la section ; changer la criticité → `setField("backup", …)` propage ; aperçu live (« ≈ X €/mois (+ Y € mise en route) ») ; `vectorStrategy` auto/backup/reembed ; budget-mètre intègre le backup.
- [ ] Impl : section dans le Bloc ② (RadioCards criticité + `InfoBubble` neutre + affinage expert RPO/RTO/rétention/copies/offsite/airgap/immutable/tier/BYOK/tests + `vectorStrategy` + politique d'érasure recommandée/surchargeable). Prix injectés (`getMediaPricesEur` + `getBackupPrices`).
- [ ] Commit `[S-030] Bloc Sauvegarde & résilience + aperçu live`.

### S-031 — Résultats + e2e + nettoyage
**Deps :** S-028, S-027, S-029, S-024 · **Files :** `components/results/{ResultsView,CostMap}.tsx`, `e2e/strate.spec.ts`
- [ ] CostMap : ligne backup (récurrent) + ligne setup enrichie + pastilles 🟢/💳 + sources cliquables ; verdict inclut la mise en route backup ; radar **9 axes**.
- [ ] E2E (desktop + mobile) : profil **critique + régulé** → ligne backup + radar 9 axes + érasure `crypto-shred` + le bundle Exit Escrow reflète le plan. Round-trip.
- [ ] Nettoyage : zéro `toHaveLength(8)` résiduel ; typecheck 0 / lint 0/0 / build OK / e2e verts.
- [ ] Commit `[S-031] Résultats backup + e2e + nettoyage`.

---

## Self-review

- **Couverture spec** : §3 types → S-026 ; §4 dérivation → S-026 ; §5 vecteurs/PITR → S-026 ; §6 conformité/érasure → S-026 ; §7 coût + sourcing → S-025+S-026+S-028 ; §8 scoring resilience → S-027 ; §9 Exit Escrow → S-029 ; §10 UI → S-030 ; §11 tests → chaque story + S-031 (e2e). **Hors-scope** (DR, multi-région, renommage, déploiement) : non planifié, conforme.
- **Placeholders** : aucun ; seul `firmPriceTier = [PLACEHOLDER]` (prix de vente) reste intentionnel et **hors** de ce plan.
- **Cohérence des types** : `Backup`/`BackupPlan`/`VectorDecision`/`ThreeTwoOne`/`resilience` définis en S-026/S-027, consommés en S-028/S-029/S-030/S-031 — noms alignés sur le spec §3.
- **Séquencement** : S-025 (prix) avant S-026 (coût) ; S-027 (9ᵉ dim) avant/parallèle S-028 ; e2e en S-031 après l'UI.

## Hand-off d'exécution

Voir la question d'exécution en fin de session (Ralph inline vs subagent-driven).
