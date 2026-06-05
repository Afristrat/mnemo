# Vague 2 (suite) — Lock-in Meter (#4) + MBOM (#6)

> Date : 2026-06-05 · Stories : **S-096** (Lock-in / Exit-Cost Meter), **S-097** (MBOM).
> Moat : `docs/MOAT-HUNT.md` § « Vague 2 » lignes #4 et #6. Prolonge la chaîne de preuve
> (Decision Record S-092 → Exit Escrow → Restore Drill S-094 → Résidence continue S-095).

## 1. Intention

Deux artefacts qui complètent le récit « Strate ne recommande pas, il prouve » :
- **Lock-in Meter** : chiffre le **coût + le délai pour PARTIR** de chaque vendor, à côté du coût mensuel —
  rend visible l'asymétrie de sortie que les plateformes masquent (le moat est défensif).
- **MBOM** : manifeste **signé** (type SBOM) des ingrédients de la base mémorielle — couches, versions,
  provenance, sources, **checksums**, empreinte globale. Liste d'ingrédients vérifiable par un tiers.

**DÉFCON 1 transversal** : aucune valeur fabriquée. Egress chiffré uniquement depuis un vecteur **sourcé +
daté** ; frais d'API / engagement non sourcés → **« à confirmer »**, jamais inventés. Checksums **calculés**
(SHA-256), jamais simulés ; licences incluses seulement si connues.

## 2. S-096 — Lock-in / Exit-Cost Meter

### 2.1 Modèle (PUR)

`lib/exit-cost/meter.ts` — `computeExitCost(reco, residencyPrices) → ExitCost` :
- **egress de rapatriement** (one-shot, tout sortir) = `reco.sizing.storageGb` × `egressPerGb`, où
  `egressPerGb` = `selectEgressVector(residencyPrices, hostingClassForProfile(profile))` — `profile` dérivé
  via la même `hostingClass` que le moteur. Source datée portée (`egressVector.interRegionEgress.source`).
  Si la source est `null` (vecteur neutre / inconnu) → `egressPerGb` flaggé `unsourced`, montant non affiché.
- **frais d'API de sortie** : `apiFees: "unknown"` → libellé « à confirmer au contrat vendor » (jamais chiffré).
- **durée d'engagement mini** : `minCommitment: "unknown"` → « à confirmer au contrat vendor ».
- **intuition** : `monthsEquivalent` = `exitEgressCost / reco.totalCost` (arrondi 1 décimale) si `totalCost>0`,
  sinon `null` — « le coût de sortie ≈ N mois de service ».
- type :
  ```ts
  type ExitCost = {
    storageGb: number;
    egressPerGb: number;
    egressSourced: boolean;
    egressSource: { label: string; url: string; checkedAt: string } | null;
    exitEgressCost: number;       // €, one-shot
    monthlyCost: number;          // reco.totalCost, pour comparaison
    monthsEquivalent: number | null;
    apiFees: "unknown";
    minCommitment: "unknown";
    disclaimer: string;
  };
  ```
- Pur, total, prix injectés. `hostingClassForProfile`, `selectEgressVector`, `getResidencyPrices` déjà exportés.

### 2.2 UI

`components/results/ExitCostPanel.tsx` — affiche : coût d'egress de sortie (+ source datée + pastille de
confiance) ou « non sourcé » ; « ≈ N mois de service » ; frais API + engagement « à confirmer » ; disclaimer
« ±30 %, à confirmer au contrat vendor ». Monté dans `ResultsView` près de l'Exit Escrow. i18n
`Results.exitCost` fr/en/ar.

### 2.3 Tests

`meter.test.ts` — egress chiffré = storageGb × egressPerGb ; source datée portée ; vecteur sans source →
`egressSourced:false` ; `monthsEquivalent` cohérent ; `totalCost=0` → `null` ; pur/déterministe.

## 3. S-097 — MBOM (Memory-Base Bill of Materials)

### 3.1 Modèle

`lib/mbom/manifest.ts` — `buildMbom(bundle: ExitBundle): Promise<Mbom>` (async : checksums Web Crypto) :
- **composants** : dérivés de `bundle.manifest` — `layers` (id, name, choice) + `catalog?.slots`
  (component, provenance, sourceUrl) si présent. `licence: string | null` (null = à confirmer ; on
  n'invente pas).
- **fichiers** : pour chaque `[path, content]` de `bundle.files` → `{ path, sha256: await sha256Hex(content) }`.
- **empreinte globale** : `sha256Hex(canonicalJson({ components, files, generatedAt, product }))`.
- type :
  ```ts
  type MbomComponent = { layer: number | null; name: string; choice: string; provenance: string | null; sourceUrl: string | null; licence: string | null };
  type Mbom = {
    version: number;
    product: string;
    generatedAt: string;          // = bundle.manifest.generatedAt
    components: MbomComponent[];
    files: { path: string; sha256: string }[];
    integrityHash: string;
    disclaimer: string;
  };
  ```
- Réutilise `sha256Hex` + `canonicalJson` (exportés de `lib/decision/integrity`).

### 3.2 Rendu + UI

`lib/mbom/render.ts` (PUR) — `renderMbomMarkdown(mbom, t)` : tableau composants + tableau checksums +
empreinte + disclaimer. `components/results/MbomPanel.tsx` — bouton « Télécharger le MBOM (MD/JSON) » (build
bundle sync → `buildMbom` async → download) + résumé (n composants, n fichiers, empreinte). i18n
`Results.mbom` fr/en/ar. Monté près de l'Exit Escrow.

### 3.3 Tests

`manifest.test.ts` — un checksum par fichier du bundle ; hash global stable + re-vérifiable ; composants
dérivés des couches ; licence inconnue → null (jamais fabriquée). `render.test.ts` — MD contient composants,
checksums, empreinte, disclaimer.

## 4. Choix d'architecture (DÉFCON 1 + zéro régression)

- **MBOM hors `buildExitBundle`** : ce dernier est **synchrone**, les checksums sont **async** (Web Crypto).
  Le MBOM est donc un artefact **client async** (comme le Decision Record / le certificat de drill),
  construit à partir du bundle déjà généré → **aucune régression** sur l'Exit Escrow ni sur `EXPECTED_FILES`.
- Lock-in Meter : pur, prix injectés (mêmes vecteurs sourcés que le moteur résidence) → cohérence garantie.

## 5. Hors périmètre (YAGNI)

- Coût de sortie **par couche** (l'egress de la donnée domine ; le détail par composant exigerait des frais
  vendor non sourcés). Egress global one-shot suffit.
- Signature cryptographique authentifiée du MBOM (HMAC/Ed25519) — l'empreinte SHA-256 auto-vérifiable suffit.
- Versions logicielles exactes par composant (non sourcées de façon fiable) → champ omis, pas fabriqué.

## 6. Qualité & livraison (non négociable — zéro dette technique ET de validation)

- Par story : typecheck 0 · lint 0-0 (garde i18n) · tests verts · build OK · parité i18n ×3 · commit `[S-09X]`
  + `git push origin main`.
- **Vérification jusqu'au navigateur** des deux panneaux (Playwright, dev local — aucune écriture prod) :
  rendu + valeurs affichées cohérentes.
- Vérification prod après déploiement (health 200 + `/resultats` 200).
