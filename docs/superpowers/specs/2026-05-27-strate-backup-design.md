# Spec de design — Strate : Sauvegarde & Résilience (spec n°1)

> Brainstorm validé avec Amine (2026-05-27). **Spec n°1 d'une série de 2** : ici la **sauvegarde
> (backup) + restauration**. La **résidence multi-juridiction / multi-région** et le **DR/failover de
> site** font l'objet du **spec n°2** (frontière nette ci-dessous). Discipline : ce spec → `writing-plans`
> → stories `S-025+` (Ralph). Production-ready, zéro dette, DÉFCON 1 (aucun prix non sourcé).

## 1. Objectif & contexte

Aujourd'hui le backup n'existe **que** comme texte dans le bundle Exit Escrow (runbook 3-2-1 +
`backup.sh`) : il n'est ni dans le `Profile`, ni dimensionné, ni chiffré, ni scoré. Or pour une base
mémorielle souveraine, la sauvegarde est une **vraie dimension d'infrastructure costable** : elle
engage le coût récurrent, la conformité (rétention légale, droit à l'oubli) et la résilience.

**But** : modéliser la sauvegarde comme dimension costable de bout en bout — `Profile.backup` →
dérivation d'un **plan de sauvegarde** → **coût agrégé sourcé** (dans les couches + verdict + budget-mètre)
→ **9ᵉ dimension de scoring `resilience`** → alimentation du **runbook Exit Escrow**.

## 2. Périmètre

**Dans ce spec** : sauvegarde + restauration. Composants de la base (vault, Postgres, vecteurs, médias,
logs d'audit, secrets), stratégie (type/RPO/RTO/3-2-1-1-0/rétention/chiffrement/immutabilité),
arbitrage **sauvegarder vs ré-embed** les vecteurs, conformité (rétention + érasure), coût, scoring
`resilience`, synergie Exit Escrow, UI.

**Hors-scope (→ spec n°2 multi-juridiction/multi-région)** : résidence multi-région, réplication
inter-région, **DR / failover de site** (RTO en cas de perte d'une région), `residencyRegions`.
**Hors-scope (autres)** : renommage Mnémo→Strate, déploiement.

## 3. Modèle de données

### 3.1 `Profile.backup` (entrée — hybride palier + expert)

```typescript
type BackupCriticality = "none" | "standard" | "high" | "critical";
type BackupStorageTier = "hot" | "cold";          // chaud (objet) / froid (archive)
type ErasurePolicy = "crypto-shred" | "expiration";
type VectorBackupStrategy = "auto" | "backup" | "reembed"; // auto = le moteur tranche au moindre coût

type Backup = {
  criticality: BackupCriticality;                 // palier (90 s) ; dérive tout le reste
  // — affinage EXPERT (optionnels ; si absents, dérivés du palier, cf. §4) —
  rpoMinutes?: number;                            // perte de données max tolérée
  rtoMinutes?: number;                            // temps de reprise max
  retentionDays?: number;                         // rétention récurrente (GFS simplifié)
  copies?: number;                                // 3-2-1 : nombre de copies
  offsite?: boolean;                              // 1 copie hors-site
  airgap?: boolean;                               // +1 copie hors-ligne / air-gap (ransomware)
  immutable?: boolean;                            // WORM / object-lock
  tier?: BackupStorageTier;                       // destination de stockage
  byok?: boolean;                                 // clés de chiffrement gérées par le client
  restoreTestsPerYear?: number;                   // « 0 erreur » = restaurations testées
  vectorStrategy?: VectorBackupStrategy;          // arbitrage vecteurs (défaut "auto")
  erasurePolicy?: ErasurePolicy;                  // défaut dérivé de la criticité + régimes (§6)
};
// Profile.backup?: Backup
```

### 3.2 Sortie — `BackupPlan` (déduit, ajouté à `Recommendation`)

```typescript
type ThreeTwoOne = { copies: number; mediaTypes: number; offsite: boolean; airgap: boolean; tested: boolean };

type VectorDecision = {
  strategy: "backup" | "reembed";
  backupMonthlyCost: number;     // coût si on sauvegarde les vecteurs
  reembedCost: number;           // coût (one-time, à la restauration) si on ré-embed depuis la source
  reason: string;                // pourquoi ce choix (le moins cher / RTO)
};

type BackupPlan = {
  criticality: BackupCriticality;
  rpoMinutes: number; rtoMinutes: number;
  retentionDays: number; legalRetentionYears: number;   // légale = max(régimes), §6
  copies: number; offsite: boolean; airgap: boolean; immutable: boolean;
  tier: BackupStorageTier; byok: boolean;
  pitr: boolean;                 // WAL/PITR Postgres (criticité high/critical)
  erasurePolicy: ErasurePolicy;
  backupStorageGb: number;       // volume de sauvegarde dimensionné
  vector: VectorDecision;
  threeTwoOne: ThreeTwoOne;      // complétude pour le scoring + le runbook
  monthlyCost: number;           // récurrent €/mois (stockage backup + egress tests + transfert hors-site + WAL)
  setupCost: number;             // one-time : premier full du corpus existant
  costSources: CostSource[];     // DÉFCON 1
};
// Recommendation.backup: BackupPlan   (criticality "none" → plan neutre, coûts 0)
```

> **Décision (Amine) : modèle AGRÉGÉ**, pas une matrice éditable par composant. Le coût est calculé
> sur le volume total ; mais deux postes hétérogènes sont **explicitement** modélisés car ils changent
> l'ordre de grandeur : (a) l'**arbitrage vecteurs** ; (b) le **PITR Postgres** (criticité ≥ high).

## 4. Dérivation `criticality → plan` (pure, documentée, testée)

Défauts **prudents** (jamais sous-dimensionnés sur la conformité), surchargeables en expert :

| Criticité | RPO | RTO | Rétention | Copies | Offsite | Air-gap | Immutable | Tier | PITR | Tests/an | Érasure (défaut) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `none` | — | — | 0 | 0 | non | non | non | — | non | 0 | — |
| `standard` | 24 h | 8 h | 30 j | 2 | oui | non | non | hot | non | 1 | expiration |
| `high` | 1 h | 4 h | 90 j | 3 | oui | oui | non | hot+cold | oui | 2 | expiration\* |
| `critical` | ≈ continu | 1 h | 365 j (+ légale) | 3 | oui | oui | oui (WORM) | hot+cold | oui | 4 | crypto-shred |

\* **Surcharge conformité** : si `regulations` contient un régime régulé (secret-pro, hipaa) **ou**
`sensitivity === "secret"` → érasure = `crypto-shred`, `immutable = true`, et `legalRetentionYears` =
`max(régimes)` (§6). La règle est `max(criticité, contraintes)`.

## 5. Arbitrage vecteurs (insight moat) & PITR

- **Vecteurs (Qdrant)** : reconstructibles depuis la source. Le moteur calcule `backupMonthlyCost`
  (= `vectorGb × prix stockage × copies`) **vs** `reembedCost` (= ré-embed du corpus via le coût
  embeddings déjà modélisé en S-016/017 — souverain sur GPU compté, ou API). `vectorStrategy: "auto"`
  → choisit le **moins cher** (en intégrant le RTO : ré-embed ⇒ RTO plus long, signalé). Exposé en clair.
- **PITR/WAL Postgres** (criticité ≥ high) : ajoute un poste de stockage WAL + permet un RPO ≈ continu.

## 6. Conformité (DÉFCON 1)

- **Rétention légale** = `max` des obligations des régimes cochés (table documentée, sourcée :
  ex. secret pro, obligations fiscales/commerciales). Ne **jamais** descendre sous ce plancher.
- **Droit à l'oubli (RGPD Art. 17 / CNDP loi 09-08) vs backups** — politique = **les deux selon
  criticité** (décision Amine) :
  - régulé/secret → **crypto-shredding** (chiffrement par clé/enregistrement ; « suppression » =
    destruction de la clé → donnée illisible y compris en backup, effet immédiat ; impose une archi de clés) ;
  - sinon → **suppression logique + fenêtre d'expiration** documentée (purge effective à l'expiration
    de la rétention) ;
  - le moteur **recommande** la politique selon le profil ; l'expert peut forcer.
  - **Disclaimer** : orientation d'ingénierie, pas un avis juridique — « à valider par votre conseil ».

## 7. Modèle de coût (agrégé, sourcé)

Volume de base : `baseGb = volumeToGb(profile.volume) + sizing.storageGb` (médias) `+ ε(Postgres/vault)`.
`volumeToGb` = mapping palier→Go (**hypothèse de modélisation ±30 %**, documentée, comme les facteurs
média de S-016).

```
retentionFactor = 1 (full) + churnRate × retentionJours        // incrémentaux dédupliqués
backupStorageGb = baseGb × retentionFactor × copies × dedupCompressionFactor
monthlyCost = backupStorageGb × prixStockage(tier)
            + egress(tests de restauration)
            + transfertHorsSite(offsite/airgap)
            + stockageWAL (si pitr)
setupCost   = baseGb × prixIngestion (premier full)            // one-time
```

- **Réutilise les prix stockage déjà sourcés** (Scaleway Object/Glacier, Backblaze B2).
- **À SOURCER (DÉFCON 1, mini-tâche comme S-017)** : **egress €/Go**, **archive retrieval** (tier froid),
  **bande passante hors-site**. Consignés dans `docs/pricing/backup-cost-sources.md` (URL + date + confiance).
- Entre dans `totalCost`/verdict/budget-mètre ; `setupCost` s'ajoute au setup multimédia existant.
- `none` → tous coûts 0.

## 8. Scoring — 9ᵉ dimension `resilience`

**Décision Amine : nouvelle dimension dédiée** (refonte 8 → 9). Rubrique (0-10) :
base selon criticité, + complétude **3-2-1-1-0**, + restauration **testée**, + **immutabilité**,
+ **conformité-érasure**, − si RPO/RTO incohérents avec la criticité déclarée. Synergie avec le module
**« Plan de panne » (mel)** = pendant opérationnel (le scoring peut en tenir compte).

**Impacts techniques (assumés)** : `SCORE_KEYS` 8→9 (+`resilience`), `scores.ts` (retourne 9),
`RadarChart` (9 axes), `SHORT_LABELS`/labels, et **tous les tests** asservis à « 8 dimensions »
(`engine.test`, `types.test`, `results.test`, e2e radar) → mis à jour vers 9. Zéro dette laissée.

## 9. Synergie Exit Escrow

`buildExitBundle` lit `recommendation.backup` → le **runbook** et `backup.sh` du bundle reflètent le
plan réel (RPO/rétention/destinations/3-2-1-1-0/PITR/érasure), au lieu du texte générique actuel.

## 10. UI

Extension du **Bloc ② Infra pure** (pas de 5ᵉ bloc) — section « Sauvegarde & résilience » :
- **90 s/standard** : `RadioCards` criticité (Aucune / Standard / Élevée / Critique) + `InfoBubble`
  (pourquoi + conséquence, neutre).
- **Expert** : affinage (RPO/RTO/rétention/copies/offsite/air-gap/immutable/tier/BYOK/tests) +
  `vectorStrategy` (auto/backup/reembed) + politique d'érasure (recommandée, surchargeable).
- Aperçu live : « ajoute ≈ X €/mois (+ Y € de mise en route) ». Le **budget-mètre** intègre le backup ;
  en dépassement, levier dédié possible (ex. « tier froid », « ré-embed les vecteurs », « rétention ↓ »).
- **Résultats** : ligne backup dans le CostMap (pastille confiance + sources) ; `resilience` dans le radar ;
  verdict — la « mise en route » inclut le premier full.

## 11. Stratégie de test

- **Unitaires (moteur pur)** : dérivation `criticality → plan` ; surcharge conformité (régulé/secret →
  crypto-shred + immutable + rétention légale) ; **monotonie** coût (criticité ↑ / rétention ↑ / copies ↑
  → coût ↑ ; offsite > onsite ; `critical` > `high` > `standard` > `none`) ; **arbitrage vecteurs**
  (choisit le moins cher, bascule au bon seuil) ; `none` → neutre ; **9 dimensions** de scoring ;
  `resilience` sensible aux attributs.
- **DÉFCON 1** : chaque coût porte une `CostSource` ; egress/archive/bande passante sourcés.
- **E2E** : profil critique régulé → ligne backup + radar **9 axes** + érasure crypto-shred + le bundle
  Exit Escrow reflète le plan. Desktop + mobile.
- Garde-fou : typecheck 0 · lint 0/0 · build OK avant chaque story.

## 12. Risques & mitigations

| # | Risque | Grav. | Mitigation |
|---|---|---|---|
| 1 | Refonte scoring 8→9 casse radar/tests | 🟠 | Inventaire exhaustif des points « 8 » + mise à jour groupée + e2e radar |
| 2 | Coûts backup faux (DÉFCON 1) | 🔴 | egress/archive/bande passante **sourcés** ; ±30 % ; disclaimer devis |
| 3 | `volumeToGb` = hypothèse | 🟠 | documentée ±30 %, surchargeable, comme les facteurs média |
| 4 | Conseil érasure pris pour un avis juridique | 🔴 | disclaimer explicite « ingénierie, pas juridique ; valider par conseil » |
| 5 | Double-comptage vecteurs (backup + ré-embed) | 🟠 | arbitrage = **un seul** des deux postes, jamais les deux ; test dédié |

## 13. Migration & fichiers

**Créer** : `lib/engine/backup.ts` (`deriveBackupPlan` + `costBackup` purs) ; `lib/pricing/backup-seed.ts`
+ sourcing `docs/pricing/backup-cost-sources.md` ; tests dédiés.
**Modifier** : `types.ts` (`Backup`, `BackupPlan`, `SCORE_KEYS`+`resilience`, `Recommendation.backup`) ;
`scores.ts` (dimension `resilience`) ; `recommend.ts` (appel backup + intégration coût/setup) ;
`cost.ts`/`layers.ts` (poste backup) ; `RadarChart`/`ResultsView`/`CostMap` (9 axes + ligne backup) ;
`components/wizard/Wizard.tsx` (section Bloc ②) ; `lib/exit/bundle.ts` (runbook depuis le plan) ;
tests asservis aux « 8 dimensions ».

## 14. Pointeurs

`PRD.md` · `docs/DECISIONS.md` (ADR à venir) · `.ralph/prd.json` (stories S-025+) · `AGENTS.md` ·
mémoires (`definition-de-termine`, `strate-backlog-usecases-manquants`, `strate-avis-critique-non-oriente`).
Spec n°2 (multi-juridiction/résidence/DR) : à brainstormer après livraison de celui-ci.
