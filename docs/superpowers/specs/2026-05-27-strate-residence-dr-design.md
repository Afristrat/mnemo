# Spec de design — Strate : Résidence multi-juridiction + DR/failover (spec n°2)

> Brainstorm validé avec Amine (2026-05-27). **Spec n°2 d'une série** : la **sauvegarde** (spec n°1,
> `2026-05-27-strate-backup-design.md`) est livrée (S-026→S-031). Ici : **résidence des données par
> juridiction** + **réplication inter-région** + **DR/failover de site**. La **reco vivante + LLM**
> (spec n°3, `2026-05-27-llm-plateforme-reco-vivante-design.md`) est un chantier parallèle. Frontière
> nette ci-dessous. Discipline : ce spec → `writing-plans` → stories `S-043+` (Ralph). Production-ready,
> zéro dette, DÉFCON 1. Déclenché aussi par le test utilisateur (finding **C4** : « héberger dans
> plusieurs continents, il n'y a pas d'option »).

## 1. Objectif & contexte

`Profile.zone` est aujourd'hui **mono-zone** (`ue|maroc|us|other`). Or des organisations ont des
contraintes de **résidence multi-juridiction** (données qui doivent rester dans tel pays/zone) et/ou de
**continuité régionale** (rester debout si une région tombe). Aujourd'hui rien n'est modélisé : ni la
résidence multi-région, ni la réplication, ni le DR/failover, ni leur **conformité** (transferts
inter-juridiction) et leur **coût**.

**But** : modéliser la résidence + le DR comme **dimension costable + conforme** de bout en bout —
`Profile.residency` → `ResidencyPlan` (topologie de régions + DR) → **coût agrégé sourcé** (réplication +
régions en attente) → **conformité des transferts** (DÉFCON 1) → **scoring** (10ᵉ dimension `geosov` +
`resilience` étendu) → **Exit Escrow** (runbook DR + IaC multi-région). Dans la lignée du moteur **pur,
déterministe, prix injectés**.

## 2. Périmètre

**Dans ce spec** : résidence par juridiction, réplication inter-région, DR/failover régional
(`none/warm/hot` + actif-actif), conformité des **transferts** inter-région, coût, scoring `geosov` +
extension `resilience`, synergie Exit Escrow, UI.

**Hors-scope** : sauvegarde/restauration **intra-région** (spec n°1, livrée — ne pas recompter) ; reco
vivante / LLM (spec n°3) ; edge/CDN ; conformité juridique **exhaustive** pays par pays au-delà des
régimes/zones modélisés ; renommage `mnemo`.

## 3. Modèle de données

### 3.1 `Profile.residency` (entrée — hybride palier + expert)

```typescript
type Region = "eu" | "maroc" | "us" | "other"; // aligné sur Zone (mapping 1-1)
type DrTier = "none" | "warm" | "hot";

type Residency = {
  // — 90 s : tout dérivé de `zone` + `regulations` si absent (zéro saisie) —
  primaryRegion?: Region;                  // défaut = mapping de profile.zone
  drTier?: DrTier;                          // défaut suggéré (criticité backup + latence + users)
  // — affinage EXPERT (optionnels) —
  allowedRegions?: Region[];                // régions où les données PEUVENT vivre/répliquer
  noTransferOutsideJurisdiction?: boolean;  // interdit toute copie hors juridiction (défaut dérivé §4)
  activeActive?: boolean;                   // multi-région en charge simultanée (RTO ≈ 0, plus cher)
  drRpoMinutes?: number;                    // override RPO régional
  drRtoMinutes?: number;                    // override RTO régional (bascule)
};
// Profile.residency?: Residency  (absent ⇒ mono-région dérivée de zone, DR "none")
```

### 3.2 Sortie — `ResidencyPlan` (ajouté à `Recommendation`)

```typescript
type RegionRole = "primary" | "replica" | "standby" | "active";
type RegionAssignment = { region: Region; role: RegionRole; monthlyCost: number };

type TransferStatus = "ok" | "restricted" | "forbidden";
type TransferFlag = { from: Region; to: Region; legalBasis: string; status: TransferStatus; note: string };

type ResidencyPlan = {
  primaryRegion: Region;
  regions: RegionAssignment[];     // topologie effective (primaire + réplicas/standby/actifs)
  drTier: DrTier;
  activeActive: boolean;
  rpoMinutes: number; rtoMinutes: number;     // **régional** (≠ RPO/RTO backup intra-région)
  transfers: TransferFlag[];                  // conformité des flux inter-région
  conflict: { hasConflict: boolean; reason: string; levers: string[] }; // tension résidence × DR
  monthlyCost: number;                        // réplication (egress inter-région) + régions en attente
  setupCost: number;                          // amorçage des réplicas (premier transfert complet)
  geoSovScore: number;                        // alimente la 10ᵉ dimension
  costSources: CostSource[];                  // DÉFCON 1
};
// Recommendation.residency: ResidencyPlan   (drTier "none" + mono-région → plan neutre, coûts 0)
```

## 4. Dérivation `profil → plan` (pure, documentée, testée)

- **`primaryRegion`** = mapping `zone` (`ue→eu`, `maroc→maroc`, `us→us`, `other→other`).
- **`noTransferOutsideJurisdiction`** défaut **`true`** si `sensitivity === "secret"` **ou** `regulations`
  contient `cndp`/`secret-pro`/`hipaa` ; `rgpd` seul → transferts hors UE **restreints** (pas interdits) ;
  sinon `false`.
- **`drTier`** défaut suggéré : criticité backup `critical → hot`, `high → warm`, sinon `none` ; relevé
  d'un cran si `latency === "fast"` **et** `users > 50` (haute dispo implicite).
- **`allowedRegions`** défaut : `noTransfer` → `[primary]` seule ; sinon régions de la **même zone
  d'adéquation** (UE = régions UE ; etc.).
- **Topologie** : `none` → `[primary]`. `warm` → primary + 1 `standby` (réduit). `hot` → primary + 1
  `standby` (chaud). `activeActive` → primary + N `active`.

## 5. Conformité des transferts (DÉFCON 1, sourcé)

Table des **bases légales** de transfert inter-région (sourcée comme la rétention légale de la spec n°1,
dans `docs/pricing/` ou `docs/legal/` — URL + date + confiance ; disclaimer « ingénierie, pas avis
juridique ») :

| Flux | Statut | Base / note |
|------|--------|-------------|
| UE → UE | `ok` | marché unique |
| UE → hors UE (US/Maroc/autre) | `restricted` | RGPD chap. V — adéquation ou SCC ; **Maroc : pas d'adéquation UE à ce jour** → SCC ; US → Data Privacy Framework (fragile) |
| Maroc → hors Maroc | `restricted` | CNDP loi 09-08 (transfert encadré / autorisation) |
| * → US, données régulées | `restricted` + flag | exposition **Cloud Act** |
| tout flux sortant si `noTransfer=true` | `forbidden` | résidence stricte |

**Insight (tension exposée, JAMAIS résolue en douce — décision Amine #6 « honnêteté brutale »)** :
résidence **stricte** (mono-juridiction) × **DR hot/actif-actif** (≥ 2 régions) peut être **incompatible**
si la juridiction n'offre pas 2 régions distinctes. `ResidencyPlan.conflict` matérialise l'incohérence
(`hasConflict`, `reason`) + propose des **leviers** (région UE secondaire conforme ; accepter un RTO =
restauration backup ; actif-passif intra-région chez un 2ᵉ fournisseur). Le moteur **n'arbitre pas seul**.

## 6. Modèle de coût (agrégé, sourcé, prix injectés)

- **Réplication** : `egress inter-région €/Go × volume répliqué × churn` (étendre le sourcing backup —
  ajouter **egress inter-région** Scaleway/OVH/AWS, sourcé DÉFCON 1).
- **Régions en attente** : réutilise **`computeSovereignCompute` (S-033/S-041)** — `warm` = stockage
  dupliqué + compute standby (~30 %) ; `hot` = ~100 % passif ; `activeActive` = ~100 % × N en charge.
  **Pas de nouveau forfait** (cohérent avec S-041).
- `setupCost` = premier transfert complet (egress inter-région × baseGb). `none` + mono-région → **0**
  (RTO régional = restauration backup, déjà chiffrée spec n°1 — anti double-comptage).
- Entre dans `totalCost`/verdict/budget-mètre. Prix **injectés**, défaut neutre (invariant préservé).

## 7. Scoring (mix — décision Amine)

- **`resilience` (9ᵉ, étendue)** : intègre le **DR** (continuité régionale) en plus du backup. Bonus selon
  `drTier` (warm + / hot ++ / actif-actif +++), RTO régional cohérent ; pénalité si DR incohérent.
- **`geosov` (10ᵉ, NOUVELLE) « Souveraineté géographique »** : données dans la bonne juridiction (+),
  zéro transfert hors juridiction quand requis (+), réplicas tous conformes (+) ; **pénalité** si un
  transfert reste `forbidden`/`restricted` non couvert.
- **`sov` recadrée** « zéro vendor lock-in & portabilité » (le géographique part dans `geosov`).
- **Refonte 9 → 10** : `SCORE_KEYS` (+`geosov`), `computeScores` (10), `RadarChart` (auto), `SHORT_LABELS`,
  et **tous les tests** asservis à « 9 dimensions » (`toHaveLength(9)`→10, e2e radar). Zéro dette (même
  méthode que S-027 8→9).

## 8. Synergie Exit Escrow

`buildExitBundle` lit `recommendation.residency` → **runbook DR** (procédure de bascule régionale, ordre
de priorité des régions, RTO régional) + **IaC multi-région** (terraform : régions + réplication) +
topologie documentée. Reflète le plan réel.

## 9. UI

Extension du **Bloc ② Infra pure** (section « Résidence & continuité », à côté de « Sauvegarde &
résilience ») :
- **90 s** : `RadioCards` DR (Aucune / Tiède / Chaude) + `InfoBubble` ; résidence **dérivée de `zone`**,
  affichée (pas ressaisie).
- **Expert** : `allowedRegions` (multi-select) + `primaryRegion` + toggle `noTransfer` + `activeActive` +
  RPO/RTO régional.
- Aperçu live : « ajoute ≈ X €/mois (réplication + N régions) » ; **budget-mètre** intègre la résidence ;
  **alerte de conflit** résidence × DR.
- **Résultats** : ligne réplication dans le `CostMap` (pastille + sources) ; `transfers[]` (pastilles
  ok/restricted/forbidden + base légale) ; **radar 10 axes** ; verdict (RTO régional).
- **Zone d'hébergement** : ajouter l'option multi-région (répond au finding C4).

## 10. Stratégie de test

- **Unitaires (moteur pur)** : dérivation profil→plan ; conformité transferts (UE→US `restricted`,
  Maroc→hors `restricted`, `noTransfer`→`forbidden`) ; **conflit résidence×DR détecté** + leviers ;
  **monotonie** coût (`none < warm < hot < actif-actif` ; +régions → +coût) ; `geosov` sensible ; **10
  dimensions** ; `none`+mono-région → neutre (invariant `totalCost`).
- **DÉFCON 1** : chaque coût porte une `CostSource` ; egress inter-région sourcé.
- **E2E** : profil régulé multi-région → ligne réplication + radar **10 axes** + alerte transfert +
  bundle Exit Escrow reflète le plan DR. Desktop + mobile.
- Garde-fou : typecheck 0 · lint 0/0 · build OK avant chaque story.

## 11. Risques & mitigations

| # | Risque | Grav. | Mitigation |
|---|--------|-------|------------|
| 1 | Refonte scoring 9→10 casse radar/tests | 🟠 | inventaire `toHaveLength(9)` + MAJ groupée + e2e radar (méthode S-027) |
| 2 | Conformité transferts = avis juridique | 🔴 | table **sourcée** + disclaimer « ingénierie, pas juridique ; valider par conseil » |
| 3 | Coûts réplication faux | 🔴 | egress inter-région **sourcé** ±30 % ; disclaimer devis |
| 4 | Double-comptage DR vs backup | 🟠 | `none` DR → RTO = restauration backup (réutilisé) ; compute repli = `computeSovereignCompute`, pas un forfait |
| 5 | Conflit résidence×DR « résolu en douce » | 🔴 | `conflict` explicite + leviers ; le moteur n'arbitre jamais seul |

## 12. Migration & fichiers (indicatif)

**Créer** : `lib/engine/residency.ts` (`deriveResidencyPlan` + `costResidency` purs) ; sourcing egress
inter-région (`docs/`) ; tests dédiés ; `components/wizard/ResidencyBlock.tsx` ; `components/results/`
(ligne réplication + transferts).
**Modifier** : `types.ts` (`Residency`, `ResidencyPlan`, `Region`, `SCORE_KEYS`+`geosov`,
`Recommendation.residency`) ; `scores.ts` (`geosov` + `resilience` étendu DR + `sov` recadré) ;
`recommend.ts` (appel residency + coût) ; `ensemble.ts` (threade) ; `RadarChart`/`ResultsView`/`CostMap`
(10 axes + ligne réplication + transferts) ; `Wizard.tsx` (section Bloc ②) + `options.ts` (zone
multi-région) ; `lib/exit/bundle.ts` (runbook DR + IaC multi-région) ; tests « 9 dimensions ».

## 13. Découpage en stories (Ralph) — proposé

- **S-043** — Pricing egress inter-région sourcé (DÉFCON 1) + table conformité transferts sourcée.
- **S-044** — `lib/engine/residency.ts` : `deriveResidencyPlan` + `costResidency` (purs, prix injectés) + conflit résidence×DR + tests.
- **S-045** — Scoring 9→10 : `geosov` (neuf) + `resilience` étendu DR + `sov` recadré + MAJ tous les tests « 9 dim ».
- **S-046** — Intégration dans `recommend` (coût réplication + régions repli via compute + `Recommendation.residency`) + `ensemble`.
- **S-047** — Exit Escrow DR (runbook bascule + IaC multi-région) + tests bundle.
- **S-048** — UI Bloc ② « Résidence & continuité » (+ zone multi-région, finding C4) + Résultats (réplication + transferts + radar 10) + e2e + nettoyage.

## 14. Pointeurs

`PRD.md` · `docs/DECISIONS.md` (ADR à venir) · spec n°1 backup · spec n°3 reco-vivante ·
`docs/test-feedback-2026-05-27.md` (finding C4) · `.ralph/prd.json` (stories S-043+) · `AGENTS.md` ·
mémoires (`prix-jamais-hardcodes-feed-live`, `definition-de-termine`, `strate-avis-critique-non-oriente`).
