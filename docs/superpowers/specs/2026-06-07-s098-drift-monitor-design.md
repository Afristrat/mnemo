# S-098 — Drift Monitor (moat « chaîne de preuve », vague 2 #7)

> Date : 2026-06-07 · Moat : `docs/MOAT-HUNT.md` § Vague 2 ligne #7. Dernier maillon de la chaîne de preuve.

## 1. Intention

Répondre à : **l’infrastructure déployée est-elle TOUJOURS la reco signée ?** Détecter la dérive entre
l’état *déclaré* (la reco signée) et l’état *vivant* (ce qui tourne réellement), et la **prouver**.

DÉFCON 1 (même résolution que Restore Drill / Résidence continue) : Strate **n’a pas accès** à l’infra
vivante du client. Elle compare **deux artefacts déclarés** :
- la **reco signée** = le manifeste Exit Escrow (`BundleManifest`, déjà produit + hachable) ;
- l’**état vivant rapporté** = un `live-state.json` que le client produit lui-même (commande
  d’introspection fournie). Strate ne lit jamais l’infra ; elle **réconcilie** et émet une preuve opposable.

## 2. Modèle (PUR)

`lib/drift/reconcile.ts` — `reconcileDrift(manifest, liveStateRaw, generatedAt) → DriftReport` :
- borne `liveStateRaw` (anti-injection, `unknown` → garde de type, jamais `as`). Forme attendue :
  `{ layers?: { id: number; choice: string }[]; regions?: string[] }`.
- pour chaque couche du manifeste (`manifest.layers[{id, name, choice}]`) :
  - absente du live → `missing` ;
  - présente, même `choice` → `aligned` ;
  - présente, `choice` différent → `drifted` (expected vs actual portés).
- couche live dont l’`id` n’est pas dans le manifeste → `unexpected`.
- **iso-contraintes** : `constraintViolations` — toute région de `liveState.regions` absente de
  l’ensemble signé (`manifest.residency.primaryRegion` + `manifest.residency.regions[].region`)
  → violation « région hors ensemble signé ». (Extensible : sortie de zone, composant non souverain.)
- types :
  ```ts
  type DriftStatus = "aligned" | "drifted" | "missing" | "unexpected";
  type DriftItem = { id: number; label: string; expected: string | null; actual: string | null; status: DriftStatus };
  type DriftReport = {
    generatedAt: string;
    items: DriftItem[];
    alignedCount: number;
    driftCount: number;        // drifted + missing + unexpected
    constraintViolations: string[];
    inSync: boolean;           // driftCount === 0 && constraintViolations.length === 0
    disclaimer: string;
  };
  ```
- pur, total, `generatedAt` injecté.

## 3. Evidence pack (PUR)

`lib/drift/evidence.ts` — `buildDriftEvidence(report) → { json, markdown, integrityHash }` (async, réutilise
`sha256Hex`/`canonicalJson` de `lib/decision/integrity`). Maillon opposable : tableau des items + violations
+ empreinte + disclaimer.

## 4. UI

`components/results/DriftMonitorPanel.tsx` (client) :
- explique le principe + **commande d’introspection à copier** (i18n, ex. `docker compose ps --format ...`
  → `live-state.json`) ;
- **zone de collage** du `live-state.json` → `reconcileDrift(manifest, parsed)` (manifeste = celui de la reco
  affichée, via `buildExitBundle(profile, reco).manifest`) → verdict (en sync / N écarts + violations, liste
  par couche) ;
- **téléchargement de l’evidence pack** (MD, horodaté + haché) ; persistance d’audit non requise (YAGNI).
- monté dans `ResultsView` près des autres panneaux de preuve. i18n `Results.driftMonitor` fr/en/ar.

## 5. Tests (Vitest)

- `reconcile.test.ts` — couche identique → aligned ; choix différent → drifted (expected/actual) ; couche
  manifeste absente du live → missing ; couche live inconnue → unexpected ; région hors ensemble signé →
  constraintViolation ; live vide → tout missing ; `inSync` correct ; JSON malformé/injection → garde rejette
  proprement (jamais throw) ; pur/déterministe.
- `evidence.test.ts` — hash stable + re-vérifiable ; MD contient items + violations + disclaimer.
- `DriftMonitorPanel.test.tsx` — rend l’en-tête + la zone de collage ; un live-state collé produit un verdict.

## 6. Hors périmètre (YAGNI)

- Lecture directe de l’infra par Strate (impossible/non souhaitable) ; introspection = côté client.
- Persistance d’audit serveur (le panneau + l’evidence pack suffisent à cette vague).
- Détection de dérive de version logicielle fine (on compare le `choice` de couche ; les versions exactes
  relèvent du MBOM).

## 7. Qualité & livraison

typecheck 0 · lint 0-0 (garde i18n) · tests verts · build OK · parité i18n ×3 · **e2e** vert · **vérif
navigateur** du panneau (rendu + un collage produit un verdict) · commit `[S-098]` + push (auto-deploy).
AR : aligné (clés/args ; MSA cohérente, à relire — décision standing).
