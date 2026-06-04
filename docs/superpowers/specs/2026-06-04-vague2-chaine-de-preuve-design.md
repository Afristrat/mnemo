# Vague 2 — Chaîne de preuve (Restore Drill + Résidence continue)

> Date : 2026-06-04 · Stories : **S-094** (Restore Drill certifié), **S-095** (Preuve de résidence continue).
> Moat : `docs/MOAT-HUNT.md` § « Vague 2 » (#2 et #3 du top 3). Le #1 (Decision Record) est livré (S-092).

## 1. Intention

Compléter la **chaîne de preuve** — l'argument « Strate ne *recommande* pas, il *prouve* » :

```
Decision Record (✅ pourquoi cette reco)
  → Exit Escrow      (✅ la sortie est GÉNÉRÉE)
    → Restore Drill  (S-094 : la sortie est TESTÉE)
      → Résidence continue (S-095 : les promesses TIENNENT dans le temps)
```

Chaque maillon est un artefact **horodaté + haché SHA-256 + rejouable**, réutilisant
`lib/decision/integrity` (`canonicalJson` + `computeIntegrityHash`, isomorphe client/serveur).

**DÉFCON 1 transversal** : aucune donnée fabriquée. Pour le RTO en particulier, Strate **n'invente
jamais** une valeur — elle fournit l'instrument de mesure et **vérifie** le résultat produit côté client.

## 2. S-094 — Restore Drill certifié

### 2.1 Problème de conception (résolu)

Strate est une app de conseil : elle n'a **ni les données réelles ni l'infra vivante** du client.
« Mesurer le RTO réel » ne peut donc pas être fait par les serveurs de Strate sans fabriquer une valeur
trompeuse. La feature offre **deux modes à l'utilisateur**, chacun avec une explication claire de ce qu'il
prouve et de sa limite :

| Mode | Prouve | Limite (dite clairement) | Exécution |
|---|---|---|---|
| **A — Drill local, données réelles** (`restore-drill.sh`) | RTO **réel** de bout en bout sur les vraies données | Manuel, ponctuel | Machine/serveur du client |
| **B — Répétition à blanc automatisée** (workflow CI jetable + jeu **synthétique**) | Le bundle se **déploie et se restaure** en continu (push/planning) | RTO = celui de la **démo synthétique**, **pas** les données réelles | Runner CI jetable du dépôt client |

**Décision** : mode B = **runner CI jetable** (GitHub Actions/GitLab CI), pas de sandbox orchestrée
côté Strate. Justification : exécuter des stacks `docker-compose` arbitraires côté Strate = surface de
sécurité/coût ingérable, et un RTO mesuré sur données synthétiques côté Strate n'aurait aucune valeur pour
le client. Le runner jetable donne l'« orchestré / répétable / jetable » **honnêtement**, sans que Strate
fabrique ou héberge quoi que ce soit. La vraie sandbox côté Strate reste une piste **vague 3** (effort L,
compromis DÉFCON-1 documenté), explicitement non retenue ici.

### 2.2 Modules (mêmes patterns que `lib/exit` et `lib/decision` — tout PUR)

- **`lib/restore-drill/kit.ts` (PUR)** — `buildRestoreDrillKit(reco, manifest) → Record<path, content>` :
  - `restore-drill.sh` — monte la stack en conteneurs jetables, exécute la checklist, chronomètre le RTO
    réel (wall-clock), émet `restore-certificate.json`.
  - `.github/workflows/restore-drill.yml` — rejoue le drill dans un runner jetable (sur push + planning),
    sur le jeu synthétique, publie le certificat en artefact.
  - `drill/seed/` — atomes markdown **synthétiques** (jeu de démo, jamais de donnée réelle).
  - `DRILL.md` — explique modes A et B + leurs limites + la checklist :
    `services up · dump rechargé · ré-embed rejouable · 1 requête répond · RTO chronométré`.
  - `restore-certificate.schema.json` — schéma JSON du certificat (contrat machine).
- **`lib/restore-drill/certificate.ts` (PUR)** :
  - type `RestoreCertificate` = `{ version, generatedAt, mode: "local" | "ci", dataset: "real" | "synthetic",
    checklist: { id, label, passed }[], rtoMinutes, integrityHash? }`.
  - `verifyCertificate(raw: unknown): Promise<RestoreVerdict>` — borne le JSON (anti-injection,
    `unknown` → garde de type, **jamais** de `as`), recalcule le hash canonique et le compare à
    `integrityHash`, agrège la checklist → `{ valid, integrityOk, allPassed, rtoMinutes, dataset, issues[] }`.
- **`lib/restore-drill/render.ts` (PUR)** — `renderCertificateMarkdown(verdict, resolve)` : rendu MD du
  certificat vérifié (verdict + checklist + RTO + dataset + disclaimer + empreinte).

### 2.3 Intégration

- **`lib/exit/bundle.ts`** : `buildExitBundle` fusionne `buildRestoreDrillKit(reco, manifest)` dans `files`
  (le kit voyage avec le bundle). Cohérence : le `restore-drill.sh` réutilise le `docker-compose.yml`,
  `scripts/re-embed.sh` et la cible RTO du runbook déjà générés.
- **`components/results/RestoreDrillPanel.tsx`** (client) : explique les 2 modes (chips/onglets),
  bouton de (re)génération+téléchargement du kit, et **zone de collage/upload** d'un
  `restore-certificate.json` → appelle `verifyCertificate` (Web Crypto isomorphe, côté client) → affiche
  le verdict (« drill réussi · RTO X min · données réelles/synthétiques · le DATE · intégrité ✓/✗ »).
  Monté dans `ResultsView` après `ExitEscrow`.
- **i18n** `Results.restoreDrill` fr/en/ar (parité stricte, accents majuscules FR, ICU).

### 2.4 Tests (Vitest)

- `kit.test.ts` — fichiers attendus présents, `DRILL.md` cite les 2 modes + la checklist, seed synthétique
  non vide, cohérence avec la reco (services référencés).
- `certificate.test.ts` — round-trip hash (certificat intègre → `integrityOk:true` ; altéré → `false`),
  JSON malformé/injection → garde de type rejette proprement, checklist agrégée correctement,
  `dataset` synthétique correctement signalé.
- `render.test.ts` — le MD contient verdict, RTO, dataset, disclaimer, empreinte.

## 3. S-095 — Preuve de résidence continue

### 3.1 Job

Prouver que les promesses de résidence **tiennent sur les 7 couches dans le temps** : drapeau si une
couche (backup, monitoring, réplica DR…) sort de la zone déclarée, avec base légale datée pour tout flux
inter-juridiction. Evidence pack opposable.

### 3.2 Modules

- **`lib/residency/continuity.ts` (PUR)** — `auditResidencyContinuity(reco, profile, now) → ResidencyContinuityReport` :
  - pour chaque composant pertinent (couches de la reco + destination backup + réplicas DR + monitoring),
    dérive sa **juridiction effective** (région) et la compare à la zone primaire du profil.
  - `flag` par composant : `ok | restreint | hors-zone`, dérivé de `lookupTransferBasis`
    (réutilise `lib/legal/transfers`) — `restricted`/`forbidden` → `restreint`/`hors-zone`,
    base légale datée portée telle quelle. **Jamais d'avis fabriqué** ; disclaimer « ingénierie, pas un
    avis juridique ».
  - report = `{ generatedAt, primaryRegion, components: { id, label, region, flag, legalBasis? }[],
    outOfZoneCount, summary }`. Pur, totale, `now` injecté.
- **`lib/residency/evidence.ts` (PUR)** — `buildResidencyEvidence(report) → { json, markdown, integrityHash }` :
  rendu opposable **haché + horodaté** (réutilise `computeIntegrityHash`). Ajouté au bundle Exit Escrow
  (`residency-evidence.md` + `residency-evidence.json`) → maillon de la chaîne.
- **Persistance (optionnelle, audit dans le temps)** :
  - migration `supabase/migrations/<ts>_residency_continuity_observations.sql` — table RLS pivot `circle`
    (jumelle de `transfer_status_observations`), colonnes `{ id, circle_id, primary_region,
    out_of_zone_count, components jsonb, integrity_hash, observed_at }`. **RLS=on** (deny par défaut,
    policies select/insert sur le circle). ⚠ Application **MANUELLE en prod** (hors-LAN → terminal web
    Coolify, one-liner base64) — fournie, pas auto au déploiement.
  - `lib/residency/continuity-observation.ts` (builder PUR) + `continuity-persist.ts` (`server-only`,
    service-role, **non bloquant**, jumeau de `regime-persist`).
  - route `POST /api/legal/residency-continuity` — recompute + persiste (gatée, non bloquante).
  - **La feature marche sans la migration** : audit live + evidence pack fonctionnent ; la persistance
    n'ajoute que la traçabilité de dérive.
- **`components/results/ResidencyContinuityPanel.tsx`** (client) : carte résidence **par couche**, drapeaux
  `ok/restreint/hors-zone` (pastilles), compteur hors-zone, base légale datée, bouton de téléchargement de
  l'evidence pack. Monté dans `ResultsView` à côté de `ResidencyPanel`. i18n `Results.residencyContinuity`
  fr/en/ar (parité).

### 3.3 Tests (Vitest)

- `continuity.test.ts` — composant hors-zone correctement flaggé ; tout-en-zone → `outOfZoneCount:0` ;
  flux restreint/interdit → `restreint`/`hors-zone` + base légale portée ; fonction pure/déterministe.
- `evidence.test.ts` — hash stable et re-vérifiable ; MD contient composants + drapeaux + disclaimer.
- `continuity-observation.test.ts` — builder mappe correctement vers la ligne DB.

## 4. Hors périmètre (YAGNI)

- Sandbox de restauration orchestrée **côté serveurs Strate** (vague 3).
- Signature authentifiée (HMAC/Ed25519) des certificats — l'intégrité SHA-256 auto-vérifiable suffit pour
  un artefact opposable horodaté (cf. note S-092 ; resterait un T2 optionnel).
- Alertes/notifications sur dérive de résidence (le panneau + la persistance suffisent à cette vague).

## 5. Qualité & livraison (non négociable)

- Par story : `typecheck` 0 · `lint` 0-0 (garde i18n) · tests verts · `build` OK · parité i18n ×3 ·
  commit `[S-09X] …` + `git push origin main` (auto-deploy code).
- ⚠ `messages/` hors `watch_paths` → **redéploiement manuel** après changement i18n.
- ⚠ Migration S-095 = **manuelle en prod** (one-liner base64 fourni), PAS auto au déploiement.
- Vérification prod après chaque déploiement (health 200 + route concernée).
