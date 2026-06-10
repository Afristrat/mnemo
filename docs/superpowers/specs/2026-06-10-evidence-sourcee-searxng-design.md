# Preuve sourcée par SearXNG (citations · drift externe · authenticité)

> Date : 2026-06-10 · Moat : `docs/MOAT-HUNT.md` § Vague 2 (« chaîne de preuve »). Étend les 7 artefacts
> opposables avec une **brique de preuve sourcée en ligne** (SearXNG `searxng-strate` + LLM kimi).
> Une seule spec couvre 3 features (A/B/C) bâties sur une brique commune ; le plan d'implémentation les
> séquencera en phases.

## 1. Intention

Aujourd'hui SearXNG alimente les *feeds* (prix, juridique, providers) mais la source brute (URL + date +
extrait) est **fondue** dans la reco : jamais conservée comme **maillon opposable** rattaché à une
affirmation précise. Trois besoins en découlent, partageant la même mécanique :

- **A — Citations sourcées** : chaque affirmation « dure » du livrable porte une citation horodatée +
  lien + pastille de confiance → « Strate ne recommande pas, il *prouve* ».
- **B — Drift externe** : pour chaque composant de la reco **signée**, surveiller le *monde* (changement
  matériel depuis la date de signature : juridiction, incident SLA, dépréciation, rachat).
- **C — Vérification d'authenticité externe** : croiser un artefact **client** (certif provider, page de
  statut, mention légale) avec ce que SearXNG trouve → `match | mismatch | unverifiable`.

**DÉFCON 1 (résolution fondatrice, identique aux 7 artefacts)** : Strate ne lit jamais l'infra ni ne
fabrique de source. Elle **outille** (SearXNG + extraction LLM bornée) et **scelle** un artefact daté,
sourcé, à confiance explicite. Rien trouvé → `unattested`/`unknown`/`unverifiable` **assumé**, jamais une
source inventée. Live → confiance `low` (conservateur, convention S-062) ; repli **seed daté** si l'I/O
échoue ; le seed n'est **jamais** persisté en audit.

## 2. Brique commune — `lib/evidence/` (PUR, server-only)

### 2.1 `lib/evidence/gather.ts`

```ts
export type EvidenceKind = "citation" | "external_drift" | "cross_check";

export type EvidenceClaim = {
  kind: EvidenceKind;
  subject: string;          // ex. « OVHcloud — juridiction de la donnée »
  query: string;            // requête SearXNG
  asOf?: string;            // B : date de signature ; borne la fenêtre « changement depuis »
  expected?: string;        // C : affirmation extraite de l'artefact client à vérifier
};

export type EvidenceSource = { url: string; title: string; snippet: string; retrievedAt: string };

export type EvidenceVerdict =
  | "attested" | "unattested"      // A
  | "stable" | "changed" | "unknown"   // B
  | "match" | "mismatch" | "unverifiable"; // C

export type SourcedEvidence = {
  claim: EvidenceClaim;
  sources: EvidenceSource[];
  verdict: EvidenceVerdict;
  confidence: "low" | "dated";     // live → low ; seed → dated
  provenance: "live" | "seed";
  rationale: string;               // 1 phrase bornée (sortie LLM contrôlée), jamais d'URL fabriquée
  generatedAt: string;             // injecté (pur)
};

export async function gatherSourcedEvidence(
  claim: EvidenceClaim,
  deps: ScrapeDeps,
  generatedAt: string,
): Promise<SourcedEvidence>;
```

- Flux : `searchWeb(claim.query, limit, deps)` → si `[]` → repli seed (`provenance:"seed"`, verdict
  conservateur : `unattested`/`unknown`/`unverifiable`). Sinon → `callLLM` avec un **prompt borné par
  `kind`** (rôle/règles/sortie JSON stricte) qui classe le verdict et sélectionne ≤ 3 sources **parmi les
  résultats SearXNG fournis** (anti-hallucination d'URL : toute URL hors liste est rejetée, calque
  `regime-discovery`).
- **Ne lève jamais.** Entrées `unknown` bornées par gardes de type (zéro `as`/`any`/`!`).
- Validateurs DÉFCON : `rationale` tronquée ; `sources[].url` ∈ résultats SearXNG ; `retrievedAt` =
  `generatedAt` (pas une date inventée par le LLM).

### 2.2 `lib/evidence/seed.ts`

Repli daté minimal par `kind` (jamais présenté comme « vrai » live — `provenance:"seed"`, confiance
`dated`). Pas de prix/statut fabriqué : le seed renvoie un verdict conservateur **sans source**, avec un
`rationale` du type « aucune source live disponible — repli, à reconfirmer ».

### 2.3 `lib/evidence/pack.ts`

```ts
export type EvidencePack = { json: string; markdown: string; integrityHash: string };
export async function buildEvidencePack(items: SourcedEvidence[], title: string): Promise<EvidencePack>;
```

Réutilise `sha256Hex` + `canonicalJson` (`lib/decision/integrity`). MD lisible (tableau affirmation /
verdict / confiance / sources) + JSON canonique + `sha256:<hash>` → maillon opposable, calque exact de
`lib/drift/evidence.ts`.

### 2.4 Persistance audit — migration `evidence_observations`

Une **seule** table (jumeau des `*_observations` existants), RLS activée, pivot `circle` :

```
evidence_observations(
  id uuid pk default gen_random_uuid(),
  circle_id uuid not null references circles(id),
  kind text not null check (kind in ('citation','external_drift','cross_check')),
  subject text not null,
  verdict text not null,
  confidence text not null,
  sources jsonb not null default '[]',
  integrity_hash text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
)
```

- RLS : policies `select`/`insert` scopées au cercle du membre (calque `regime_observations`).
- Persistance via le **client de session** (RLS appliquée — pas de bypass service-role, suit le
  durcissement S-089), **live-only** (gating `provenance==="live"`), **non bloquante** (échec silencieux).
- `lib/evidence/persist.ts` : builder pur + `persistEvidenceObservations(rows, deps)`.

## 3. Feature A — Citations sourcées vérifiables

- **Cible** : 4 familles d'affirmations **dures** (pas la prose, pas les scores déterministes) —
  **coût** (vendor pricing), **statut juridique** (régime/transfert), **SLA**, **existence provider**.
- `lib/evidence/citations.ts` : `buildClaimsForReco(reco) → EvidenceClaim[]` (mappe la reco → requêtes
  ciblées), puis `gatherSourcedEvidence` sur chacune. Verdict `attested` (≥ 1 source pertinente) /
  `unattested` (rien — affiché honnêtement).
- **Sortie** : `buildEvidencePack(items, "Sources & preuves")` ; injecté dans le livrable MD/PDF (nouvelle
  section « Sources & preuves ») via `lib/export/*` + panneau zone preuve.
- **Route** : `POST /api/evidence/citations` (`{profile}` → la reco est recalculée serveur, déterministe,
  comme la route `narrate`) → pack + persistance audit (live).

## 4. Feature B — Drift externe

- **Entrée** : `BundleManifest` (reco signée) + `asOf` (date de signature).
- `lib/evidence/external-drift.ts` : `buildExternalDriftClaims(manifest, asOf) → EvidenceClaim[]` (1 par
  composant signé : couches, providers, juridictions) ; chaque claim `kind:"external_drift"` interroge
  « changement matériel depuis `asOf` ? ». Verdict `stable | changed | unknown`.
- **Type de rapport** (jumeau « externe » de `reconcile.ts`, qui compare au live *rapporté*) :
  ```ts
  type ExternalDriftSignal = { subject: string; verdict: "stable"|"changed"|"unknown";
    sources: EvidenceSource[]; rationale: string; confidence: "low"|"dated" };
  type ExternalDriftReport = { generatedAt: string; signals: ExternalDriftSignal[];
    changedCount: number; unknownCount: number; inSync: boolean; disclaimer: string };
  ```
- **Déclenchement** : **à la demande** (bouton) dans ce lot. Branchement au scheduler 6 h existant
  (`instrumentation.ts`, comme vendor-watch S-084) = **hors périmètre de ce lot** (coût LLM + DÉFCON) —
  noté comme extension future.
- **Sortie** : `ExternalDriftReport` scellé (pack) + panneau ; chaque signal daté + sourcé + confiance.
- **Route** : `POST /api/evidence/external-drift` (`{manifest, asOf}`).

## 5. Feature C — Vérification d'authenticité externe

- **Entrée** : artefact **client collé** (texte/JSON ; certif provider, page de statut, mention légale) +
  type d'affirmation. Pattern « coller » identique à Restore Drill / Drift (pas d'upload de fichier dans
  ce lot).
- `lib/evidence/cross-check.ts` : `extractClaim(artefactRaw, type) → {expected, subject}` (bornage
  anti-injection) → `gatherSourcedEvidence({kind:"cross_check", expected})` → `match | mismatch |
  unverifiable`.
- **DÉFCON** : `mismatch` formulé « incohérence avec les sources publiques trouvées — à investiguer »
  (jamais « fraude » affirmée) ; `unverifiable` assumé.
- **Sortie** : verdict scellé (pack) + panneau.
- **Route** : `POST /api/evidence/cross-check` (`{artefact, type}`).

## 6. Affichage, livrable, i18n, sécurité

- **3 panneaux** dans la **zone preuve** de `ResultsView` (mode expert), au format des 7 artefacts
  (collage / vérif / scellé). Composants `components/results/Evidence*Panel.tsx`.
- **Livrable** : A → section « Sources & preuves » du MD/PDF ; B et C → evidence pack exportable séparé
  (comme Restore Drill / Drift aujourd'hui).
- **i18n fr/en/ar** : nouvelles clés sous `Evidence.*` (citations / externalDrift / crossCheck),
  parité stricte + ICU, arabe en MSA flaggé « à relire natif » (provenance seed).
- **Sécurité** : modules `server-only` (lisent SearXNG/LLM) ; `searchWeb` déjà borné `fetchWithTimeout` ;
  routes anonymes coûteuses → **rate-limiting** (calque du durcissement des routes anonymes de la vague 2) ;
  entrées bornées ;
  RLS sur `evidence_observations` ; jamais de secret hardcodé.

## 7. Tests

- **Unitaires (purs)** : `gather` (live mocké → verdict/sources ; `[]` → repli seed ; anti-hallucination
  d'URL ; bornage `unknown`), `seed`, `pack` (hash stable, MD/JSON), `citations`/`external-drift`/
  `cross-check` (mapping claims + verdicts), `persist` (live-only gating).
- **Routes** : 3 routes (succès live, repli seed, rate-limit).
- **RLS** : `evidence_observations` (select/insert scopés cercle ; deny cross-cercle).
- **e2e** : 3 panneaux (rendu, collage, scellé) desktop + mobile, gated si LLM/SearXNG indisponible.
- **DÉFCON** : un test prouve qu'aucune source hors résultats SearXNG ne survit, et que le seed n'est
  jamais persisté.

## 8. Hors périmètre (explicite)

- Scheduler automatique du drift externe (extension future, calque vendor-watch).
- Upload de fichier pour C (collage texte/JSON uniquement).
- Signature Ed25519 des evidence packs (intégrité par hash SHA-256 ; un pack peut être inclus dans un
  MBOM signé ultérieurement pour l'authenticité).
- Citations sur la prose / les scores calculés (déterministes — pas de sourçage externe pertinent).

## 9. Pattern réutilisé (cohérence chaîne de preuve)

Builder PUR → JSON canonique → empreinte SHA-256 (`lib/decision/integrity`) → render (MD/JSON) → panneau
collage/vérif/scellé. Feed live = `searchWeb` (SearXNG) → `callLLM` (kimi) → repli seed daté → cache/audit.
DÉFCON 1 : sourcer/vérifier, jamais fabriquer ; live = confiance `low` ; seed jamais persisté.
