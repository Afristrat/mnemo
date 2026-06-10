# Preuve sourcée par SearXNG — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Doter la chaîne de preuve d'une brique de preuve sourcée en ligne (SearXNG `searxng-strate` + LLM kimi) et l'exploiter en 3 features : citations sourcées (A), drift externe (B), vérification d'authenticité (C).

**Architecture:** Brique pure `lib/evidence/` (`gather` → SearXNG `searchWeb` + `callLLM` borné, repli seed daté, anti-hallucination d'URL ; `pack` → MD/JSON + SHA-256 ; `persist` → table `evidence_observations` RLS, live-only, non bloquant). Les 3 features sont des consommateurs : mapping reco/manifeste/artefact → `EvidenceClaim[]` → `gatherSourcedEvidence` → pack scellé + panneau + audit. Calque exact du pattern S-077 (`regime-discovery`/`regime-feed`/`regime-persist`) et S-098 (`drift/evidence`).

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict (zéro `any`/`as`/`!`), Supabase (RLS), Vitest, Playwright, next-intl (fr/en/ar parité). Backends auto-hébergés : SearXNG `searxng-strate:8080`, LiteLLM kimi.

**Conventions du repo (rappel) :**
- Tous les modules `lib/evidence/*` qui lisent SearXNG/LLM commencent par `import "server-only";`. Les modules **purs** (types, `gather` orchestration avec I/O injectée, `pack`, `seed`, builders) n'ont PAS besoin de `server-only` s'ils n'importent pas `scraper`/`llm/client` en valeur — calquer `regime-discovery.ts` (pur, I/O injectée) vs `regime-feed.ts` (`server-only`, branche l'I/O réelle).
- Commandes de validation : `npm run typecheck` (0 erreur), `npm run lint` (0/0), `npm test` (vert), `npm run build`.
- i18n : toute clé ajoutée à `messages/fr.json` DOIT l'être à `en.json` ET `ar.json` (garde de parité au lint). Arabe = MSA, flaggable « à relire natif ».
- Commits directs sur `main` (convention Ralph du repo).

---

## File Structure

**Brique commune (Phase 0)**
- Create `lib/evidence/types.ts` — types partagés (`EvidenceKind`, `EvidenceClaim`, `EvidenceSource`, `EvidenceVerdict`, `SourcedEvidence`).
- Create `lib/evidence/gather.ts` — `gatherSourcedEvidence` (PUR, I/O injectée : `search` + `llm`).
- Create `lib/evidence/seed.ts` — repli daté conservateur par `kind`.
- Create `lib/evidence/pack.ts` — `buildEvidencePack` (MD + JSON + SHA-256).
- Create `lib/evidence/observation.ts` — builder pur des lignes `evidence_observations`.
- Create `lib/evidence/persist.ts` — `persistEvidenceObservations` (`server-only`, live-only, non bloquant).
- Create `supabase/migrations/20260610120000_evidence_observations.sql` — table + RLS.
- Modify `lib/supabase/types.ts` — `EvidenceObservationRow`/`Insert` + entrée `Tables`.
- Tests : `lib/evidence/__tests__/{gather,seed,pack,persist}.test.ts`.

**Feature A — citations (Phase A)**
- Create `lib/evidence/citations.ts` — `buildClaimsForReco` + `gatherCitations`.
- Create `app/api/evidence/citations/route.ts`.
- Create `components/results/EvidenceCitationsPanel.tsx`.
- Modify `components/results/ResultsView.tsx` — monter le panneau (zone preuve, mode expert).
- Modify `messages/{fr,en,ar}.json` — namespace `Results.evidenceCitations`.
- Tests : `lib/evidence/__tests__/citations.test.ts`, `app/api/evidence/citations/__tests__/route.test.ts`.

**Feature B — drift externe (Phase B)**
- Create `lib/evidence/external-drift.ts` — `buildExternalDriftClaims` + `runExternalDrift` + type `ExternalDriftReport`.
- Create `app/api/evidence/external-drift/route.ts`.
- Create `components/results/ExternalDriftPanel.tsx`.
- Modify `components/results/ResultsView.tsx`, `messages/{fr,en,ar}.json` (`Results.externalDrift`).
- Tests : `lib/evidence/__tests__/external-drift.test.ts`, route test.

**Feature C — cross-check (Phase C)**
- Create `lib/evidence/cross-check.ts` — `extractClaim` + `runCrossCheck`.
- Create `app/api/evidence/cross-check/route.ts`.
- Create `components/results/CrossCheckPanel.tsx`.
- Modify `components/results/ResultsView.tsx`, `messages/{fr,en,ar}.json` (`Results.crossCheck`).
- Tests : `lib/evidence/__tests__/cross-check.test.ts`, route test.

**Phase E2E**
- Create `e2e/evidence.spec.ts` — 3 panneaux (rendu/collage/scellé), desktop + mobile, gated.

---

## PHASE 0 — Brique commune `lib/evidence/`

### Task 1 : Types partagés

**Files:** Create `lib/evidence/types.ts`

- [ ] **Step 1 : Écrire `lib/evidence/types.ts`** (pur, aucune I/O)

```ts
// Brique « preuve sourcée » (SearXNG + LLM) partagée par les 3 features de la chaîne de preuve :
// citations (A), drift externe (B), vérification d'authenticité (C). Types PURS, zéro I/O.

export type EvidenceKind = "citation" | "external_drift" | "cross_check";

/** Verdicts par kind. A : attested/unattested · B : stable/changed/unknown · C : match/mismatch/unverifiable. */
export type EvidenceVerdict =
  | "attested"
  | "unattested"
  | "stable"
  | "changed"
  | "unknown"
  | "match"
  | "mismatch"
  | "unverifiable";

export type EvidenceClaim = {
  kind: EvidenceKind;
  /** Libellé humain du sujet (ex. « OVHcloud — juridiction de la donnée »). */
  subject: string;
  /** Requête SearXNG (anglais conseillé : moteur). */
  query: string;
  /** B : date de signature de la reco — borne la fenêtre « changement depuis » (ISO court). */
  asOf?: string;
  /** C : affirmation extraite de l'artefact client à confronter aux sources publiques. */
  expected?: string;
};

export type EvidenceSource = { url: string; title: string; snippet: string; retrievedAt: string };

export type SourcedEvidence = {
  claim: EvidenceClaim;
  sources: EvidenceSource[];
  verdict: EvidenceVerdict;
  confidence: "low" | "dated"; // live → low (conservateur, S-062) ; seed → dated
  provenance: "live" | "seed";
  rationale: string; // 1 phrase bornée (sortie LLM contrôlée) ; jamais une URL fabriquée
  generatedAt: string; // ISO court, injecté (pur)
};

/** Verdict conservateur par kind (rien trouvé / repli). */
export const FALLBACK_VERDICT: Record<EvidenceKind, EvidenceVerdict> = {
  citation: "unattested",
  external_drift: "unknown",
  cross_check: "unverifiable",
};
```

- [ ] **Step 2 : Vérifier le typecheck**

Run: `npm run typecheck`
Expected: PASS (0 erreur).

- [ ] **Step 3 : Commit**

```bash
git add lib/evidence/types.ts
git commit -m "[evidence] brique commune : types preuve sourcée

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2 : Repli seed (`seed.ts`)

**Files:** Create `lib/evidence/seed.ts` ; Test `lib/evidence/__tests__/seed.test.ts`

- [ ] **Step 1 : Écrire le test `lib/evidence/__tests__/seed.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { seedEvidence } from "../seed";
import type { EvidenceClaim } from "../types";

const claim: EvidenceClaim = { kind: "citation", subject: "OVH", query: "ovh pricing" };

describe("seedEvidence", () => {
  it("renvoie un repli daté conservateur SANS source (DÉFCON : rien d'inventé)", () => {
    const ev = seedEvidence(claim, "2026-06-10");
    expect(ev.provenance).toBe("seed");
    expect(ev.confidence).toBe("dated");
    expect(ev.sources).toEqual([]);
    expect(ev.verdict).toBe("unattested"); // FALLBACK_VERDICT.citation
    expect(ev.generatedAt).toBe("2026-06-10");
    expect(ev.rationale.length).toBeGreaterThan(0);
  });

  it("verdict conservateur par kind", () => {
    expect(seedEvidence({ ...claim, kind: "external_drift" }, "2026-06-10").verdict).toBe("unknown");
    expect(seedEvidence({ ...claim, kind: "cross_check" }, "2026-06-10").verdict).toBe("unverifiable");
  });
});
```

- [ ] **Step 2 : Lancer le test → échec**

Run: `npm test -- lib/evidence/__tests__/seed.test.ts`
Expected: FAIL (`seedEvidence` introuvable).

- [ ] **Step 3 : Écrire `lib/evidence/seed.ts`**

```ts
// Repli daté de la preuve sourcée : aucune source live disponible (SearXNG/LLM KO ou vide). DÉFCON 1 :
// on ne fabrique RIEN — verdict conservateur par kind, zéro source, confiance `dated`, provenance `seed`.
// Le seed n'est JAMAIS persisté en audit (cf. persist.ts). Pur.

import { FALLBACK_VERDICT, type EvidenceClaim, type SourcedEvidence } from "./types";

export function seedEvidence(claim: EvidenceClaim, generatedAt: string): SourcedEvidence {
  return {
    claim,
    sources: [],
    verdict: FALLBACK_VERDICT[claim.kind],
    confidence: "dated",
    provenance: "seed",
    rationale: "Aucune source publique disponible au relevé (repli) — à reconfirmer en ligne.",
    generatedAt,
  };
}
```

- [ ] **Step 4 : Lancer le test → succès**

Run: `npm test -- lib/evidence/__tests__/seed.test.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add lib/evidence/seed.ts lib/evidence/__tests__/seed.test.ts
git commit -m "[evidence] repli seed daté conservateur (DÉFCON : zéro source fabriquée)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3 : Cœur `gather.ts` (PUR, I/O injectée)

**Files:** Create `lib/evidence/gather.ts` ; Test `lib/evidence/__tests__/gather.test.ts`

Calque `lib/legal/regime-discovery.ts` : I/O injectée (`search` + `llm`), anti-hallucination d'URL (toute source citée DOIT ∈ résultats SearXNG), ne lève jamais, `[]`/KO → repli seed.

- [ ] **Step 1 : Écrire le test `lib/evidence/__tests__/gather.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import { gatherSourcedEvidence } from "../gather";
import type { EvidenceClaim } from "../types";
import type { WebSearchResult } from "@/lib/pricing/scraper";
import type { LlmResult } from "@/lib/llm";

const claim: EvidenceClaim = { kind: "citation", subject: "OVH juridiction", query: "ovh data jurisdiction" };
const results: WebSearchResult[] = [
  { title: "OVH legal", url: "https://ovh.com/legal", snippet: "data hosted in EU" },
  { title: "Blog", url: "https://blog.example/ovh", snippet: "opinion" },
];

function deps(search: WebSearchResult[], llmContent: string) {
  return {
    search: vi.fn(async () => search),
    llm: vi.fn(async (): Promise<LlmResult> => ({ ok: true, content: llmContent })),
  };
}

describe("gatherSourcedEvidence", () => {
  it("classe le verdict et ne garde que les URLs ∈ résultats SearXNG (anti-hallucination)", async () => {
    const llm = JSON.stringify({
      verdict: "attested",
      rationale: "OVH héberge la donnée en UE.",
      sourceUrls: ["https://ovh.com/legal", "https://hallucinated.example/fake"],
    });
    const ev = await gatherSourcedEvidence(claim, deps(results, llm), "2026-06-10");
    expect(ev.provenance).toBe("live");
    expect(ev.confidence).toBe("low");
    expect(ev.verdict).toBe("attested");
    expect(ev.sources.map((s) => s.url)).toEqual(["https://ovh.com/legal"]); // la fausse URL est rejetée
    expect(ev.sources[0]?.retrievedAt).toBe("2026-06-10"); // date injectée, pas celle du LLM
  });

  it("recherche vide → repli seed", async () => {
    const ev = await gatherSourcedEvidence(claim, deps([], "{}"), "2026-06-10");
    expect(ev.provenance).toBe("seed");
    expect(ev.verdict).toBe("unattested");
  });

  it("LLM KO → repli seed", async () => {
    const d = { search: vi.fn(async () => results), llm: vi.fn(async (): Promise<LlmResult> => ({ ok: false, reason: "x" })) };
    const ev = await gatherSourcedEvidence(claim, d, "2026-06-10");
    expect(ev.provenance).toBe("seed");
  });

  it("verdict LLM invalide pour le kind → repli verdict conservateur, mais provenance live si sources valides", async () => {
    const llm = JSON.stringify({ verdict: "banana", rationale: "x", sourceUrls: ["https://ovh.com/legal"] });
    const ev = await gatherSourcedEvidence(claim, deps(results, llm), "2026-06-10");
    expect(ev.verdict).toBe("unattested"); // verdict hors set du kind → fallback conservateur
    expect(ev.provenance).toBe("live");
  });

  it("ne lève jamais (search throw → seed)", async () => {
    const d = { search: vi.fn(async () => { throw new Error("net"); }), llm: vi.fn(async (): Promise<LlmResult> => ({ ok: true, content: "{}" })) };
    const ev = await gatherSourcedEvidence(claim, d, "2026-06-10");
    expect(ev.provenance).toBe("seed");
  });
});
```

- [ ] **Step 2 : Lancer le test → échec**

Run: `npm test -- lib/evidence/__tests__/gather.test.ts`
Expected: FAIL (`gatherSourcedEvidence` introuvable).

- [ ] **Step 3 : Écrire `lib/evidence/gather.ts`**

```ts
// Cœur de la preuve sourcée (PUR, I/O injectée — calque regime-discovery.ts). Flux :
//   SearXNG (search) → si vide → repli seed ; sinon → LLM borné → JSON {verdict, rationale, sourceUrls}.
// DÉFCON 1 : (1) toute URL citée DOIT ∈ résultats SearXNG (anti-hallucination) ; (2) verdict contraint
// au set autorisé du kind, sinon fallback conservateur ; (3) retrievedAt = date injectée (pas le LLM) ;
// (4) ne lève jamais → repli seed. Confiance live = `low`.

import type { LlmMessage, LlmResult } from "@/lib/llm";
import type { WebSearchResult } from "@/lib/pricing/scraper";
import { seedEvidence } from "./seed";
import {
  FALLBACK_VERDICT,
  type EvidenceClaim,
  type EvidenceKind,
  type EvidenceSource,
  type EvidenceVerdict,
  type SourcedEvidence,
} from "./types";

export type GatherDeps = {
  search: (query: string, limit: number) => Promise<WebSearchResult[]>;
  llm: (messages: LlmMessage[]) => Promise<LlmResult>;
  /** Prompt système surchargeable (S-053) ; repli sur le gabarit par kind. */
  systemPrompt?: string;
};

/** Verdicts autorisés par kind (contrainte DÉFCON sur la sortie LLM). */
const VERDICTS_BY_KIND: Record<EvidenceKind, readonly EvidenceVerdict[]> = {
  citation: ["attested", "unattested"],
  external_drift: ["stable", "changed", "unknown"],
  cross_check: ["match", "mismatch", "unverifiable"],
};

const SYSTEM_BY_KIND: Record<EvidenceKind, string> = {
  citation:
    "ROLE: evidence checker. From the web results, decide if the CLAIM is attested by a credible public source. " +
    "Return ONLY JSON {verdict: 'attested'|'unattested', rationale: string (1 sentence), sourceUrls: string[]}. " +
    "Cite ONLY urls present in the results. Never invent a url or a fact.",
  external_drift:
    "ROLE: change watcher. Decide if a MATERIAL change happened to the subject SINCE the given date (jurisdiction, " +
    "SLA incident, deprecation, acquisition). Return ONLY JSON {verdict: 'stable'|'changed'|'unknown', rationale: " +
    "string (1 sentence), sourceUrls: string[]}. Cite ONLY urls present in the results. Never invent.",
  cross_check:
    "ROLE: authenticity cross-checker. Compare the EXPECTED claim (from a client artefact) with public web results. " +
    "Return ONLY JSON {verdict: 'match'|'mismatch'|'unverifiable', rationale: string (1 sentence), sourceUrls: string[]}. " +
    "'mismatch' = inconsistent with public sources (NOT a fraud accusation). Cite ONLY urls present in the results.",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function parseVerdict(value: unknown, kind: EvidenceKind): EvidenceVerdict {
  const allowed = VERDICTS_BY_KIND[kind];
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as EvidenceVerdict)
    : FALLBACK_VERDICT[kind];
}

/** Garde les URLs LLM qui existent réellement dans les résultats SearXNG (anti-hallucination). */
function keepRealSources(
  urls: unknown,
  results: readonly WebSearchResult[],
  retrievedAt: string,
): EvidenceSource[] {
  if (!Array.isArray(urls)) return [];
  const out: EvidenceSource[] = [];
  const seen = new Set<string>();
  for (const u of urls) {
    if (typeof u !== "string") continue;
    const match = results.find((r) => r.url === u);
    if (match === undefined || seen.has(u)) continue;
    seen.add(u);
    out.push({ url: match.url, title: match.title, snippet: match.snippet, retrievedAt });
  }
  return out;
}

export async function gatherSourcedEvidence(
  claim: EvidenceClaim,
  deps: GatherDeps,
  generatedAt: string,
): Promise<SourcedEvidence> {
  try {
    const results = await deps.search(claim.query, 8);
    if (results.length === 0) return seedEvidence(claim, generatedAt);

    const sourcesBlock = results.map((r, i) => `[${i + 1}] ${r.title} — ${r.url}\n${r.snippet}`).join("\n");
    const asOf = claim.asOf !== undefined ? `\nSINCE DATE: ${claim.asOf}` : "";
    const expected = claim.expected !== undefined ? `\nEXPECTED CLAIM: ${claim.expected}` : "";
    const user = `SUBJECT: ${claim.subject}${asOf}${expected}\nWeb results:\n${sourcesBlock}`;
    const messages: LlmMessage[] = [
      { role: "system", content: deps.systemPrompt ?? SYSTEM_BY_KIND[claim.kind] },
      { role: "user", content: user },
    ];

    const r = await deps.llm(messages);
    if (!r.ok) return seedEvidence(claim, generatedAt);

    const json = extractJson(r.content);
    if (!isRecord(json)) return seedEvidence(claim, generatedAt);

    const sources = keepRealSources(json.sourceUrls, results, generatedAt);
    const rationale = typeof json.rationale === "string" ? json.rationale.slice(0, 280) : "";
    return {
      claim,
      sources,
      verdict: parseVerdict(json.verdict, claim.kind),
      confidence: "low",
      provenance: "live",
      rationale,
      generatedAt,
    };
  } catch {
    return seedEvidence(claim, generatedAt);
  }
}
```

- [ ] **Step 4 : Lancer le test → succès**

Run: `npm test -- lib/evidence/__tests__/gather.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5 : typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: 0 erreur.

- [ ] **Step 6 : Commit**

```bash
git add lib/evidence/gather.ts lib/evidence/__tests__/gather.test.ts
git commit -m "[evidence] gather : SearXNG+LLM borné, anti-hallucination d'URL, repli seed

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4 : Pack scellé (`pack.ts`)

**Files:** Create `lib/evidence/pack.ts` ; Test `lib/evidence/__tests__/pack.test.ts`

Calque `lib/drift/evidence.ts` : réutilise `sha256Hex`/`canonicalJson` de `lib/decision/integrity`.

- [ ] **Step 1 : Écrire le test `lib/evidence/__tests__/pack.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { buildEvidencePack } from "../pack";
import type { SourcedEvidence } from "../types";

const items: SourcedEvidence[] = [
  {
    claim: { kind: "citation", subject: "OVH juridiction", query: "ovh" },
    sources: [{ url: "https://ovh.com/legal", title: "OVH legal", snippet: "EU", retrievedAt: "2026-06-10" }],
    verdict: "attested",
    confidence: "low",
    provenance: "live",
    rationale: "Hébergé en UE.",
    generatedAt: "2026-06-10",
  },
];

describe("buildEvidencePack", () => {
  it("produit MD + JSON + hash SHA-256 stable (64 hex)", async () => {
    const pack = await buildEvidencePack(items, "Sources & preuves");
    expect(pack.integrityHash).toMatch(/^[0-9a-f]{64}$/);
    expect(pack.markdown).toContain("Sources & preuves");
    expect(pack.markdown).toContain("OVH juridiction");
    expect(pack.markdown).toContain("https://ovh.com/legal");
    expect(pack.json).toContain("integrityHash");
  });

  it("hash déterministe (même entrée → même hash)", async () => {
    const a = await buildEvidencePack(items, "T");
    const b = await buildEvidencePack(items, "T");
    expect(a.integrityHash).toBe(b.integrityHash);
  });
});
```

- [ ] **Step 2 : Lancer le test → échec**

Run: `npm test -- lib/evidence/__tests__/pack.test.ts`
Expected: FAIL.

- [ ] **Step 3 : Écrire `lib/evidence/pack.ts`**

```ts
// Evidence pack de la preuve sourcée — fige une liste de SourcedEvidence en MD + JSON + empreinte SHA-256
// → maillon opposable de la chaîne de preuve. Réutilise sha256Hex/canonicalJson (lib/decision/integrity).
// Calque lib/drift/evidence.ts. Pur (le hash via Web Crypto isomorphe).

import { canonicalJson, sha256Hex } from "@/lib/decision/integrity";
import type { EvidenceVerdict, SourcedEvidence } from "./types";

const VERDICT_LABEL: Record<EvidenceVerdict, string> = {
  attested: "✅ attesté",
  unattested: "◻️ non attesté",
  stable: "✅ stable",
  changed: "⚠️ changement",
  unknown: "❔ inconnu",
  match: "✅ cohérent",
  mismatch: "⚠️ incohérent",
  unverifiable: "◻️ invérifiable",
};

export type EvidencePack = { json: string; markdown: string; integrityHash: string };

export async function buildEvidencePack(items: SourcedEvidence[], title: string): Promise<EvidencePack> {
  const payload = { title, items, count: items.length };
  const integrityHash = await sha256Hex(canonicalJson(payload));

  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`> Preuve sourcée (SearXNG + LLM) — confiance live « faible » par prudence, repli daté sinon. Une IA peut se tromper : vérifiez les sources citées.`);
  lines.push("");
  lines.push(`- **Éléments** : ${items.length}`);
  lines.push(`- **Intégrité** : \`sha256:${integrityHash}\``);
  lines.push("");
  for (const ev of items) {
    lines.push(`## ${ev.claim.subject}`);
    lines.push(`- **Verdict** : ${VERDICT_LABEL[ev.verdict]} · **confiance** : ${ev.confidence} · **provenance** : ${ev.provenance}`);
    if (ev.rationale.length > 0) lines.push(`- ${ev.rationale}`);
    if (ev.sources.length > 0) {
      lines.push("- **Sources** :");
      for (const s of ev.sources) lines.push(`  - [${s.title || s.url}](${s.url}) — relevé ${s.retrievedAt}`);
    } else {
      lines.push("- _Aucune source publique au relevé._");
    }
    lines.push("");
  }

  return {
    json: JSON.stringify({ ...payload, integrityHash }, null, 2) + "\n",
    markdown: lines.join("\n"),
    integrityHash,
  };
}
```

- [ ] **Step 4 : Lancer le test → succès**

Run: `npm test -- lib/evidence/__tests__/pack.test.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add lib/evidence/pack.ts lib/evidence/__tests__/pack.test.ts
git commit -m "[evidence] pack scellé MD/JSON + SHA-256 (maillon opposable)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5 : Migration `evidence_observations` + types Supabase

**Files:** Create `supabase/migrations/20260610120000_evidence_observations.sql` ; Modify `lib/supabase/types.ts`

- [ ] **Step 1 : Écrire la migration**

```sql
-- Audit trail de la preuve sourcée (brique lib/evidence) : une ligne par SourcedEvidence issu d'une veille
-- LIVE (SearXNG + LLM). Sert la traçabilité DÉFCON 1 (jamais une preuve sans date + verdict + provenance).
-- On ne logue QUE le live (le repli seed n'est pas une observation). Jumeau de regime_observations (S-077).
-- RLS ACTIVÉE (règle absolue). Pivot multi-tenant circle_id (null si anonyme). Helper is_circle_member (init_rails).

create table public.evidence_observations (
  id             uuid primary key default gen_random_uuid(),
  circle_id      uuid references public.circles (id) on delete set null,
  created_by     uuid references auth.users (id) on delete set null,
  kind           text not null check (kind in ('citation', 'external_drift', 'cross_check')),
  subject        text not null,
  verdict        text not null,
  confidence     text not null check (confidence in ('low', 'dated')),
  provenance     text not null check (provenance in ('live', 'seed')),
  sources        jsonb not null default '[]'::jsonb,   -- [{url,title,snippet,retrievedAt}]
  integrity_hash text,                                 -- SHA-256 du pack (si scellé en lot)
  generated_at   text not null,                        -- date de relevé (ISO court)
  created_at     timestamptz not null default now()
);
create index on public.evidence_observations (circle_id);
create index on public.evidence_observations (created_at);

alter table public.evidence_observations enable row level security;

-- Insert ouvert (anon + authenticated) ; si circle_id fourni, l'auteur doit être membre.
create policy evidence_obs_insert on public.evidence_observations for insert to anon, authenticated
  with check (circle_id is null or public.is_circle_member(circle_id));
-- Lecture réservée aux membres du cercle.
create policy evidence_obs_select on public.evidence_observations for select to authenticated
  using (circle_id is not null and public.is_circle_member(circle_id));
```

- [ ] **Step 2 : Étendre `lib/supabase/types.ts`** — ajouter Row/Insert après `RegimeObservationInsert` (vers ligne 214)

```ts
// Audit trail de la preuve sourcée (brique lib/evidence). sources = JSON [{url,title,snippet,retrievedAt}].
// Unions (kind/confidence/provenance) garanties par les CHECK SQL ; `string` côté TS (le builder injecte le typé).
export type EvidenceObservationRow = {
  id: string;
  circle_id: string | null;
  created_by: string | null;
  kind: string;
  subject: string;
  verdict: string;
  confidence: string;
  provenance: string;
  sources: unknown;
  integrity_hash: string | null;
  generated_at: string;
  created_at: string;
};
export type EvidenceObservationInsert = {
  circle_id: string | null;
  created_by: string | null;
  kind: string;
  subject: string;
  verdict: string;
  confidence: string;
  provenance: string;
  sources: unknown;
  integrity_hash: string | null;
  generated_at: string;
};
```

- [ ] **Step 3 : Enregistrer la table dans `Tables`** (vers ligne 420, après `regime_observations`)

```ts
      evidence_observations: TableShape<EvidenceObservationRow, EvidenceObservationInsert>;
```

- [ ] **Step 4 : typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5 : Commit** (migration NON appliquée en prod ici — appliquée manuellement en fin de phase, cf. note)

```bash
git add supabase/migrations/20260610120000_evidence_observations.sql lib/supabase/types.ts
git commit -m "[evidence] migration evidence_observations (RLS, pivot circle) + types

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> **Note migration prod (manuelle, à faire avant d'activer la persistance en prod, on-LAN) :**
> `cat supabase/migrations/20260610120000_evidence_observations.sql | ssh -i ~/.ssh/serveurai_mnemo serveurai@192.168.100.8 'docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1'`
> Vérifier : `relrowsecurity=t` + 2 policies sur `evidence_observations`.

---

### Task 6 : Builder + persistance (`observation.ts` + `persist.ts`)

**Files:** Create `lib/evidence/observation.ts`, `lib/evidence/persist.ts` ; Test `lib/evidence/__tests__/persist.test.ts`

- [ ] **Step 1 : Écrire `lib/evidence/observation.ts`** (pur — calque `regime-observation.ts`)

```ts
// Builder PUR des lignes evidence_observations (une par SourcedEvidence). L'insertion (et le respect RLS)
// se fait côté appelant (persist.ts). On ne construit QUE le live (le seed daté n'est pas une observation).

import type { EvidenceObservationInsert } from "@/lib/supabase/types";
import type { SourcedEvidence } from "./types";

export function buildEvidenceObservations(args: {
  items: SourcedEvidence[];
  integrityHash?: string | null;
  circleId?: string | null;
  createdBy?: string | null;
}): EvidenceObservationInsert[] {
  return args.items.map((ev): EvidenceObservationInsert => ({
    circle_id: args.circleId ?? null,
    created_by: args.createdBy ?? null,
    kind: ev.claim.kind,
    subject: ev.claim.subject,
    verdict: ev.verdict,
    confidence: ev.confidence,
    provenance: ev.provenance,
    sources: ev.sources,
    integrity_hash: args.integrityHash ?? null,
    generated_at: ev.generatedAt,
  }));
}
```

- [ ] **Step 2 : Écrire le test `lib/evidence/__tests__/persist.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import { persistEvidenceObservations } from "../persist";
import type { SourcedEvidence } from "../types";

function ev(provenance: "live" | "seed"): SourcedEvidence {
  return {
    claim: { kind: "citation", subject: "OVH", query: "ovh" },
    sources: [], verdict: "attested", confidence: provenance === "live" ? "low" : "dated",
    provenance, rationale: "x", generatedAt: "2026-06-10",
  };
}

function fakeClient(insert: ReturnType<typeof vi.fn>) {
  return { from: vi.fn(() => ({ insert })) };
}

describe("persistEvidenceObservations", () => {
  it("n'écrit QUE le live (le seed n'est pas une observation)", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    // @ts-expect-error client minimal de test
    const n = await persistEvidenceObservations([ev("live"), ev("seed")], { client: fakeClient(insert) });
    expect(n).toBe(1);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("aucun live → 0, pas d'insert", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    // @ts-expect-error client minimal de test
    const n = await persistEvidenceObservations([ev("seed")], { client: fakeClient(insert) });
    expect(n).toBe(0);
    expect(insert).not.toHaveBeenCalled();
  });

  it("erreur Supabase → 0, jamais throw", async () => {
    const insert = vi.fn(async () => ({ error: { message: "boom" } }));
    // @ts-expect-error client minimal de test
    const n = await persistEvidenceObservations([ev("live")], { client: fakeClient(insert) });
    expect(n).toBe(0);
  });
});
```

- [ ] **Step 3 : Lancer le test → échec**

Run: `npm test -- lib/evidence/__tests__/persist.test.ts`
Expected: FAIL.

- [ ] **Step 4 : Écrire `lib/evidence/persist.ts`** (`server-only` — calque `regime-persist.ts`)

```ts
// Persistance de l'audit de preuve sourcée — SERVEUR UNIQUEMENT. Insère le LIVE dans evidence_observations
// (RLS, pivot circle). Gatée « live seulement », jamais bloquante, jamais throw. Jumeau de regime-persist.

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { buildEvidenceObservations } from "./observation";
import type { SourcedEvidence } from "./types";

type Deps = {
  client?: SupabaseClient<Database> | null;
  circleId?: string | null;
  createdBy?: string | null;
  integrityHash?: string | null;
};

export async function persistEvidenceObservations(items: SourcedEvidence[], deps: Deps = {}): Promise<number> {
  const live = items.filter((ev) => ev.provenance === "live");
  if (live.length === 0) return 0;
  const client = deps.client ?? createAdminClient();
  if (client === null) return 0;
  const rows = buildEvidenceObservations({
    items: live,
    integrityHash: deps.integrityHash,
    circleId: deps.circleId,
    createdBy: deps.createdBy,
  });
  try {
    const { error } = await client.from("evidence_observations").insert(rows);
    return error === null ? rows.length : 0;
  } catch {
    return 0;
  }
}
```

- [ ] **Step 5 : Lancer le test → succès, puis typecheck/lint**

Run: `npm test -- lib/evidence/__tests__/persist.test.ts && npm run typecheck && npm run lint`
Expected: PASS, 0 erreur.

- [ ] **Step 6 : Commit**

```bash
git add lib/evidence/observation.ts lib/evidence/persist.ts lib/evidence/__tests__/persist.test.ts
git commit -m "[evidence] builder + persistance audit (live-only, RLS, non bloquant)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

**✅ Fin Phase 0 — brique commune prête.**

---

## PHASE A — Citations sourcées vérifiables

### Task 7 : Mapping reco → claims + orchestration (`citations.ts`)

**Files:** Create `lib/evidence/citations.ts` ; Test `lib/evidence/__tests__/citations.test.ts`

Cible les 4 familles dures : **coût** (par couche tarifée), **statut juridique** (régimes du profil), **SLA** (classe d'hébergement), **existence provider** (composant recommandé par couche). Le mapping lit la `Recommendation` (et le `Profile` pour les régimes).

- [ ] **Step 1 : Écrire le test `lib/evidence/__tests__/citations.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import { buildClaimsForReco, gatherCitations } from "../citations";
import { recommend } from "@/lib/engine";
import { defaultProfile } from "@/lib/engine";
import type { LlmResult } from "@/lib/llm";
import type { WebSearchResult } from "@/lib/pricing/scraper";

const profile = defaultProfile();
const reco = recommend(profile);

describe("buildClaimsForReco", () => {
  it("produit des claims de kind 'citation' couvrant coût/juridique/SLA/provider", () => {
    const claims = buildClaimsForReco(profile, reco);
    expect(claims.length).toBeGreaterThan(0);
    expect(claims.every((c) => c.kind === "citation")).toBe(true);
    expect(claims.every((c) => c.query.length > 0 && c.subject.length > 0)).toBe(true);
  });
});

describe("gatherCitations", () => {
  it("orchestre gather sur chaque claim et renvoie des SourcedEvidence", async () => {
    const results: WebSearchResult[] = [{ title: "T", url: "https://x.example", snippet: "s" }];
    const deps = {
      search: vi.fn(async () => results),
      llm: vi.fn(async (): Promise<LlmResult> => ({ ok: true, content: JSON.stringify({ verdict: "attested", rationale: "ok", sourceUrls: ["https://x.example"] }) })),
    };
    const items = await gatherCitations(profile, reco, deps, "2026-06-10");
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]?.claim.kind).toBe("citation");
  });
});
```

> ⚠️ Vérifier les vrais noms d'export du moteur avant d'écrire (`recommend`, `defaultProfile`) :
> `grep -n "export" lib/engine/index.ts | grep -iE "recommend|defaultProfile|Recommendation|Profile"`.
> Adapter l'import si besoin (ex. fabrique de profil de test existante dans `lib/engine/__tests__`).

- [ ] **Step 2 : Lancer le test → échec**

Run: `npm test -- lib/evidence/__tests__/citations.test.ts`
Expected: FAIL.

- [ ] **Step 3 : Écrire `lib/evidence/citations.ts`**

```ts
// Feature A — citations sourcées vérifiables. Mappe une Recommendation (+ Profile pour les régimes) vers des
// EvidenceClaim « citation » sur les 4 familles d'affirmations DURES (coût, juridique, SLA, existence provider),
// puis orchestre gatherSourcedEvidence sur chacune. PUR (I/O injectée via GatherDeps). Pas la prose/les scores.

import type { Profile, Recommendation } from "@/lib/engine";
import { gatherSourcedEvidence, type GatherDeps } from "./gather";
import type { EvidenceClaim, SourcedEvidence } from "./types";

/** Construit les claims « citation » à partir de la reco + profil. Pur, total. */
export function buildClaimsForReco(profile: Profile, reco: Recommendation): EvidenceClaim[] {
  const claims: EvidenceClaim[] = [];

  // 1) Existence + coût du composant recommandé de chaque couche tarifée.
  for (const layer of reco.layers) {
    if (layer.choice.trim() === "") continue;
    claims.push({
      kind: "citation",
      subject: `${layer.choice} — existence & offre`,
      query: `${layer.choice} official product pricing 2026`,
    });
  }

  // 2) Statut juridique : un claim par régime du profil.
  for (const reg of profile.regulations) {
    claims.push({
      kind: "citation",
      subject: `Régime ${reg} — statut en vigueur`,
      query: `${reg} data protection regulation in force 2026 official`,
    });
  }

  // 3) SLA de la classe d'hébergement (zone du profil).
  claims.push({
    kind: "citation",
    subject: `SLA hébergement — zone ${profile.zone}`,
    query: `cloud provider SLA availability guarantee ${profile.zone} 2026`,
  });

  return claims;
}

/** Orchestration : gather sur chaque claim (séquentiel — coût LLM maîtrisé). Ne lève jamais (gather replie). */
export async function gatherCitations(
  profile: Profile,
  reco: Recommendation,
  deps: GatherDeps,
  generatedAt: string,
): Promise<SourcedEvidence[]> {
  const claims = buildClaimsForReco(profile, reco);
  const out: SourcedEvidence[] = [];
  for (const claim of claims) {
    out.push(await gatherSourcedEvidence(claim, deps, generatedAt));
  }
  return out;
}
```

> ⚠️ Adapter les accès `reco.layers[].choice`, `profile.regulations`, `profile.zone` aux vrais champs
> (déjà confirmés dans `lib/export/model.ts` : `reco.layers` a `name/choice/cost`, `profile.regulations`,
> `profile.zone` existent). Vérifier au typecheck.

- [ ] **Step 4 : Lancer le test → succès, puis typecheck/lint**

Run: `npm test -- lib/evidence/__tests__/citations.test.ts && npm run typecheck && npm run lint`
Expected: PASS, 0 erreur.

- [ ] **Step 5 : Commit**

```bash
git add lib/evidence/citations.ts lib/evidence/__tests__/citations.test.ts
git commit -m "[evidence][A] citations : mapping reco→claims (coût/juridique/SLA/provider) + orchestration

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8 : Route `POST /api/evidence/citations`

**Files:** Create `app/api/evidence/citations/route.ts` ; Test `app/api/evidence/citations/__tests__/route.test.ts`

Calque `app/api/legal/regimes/route.ts` : rate-limit en tête, bornage entrées, recherche+LLM serveur, persistance non bloquante. Le corps porte un `profile` (la reco est recalculée serveur — déterministe).

- [ ] **Step 1 : Écrire le test de route**

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

// On mocke la brique pour tester le contrat HTTP de la route (pas le réseau réel).
vi.mock("@/lib/evidence/citations", () => ({
  gatherCitations: vi.fn(async () => [
    { claim: { kind: "citation", subject: "OVH", query: "ovh" }, sources: [], verdict: "attested", confidence: "low", provenance: "live", rationale: "x", generatedAt: "2026-06-10" },
  ]),
}));
vi.mock("@/lib/evidence/persist", () => ({ persistEvidenceObservations: vi.fn(async () => 1) }));

import { POST } from "../route";
import { defaultProfile } from "@/lib/engine";

function req(body: unknown): Request {
  return new Request("http://localhost/api/evidence/citations", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/evidence/citations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("profil valide → 200 + pack (items + integrityHash)", async () => {
    const res = await POST(req({ profile: defaultProfile() }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.items)).toBe(true);
    expect(typeof json.integrityHash).toBe("string");
  });

  it("corps non-objet → 400", async () => {
    const res = await POST(req("nope"));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2 : Lancer le test → échec**

Run: `npm test -- app/api/evidence/citations/__tests__/route.test.ts`
Expected: FAIL (route absente).

- [ ] **Step 3 : Écrire `app/api/evidence/citations/route.ts`**

```ts
import { NextResponse } from "next/server";
import { recommend, type Profile } from "@/lib/engine";
import { searchWeb, type WebSearchResult } from "@/lib/pricing/scraper";
import { callLLM, type LlmMessage, type LlmResult } from "@/lib/llm";
import { gatherCitations } from "@/lib/evidence/citations";
import { buildEvidencePack } from "@/lib/evidence/pack";
import { persistEvidenceObservations } from "@/lib/evidence/persist";
import { enforceRateLimit } from "@/lib/api/rate-limit-guard";
import { parseProfile } from "@/lib/wizard/profile-parse";

// Feature A — citations sourcées : POST { profile } → reco recalculée serveur → claims (coût/juridique/SLA/
// provider) → SearXNG+LLM (serveur) → pack scellé (MD/JSON + SHA-256). Audit live non bloquant. Rate-limité.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(req: Request): Promise<Response> {
  const limited = enforceRateLimit(req, "evidence-citations", 12, 60_000);
  if (limited !== null) return limited;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!isRecord(raw)) return NextResponse.json({ error: "Corps requis (objet)" }, { status: 400 });

  const profile: Profile | null = parseProfile(raw.profile);
  if (profile === null) return NextResponse.json({ error: "Profil invalide" }, { status: 400 });

  const reco = recommend(profile);
  const generatedAt = new Date().toISOString().slice(0, 10);
  const deps = {
    search: (query: string, limit: number): Promise<WebSearchResult[]> =>
      searchWeb(query, limit, { apiKey: process.env.CRAWL4AI_API_TOKEN }),
    llm: (messages: LlmMessage[]): Promise<LlmResult> => callLLM(messages),
  };

  const items = await gatherCitations(profile, reco, deps, generatedAt);
  const pack = await buildEvidencePack(items, "Sources & preuves");
  await persistEvidenceObservations(items, { integrityHash: pack.integrityHash });

  return NextResponse.json({ items, markdown: pack.markdown, integrityHash: pack.integrityHash, generatedAt });
}
```

> ⚠️ `parseProfile` : vérifier qu'un parseur de profil existe (`grep -rn "parseProfile\|profileFromQuery\|decodeProfile" lib/`).
> S'il n'existe pas sous ce nom, réutiliser le décodeur du partage (`lib/wizard` / `lib/share`) ou borner
> le profil avec un type guard local minimal. NE PAS faire confiance au corps brut sans validation.

- [ ] **Step 4 : Lancer le test → succès, typecheck/lint**

Run: `npm test -- app/api/evidence/citations/__tests__/route.test.ts && npm run typecheck && npm run lint`
Expected: PASS, 0 erreur.

- [ ] **Step 5 : Commit**

```bash
git add app/api/evidence/citations/
git commit -m "[evidence][A] route /api/evidence/citations (rate-limit, profil borné, audit)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9 : i18n + panneau A + montage ResultsView

**Files:** Modify `messages/{fr,en,ar}.json` ; Create `components/results/EvidenceCitationsPanel.tsx` ; Modify `components/results/ResultsView.tsx`

- [ ] **Step 1 : Ajouter les clés i18n** sous `Results.evidenceCitations` dans **fr.json, en.json ET ar.json** (parité obligatoire)

fr.json :
```json
"evidenceCitations": {
  "title": "Sources & preuves",
  "intro": "Chaque affirmation dure (coût, statut juridique, SLA, existence d'un fournisseur) est confrontée aux sources publiques trouvées en ligne, horodatées. Confiance « faible » par prudence ; rien trouvé = affiché honnêtement.",
  "runButton": "Sourcer les affirmations",
  "running": "Recherche en cours…",
  "verdictAttested": "attesté",
  "verdictUnattested": "non attesté",
  "confidence": "confiance {level}",
  "noSources": "Aucune source publique au relevé.",
  "downloadEvidence": "Télécharger la preuve (.md)",
  "generating": "Génération…",
  "integrity": "Intégrité : sha256:{hash}",
  "disclaimer": "Preuve sourcée par recherche web + IA. Une IA peut se tromper : vérifiez les sources citées avant tout usage opposable."
}
```
en.json (en-GB) et ar.json (MSA, flaggable « à relire natif ») : MÊMES clés, valeurs traduites.

- [ ] **Step 2 : Écrire `components/results/EvidenceCitationsPanel.tsx`** (calque `DriftMonitorPanel.tsx`)

```tsx
"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { Profile, Recommendation } from "@/lib/engine";
import type { SourcedEvidence } from "@/lib/evidence/types";

type Props = { profile: Profile; recommendation: Recommendation };

export function EvidenceCitationsPanel({ profile }: Props): ReactElement {
  const t = useTranslations("Results.evidenceCitations");
  const [items, setItems] = useState<SourcedEvidence[] | null>(null);
  const [hash, setHash] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (): Promise<void> => {
    setBusy(true);
    try {
      const res = await fetch("/api/evidence/citations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      if (!res.ok) return;
      const json: unknown = await res.json();
      if (typeof json === "object" && json !== null && Array.isArray((json as { items?: unknown }).items)) {
        const data = json as { items: SourcedEvidence[]; integrityHash?: string };
        setItems(data.items);
        setHash(typeof data.integrityHash === "string" ? data.integrityHash : "");
      }
    } finally {
      setBusy(false);
    }
  };

  const download = async (): Promise<void> => {
    if (items === null) return;
    const { buildEvidencePack } = await import("@/lib/evidence/pack");
    const { markdown } = await buildEvidencePack(items, t("title"));
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sources-et-preuves.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <h2 className="font-display text-headline-md text-on-surface">{t("title")}</h2>
      <p className="mt-1 max-w-2xl text-body-sm text-on-surface-variant">{t("intro")}</p>
      <Button variant="primary" onClick={() => void run()} disabled={busy} className="mt-3">
        {busy ? t("running") : t("runButton")}
      </Button>

      {items !== null ? (
        <div className="mt-4 space-y-2" role="status">
          {items.map((ev, i) => (
            <div key={`${ev.claim.subject}-${i}`} className="rounded-card border border-outline-variant bg-surface p-3 text-body-sm">
              <p className="font-medium text-on-surface">{ev.claim.subject}</p>
              <p className="text-on-surface-variant">
                {ev.verdict === "attested" ? `✅ ${t("verdictAttested")}` : `◻️ ${t("verdictUnattested")}`} · {t("confidence", { level: ev.confidence })}
              </p>
              {ev.sources.length > 0 ? (
                <ul className="mt-1 list-disc ps-5">
                  {ev.sources.map((s) => (
                    <li key={s.url}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{s.title || s.url}</a>
                      <span className="text-on-surface-variant"> — {s.retrievedAt}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-on-surface-variant/80">{t("noSources")}</p>
              )}
            </div>
          ))}
          {hash !== "" ? <p className="font-mono text-xs text-on-surface-variant">{t("integrity", { hash })}</p> : null}
          <Button variant="secondary" onClick={() => void download()} className="mt-2">{t("downloadEvidence")}</Button>
        </div>
      ) : null}
      <p className="mt-2 text-body-sm text-on-surface-variant/80">{t("disclaimer")}</p>
    </Card>
  );
}
```

- [ ] **Step 3 : Monter dans `components/results/ResultsView.tsx`** — dans la zone preuve (mode expert), à côté de `DriftMonitorPanel`

```tsx
// import en tête :
import { EvidenceCitationsPanel } from "./EvidenceCitationsPanel";
// dans la zone preuve (là où sont DriftMonitorPanel/MbomPanel) :
<EvidenceCitationsPanel profile={profile} recommendation={recommendation} />
```

> ⚠️ Lire `ResultsView.tsx` pour repérer la zone preuve / le gating « mode expert » et les noms exacts des
> props (`profile`, `recommendation`) avant d'insérer. Suivre le placement des panneaux vague 2.

- [ ] **Step 4 : typecheck + lint + build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: 0 erreur (dont parité i18n).

- [ ] **Step 5 : Commit**

```bash
git add components/results/EvidenceCitationsPanel.tsx components/results/ResultsView.tsx messages/fr.json messages/en.json messages/ar.json
git commit -m "[evidence][A] panneau citations + i18n fr/en/ar + montage ResultsView

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

**✅ Fin Phase A — citations livrées (panneau + route + audit).**

---

## PHASE B — Drift externe

### Task 10 : `external-drift.ts` (claims depuis le manifeste signé + rapport)

**Files:** Create `lib/evidence/external-drift.ts` ; Test `lib/evidence/__tests__/external-drift.test.ts`

- [ ] **Step 1 : Écrire le test**

```ts
import { describe, expect, it, vi } from "vitest";
import { buildExternalDriftClaims, runExternalDrift } from "../external-drift";
import type { BundleManifest } from "@/lib/exit/bundle";
import type { LlmResult } from "@/lib/llm";
import type { WebSearchResult } from "@/lib/pricing/scraper";

// Manifeste minimal conforme au type (adapter aux champs réels de BundleManifest).
const manifest = {
  layers: [{ id: 1, name: "Stockage", choice: "OVH Object Storage" }],
  residency: { primaryRegion: "eu-west", regions: [{ region: "eu-west" }] },
} as unknown as BundleManifest;

describe("buildExternalDriftClaims", () => {
  it("un claim 'external_drift' par composant signé, avec asOf", () => {
    const claims = buildExternalDriftClaims(manifest, "2026-01-01");
    expect(claims.length).toBeGreaterThan(0);
    expect(claims.every((c) => c.kind === "external_drift" && c.asOf === "2026-01-01")).toBe(true);
  });
});

describe("runExternalDrift", () => {
  it("agrège les signaux et compte changed/unknown", async () => {
    const results: WebSearchResult[] = [{ title: "T", url: "https://x.example", snippet: "s" }];
    const deps = {
      search: vi.fn(async () => results),
      llm: vi.fn(async (): Promise<LlmResult> => ({ ok: true, content: JSON.stringify({ verdict: "changed", rationale: "acquired", sourceUrls: ["https://x.example"] }) })),
    };
    const report = await runExternalDrift(manifest, "2026-01-01", deps, "2026-06-10");
    expect(report.signals.length).toBeGreaterThan(0);
    expect(report.changedCount).toBeGreaterThanOrEqual(1);
    expect(report.inSync).toBe(false);
  });
});
```

> ⚠️ Lire `lib/exit/bundle.ts` pour les champs RÉELS de `BundleManifest` (`layers`, `residency`, providers)
> et adapter `buildExternalDriftClaims` + le manifeste de test.

- [ ] **Step 2 : Lancer → échec.** Run: `npm test -- lib/evidence/__tests__/external-drift.test.ts` → FAIL.

- [ ] **Step 3 : Écrire `lib/evidence/external-drift.ts`**

```ts
// Feature B — drift EXTERNE. Pour chaque composant de la reco SIGNÉE (manifeste Exit Escrow), interroge le
// monde (SearXNG+LLM) : changement matériel depuis la date de signature ? (juridiction, incident SLA,
// dépréciation, rachat). Jumeau « externe » de lib/drift/reconcile.ts (qui compare au live RAPPORTÉ). PUR.

import type { BundleManifest } from "@/lib/exit/bundle";
import { gatherSourcedEvidence, type GatherDeps } from "./gather";
import type { EvidenceClaim, EvidenceSource } from "./types";

export type ExternalDriftSignal = {
  subject: string;
  verdict: "stable" | "changed" | "unknown";
  sources: EvidenceSource[];
  rationale: string;
  confidence: "low" | "dated";
};

export type ExternalDriftReport = {
  generatedAt: string;
  asOf: string;
  signals: ExternalDriftSignal[];
  changedCount: number;
  unknownCount: number;
  inSync: boolean; // aucun changed
  disclaimer: string;
};

const DISCLAIMER =
  "Veille externe de dérive (recherche web + IA) sur les composants de la reco signée. Une IA peut se tromper : vérifiez les sources avant d'agir.";

/** Un claim de drift externe par couche signée. `asOf` = date de signature. Pur. */
export function buildExternalDriftClaims(manifest: BundleManifest, asOf: string): EvidenceClaim[] {
  return manifest.layers.map((l) => ({
    kind: "external_drift" as const,
    subject: `${l.choice} (${l.name})`,
    query: `${l.choice} jurisdiction OR SLA incident OR deprecated OR acquisition 2026`,
    asOf,
  }));
}

function isDriftVerdict(v: string): v is "stable" | "changed" | "unknown" {
  return v === "stable" || v === "changed" || v === "unknown";
}

export async function runExternalDrift(
  manifest: BundleManifest,
  asOf: string,
  deps: GatherDeps,
  generatedAt: string,
): Promise<ExternalDriftReport> {
  const claims = buildExternalDriftClaims(manifest, asOf);
  const signals: ExternalDriftSignal[] = [];
  for (const claim of claims) {
    const ev = await gatherSourcedEvidence(claim, deps, generatedAt);
    const verdict = isDriftVerdict(ev.verdict) ? ev.verdict : "unknown";
    signals.push({ subject: claim.subject, verdict, sources: ev.sources, rationale: ev.rationale, confidence: ev.confidence });
  }
  const changedCount = signals.filter((s) => s.verdict === "changed").length;
  const unknownCount = signals.filter((s) => s.verdict === "unknown").length;
  return { generatedAt, asOf, signals, changedCount, unknownCount, inSync: changedCount === 0, disclaimer: DISCLAIMER };
}
```

- [ ] **Step 4 : Lancer → succès + typecheck/lint.** Run: `npm test -- lib/evidence/__tests__/external-drift.test.ts && npm run typecheck && npm run lint` → PASS.

- [ ] **Step 5 : Commit**

```bash
git add lib/evidence/external-drift.ts lib/evidence/__tests__/external-drift.test.ts
git commit -m "[evidence][B] drift externe : claims depuis le manifeste signé + rapport

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11 : Route `POST /api/evidence/external-drift` + test

**Files:** Create `app/api/evidence/external-drift/route.ts` ; Test `app/api/evidence/external-drift/__tests__/route.test.ts`

- [ ] **Step 1 : Test** (calque le test de la route A : mock `runExternalDrift` + `persistEvidenceObservations`, vérifie 200 sur `{ profile, asOf }` et 400 sur corps invalide). Le manifeste est rebâti serveur depuis le profil via `buildExitBundle` (déterministe).

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("@/lib/evidence/external-drift", () => ({
  runExternalDrift: vi.fn(async () => ({ generatedAt: "2026-06-10", asOf: "2026-01-01", signals: [], changedCount: 0, unknownCount: 0, inSync: true, disclaimer: "d" })),
  buildExternalDriftClaims: vi.fn(() => []),
}));
vi.mock("@/lib/evidence/persist", () => ({ persistEvidenceObservations: vi.fn(async () => 0) }));
import { POST } from "../route";
import { defaultProfile } from "@/lib/engine";

function req(body: unknown): Request {
  return new Request("http://localhost/api/evidence/external-drift", {
    method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" }, body: JSON.stringify(body),
  });
}
describe("POST /api/evidence/external-drift", () => {
  beforeEach(() => vi.clearAllMocks());
  it("profil + asOf → 200 (rapport)", async () => {
    const res = await POST(req({ profile: defaultProfile(), asOf: "2026-01-01" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("signals");
  });
  it("corps invalide → 400", async () => {
    expect((await POST(req(42))).status).toBe(400);
  });
});
```

- [ ] **Step 2 : Lancer → échec.**

- [ ] **Step 3 : Écrire la route**

```ts
import { NextResponse } from "next/server";
import { recommend, type Profile } from "@/lib/engine";
import { buildExitBundle } from "@/lib/exit/bundle";
import { searchWeb, type WebSearchResult } from "@/lib/pricing/scraper";
import { callLLM, type LlmMessage, type LlmResult } from "@/lib/llm";
import { runExternalDrift } from "@/lib/evidence/external-drift";
import { persistEvidenceObservations } from "@/lib/evidence/persist";
import { enforceRateLimit } from "@/lib/api/rate-limit-guard";
import { parseProfile } from "@/lib/wizard/profile-parse";
import { resolveServerEngineText } from "@/lib/i18n/engine-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export async function POST(req: Request): Promise<Response> {
  const limited = enforceRateLimit(req, "evidence-external-drift", 8, 60_000);
  if (limited !== null) return limited;
  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
  if (!isRecord(raw)) return NextResponse.json({ error: "Corps requis (objet)" }, { status: 400 });

  const profile: Profile | null = parseProfile(raw.profile);
  if (profile === null) return NextResponse.json({ error: "Profil invalide" }, { status: 400 });
  const asOf = typeof raw.asOf === "string" && raw.asOf.trim() !== "" ? raw.asOf.trim().slice(0, 10) : new Date().toISOString().slice(0, 10);

  const reco = recommend(profile);
  const resolve = resolveServerEngineText();
  const { manifest } = buildExitBundle(profile, reco, undefined, undefined, resolve);
  const generatedAt = new Date().toISOString().slice(0, 10);
  const deps = {
    search: (q: string, n: number): Promise<WebSearchResult[]> => searchWeb(q, n, { apiKey: process.env.CRAWL4AI_API_TOKEN }),
    llm: (m: LlmMessage[]): Promise<LlmResult> => callLLM(m),
  };

  const report = await runExternalDrift(manifest, asOf, deps, generatedAt);
  // Persiste les signaux comme observations (live), via un mapping minimal SourcedEvidence.
  await persistEvidenceObservations(
    report.signals.map((s) => ({
      claim: { kind: "external_drift" as const, subject: s.subject, query: "", asOf },
      sources: s.sources, verdict: s.verdict, confidence: s.confidence,
      provenance: s.sources.length > 0 ? ("live" as const) : ("seed" as const),
      rationale: s.rationale, generatedAt,
    })),
  );
  return NextResponse.json(report);
}
```

> ⚠️ `buildExitBundle` signature : confirmée dans `DriftMonitorPanel.tsx`
> (`buildExitBundle(profile, recommendation, undefined, undefined, resolve).manifest`). Côté SERVEUR,
> il faut un `resolve` (EngineResolver) serveur : vérifier l'utilitaire existant
> (`grep -rn "EngineResolver\|resolveServerEngineText\|engine-server" lib/i18n`). S'il n'existe pas,
> réutiliser le resolver employé par les autres routes serveur (narrate) ou un stub identité `(m) => m.key`.

- [ ] **Step 4 : Lancer → succès + typecheck/lint.**

- [ ] **Step 5 : Commit**

```bash
git add app/api/evidence/external-drift/
git commit -m "[evidence][B] route /api/evidence/external-drift (manifeste serveur, audit)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 12 : i18n + panneau B + montage

**Files:** Modify `messages/{fr,en,ar}.json` (`Results.externalDrift`) ; Create `components/results/ExternalDriftPanel.tsx` ; Modify `ResultsView.tsx`

- [ ] **Step 1 : Clés i18n `Results.externalDrift`** (fr/en/ar parité) : `title, intro, runButton, running, verdictStable, verdictChanged, verdictUnknown, resultInSync, resultDrift, resultLine ({changed},{unknown}), downloadEvidence, generating, disclaimer`.

```json
"externalDrift": {
  "title": "Veille de dérive externe",
  "intro": "Pour chaque composant de votre reco signée, on cherche en ligne un changement matériel depuis la signature : juridiction, incident de SLA, dépréciation, rachat.",
  "runButton": "Lancer la veille",
  "running": "Veille en cours…",
  "verdictStable": "stable",
  "verdictChanged": "changement",
  "verdictUnknown": "inconnu",
  "resultInSync": "✅ Aucun changement externe détecté",
  "resultDrift": "⚠️ Changement(s) externe(s) détecté(s)",
  "resultLine": "{changed} changement(s) · {unknown} inconnu(s)",
  "downloadEvidence": "Télécharger la preuve (.md)",
  "generating": "Génération…",
  "disclaimer": "Veille par recherche web + IA. Une IA peut se tromper : vérifiez les sources avant d'agir."
}
```

- [ ] **Step 2 : `components/results/ExternalDriftPanel.tsx`** — calque `EvidenceCitationsPanel` mais POST `/api/evidence/external-drift` avec `{ profile, asOf }` (asOf = date du jour par défaut, ou date de génération de la reco si disponible) ; rend `report.signals` (filtre `verdict !== "stable"`), bouton download via `buildEvidencePack` en mappant les signaux → `SourcedEvidence` (même mapping minimal que la route).

```tsx
"use client";
import { useTranslations } from "next-intl";
import { useState, type ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { Profile, Recommendation } from "@/lib/engine";
import type { ExternalDriftReport } from "@/lib/evidence/external-drift";

type Props = { profile: Profile; recommendation: Recommendation };

export function ExternalDriftPanel({ profile }: Props): ReactElement {
  const t = useTranslations("Results.externalDrift");
  const [report, setReport] = useState<ExternalDriftReport | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (): Promise<void> => {
    setBusy(true);
    try {
      const res = await fetch("/api/evidence/external-drift", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, asOf: new Date().toISOString().slice(0, 10) }),
      });
      if (!res.ok) return;
      const json: unknown = await res.json();
      if (typeof json === "object" && json !== null && Array.isArray((json as { signals?: unknown }).signals)) {
        setReport(json as ExternalDriftReport);
      }
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <h2 className="font-display text-headline-md text-on-surface">{t("title")}</h2>
      <p className="mt-1 max-w-2xl text-body-sm text-on-surface-variant">{t("intro")}</p>
      <Button variant="primary" onClick={() => void run()} disabled={busy} className="mt-3">
        {busy ? t("running") : t("runButton")}
      </Button>
      {report !== null ? (
        <div className={`mt-4 rounded-card border p-4 text-body-sm ${report.inSync ? "border-primary/40 bg-primary/5" : "border-tertiary/40 bg-tertiary/5"}`} role="status">
          <p className={`font-medium ${report.inSync ? "text-primary" : "text-tertiary"}`}>{report.inSync ? t("resultInSync") : t("resultDrift")}</p>
          <p className="mt-1 text-on-surface-variant">{t("resultLine", { changed: report.changedCount, unknown: report.unknownCount })}</p>
          <ul className="mt-2 space-y-2">
            {report.signals.filter((s) => s.verdict !== "stable").map((s) => (
              <li key={s.subject}>
                <span className="text-on-surface">{s.subject}</span>{" "}
                <span className="text-on-surface-variant">· {s.verdict === "changed" ? t("verdictChanged") : t("verdictUnknown")}</span>
                {s.rationale !== "" ? <p className="text-on-surface-variant/80">{s.rationale}</p> : null}
                {s.sources.map((src) => (
                  <a key={src.url} href={src.url} target="_blank" rel="noopener noreferrer" className="block text-primary underline">{src.title || src.url}</a>
                ))}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="mt-2 text-body-sm text-on-surface-variant/80">{t("disclaimer")}</p>
    </Card>
  );
}
```

- [ ] **Step 3 : Monter dans `ResultsView.tsx`** (`<ExternalDriftPanel profile={profile} recommendation={recommendation} />`, zone preuve).

- [ ] **Step 4 : typecheck + lint + build** → 0 erreur.

- [ ] **Step 5 : Commit**

```bash
git add components/results/ExternalDriftPanel.tsx components/results/ResultsView.tsx messages/fr.json messages/en.json messages/ar.json
git commit -m "[evidence][B] panneau drift externe + i18n + montage

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

**✅ Fin Phase B.**

---

## PHASE C — Vérification d'authenticité externe

### Task 13 : `cross-check.ts` (extraction artefact + run)

**Files:** Create `lib/evidence/cross-check.ts` ; Test `lib/evidence/__tests__/cross-check.test.ts`

- [ ] **Step 1 : Test**

```ts
import { describe, expect, it, vi } from "vitest";
import { extractClaim, runCrossCheck } from "../cross-check";
import type { LlmResult } from "@/lib/llm";
import type { WebSearchResult } from "@/lib/pricing/scraper";

describe("extractClaim", () => {
  it("borne et résume l'artefact collé (type guard, longueur)", () => {
    const c = extractClaim("OVHcloud certifie héberger en France (datacenter Gravelines).", "provider-cert");
    expect(c.expected.length).toBeGreaterThan(0);
    expect(c.subject.length).toBeGreaterThan(0);
  });
  it("artefact vide → expected vide (run repliera unverifiable)", () => {
    expect(extractClaim("", "provider-cert").expected).toBe("");
  });
});

describe("runCrossCheck", () => {
  it("match si les sources confirment", async () => {
    const results: WebSearchResult[] = [{ title: "OVH", url: "https://ovh.com", snippet: "Gravelines France" }];
    const deps = {
      search: vi.fn(async () => results),
      llm: vi.fn(async (): Promise<LlmResult> => ({ ok: true, content: JSON.stringify({ verdict: "match", rationale: "confirmé", sourceUrls: ["https://ovh.com"] }) })),
    };
    const ev = await runCrossCheck("OVH héberge en France", "provider-cert", deps, "2026-06-10");
    expect(ev.verdict).toBe("match");
  });
  it("artefact vide → unverifiable (pas d'appel réseau requis)", async () => {
    const deps = { search: vi.fn(async () => []), llm: vi.fn(async (): Promise<LlmResult> => ({ ok: false, reason: "x" })) };
    const ev = await runCrossCheck("", "provider-cert", deps, "2026-06-10");
    expect(ev.verdict).toBe("unverifiable");
  });
});
```

- [ ] **Step 2 : Lancer → échec.**

- [ ] **Step 3 : Écrire `lib/evidence/cross-check.ts`**

```ts
// Feature C — vérification d'authenticité externe. Extrait une affirmation d'un artefact CLIENT collé
// (certif provider, page de statut, mention légale) puis la confronte aux sources publiques (SearXNG+LLM).
// 'mismatch' = incohérence avec les sources (JAMAIS une accusation de fraude). PUR (I/O injectée).

import { gatherSourcedEvidence, type GatherDeps } from "./gather";
import type { SourcedEvidence } from "./types";

export type CrossCheckType = "provider-cert" | "status-page" | "legal-mention";

const MAX_ARTEFACT = 2_000;

/** Borne l'artefact collé (anti-injection) → {expected, subject}. Pur, total. */
export function extractClaim(artefactRaw: string, type: CrossCheckType): { expected: string; subject: string } {
  const expected = typeof artefactRaw === "string" ? artefactRaw.trim().slice(0, MAX_ARTEFACT) : "";
  const label: Record<CrossCheckType, string> = {
    "provider-cert": "Certificat fournisseur",
    "status-page": "Page de statut",
    "legal-mention": "Mention légale",
  };
  const subject = expected === "" ? label[type] : `${label[type]} — ${expected.slice(0, 80)}`;
  return { expected, subject };
}

export async function runCrossCheck(
  artefactRaw: string,
  type: CrossCheckType,
  deps: GatherDeps,
  generatedAt: string,
): Promise<SourcedEvidence> {
  const { expected, subject } = extractClaim(artefactRaw, type);
  if (expected === "") {
    return {
      claim: { kind: "cross_check", subject, query: "", expected: "" },
      sources: [], verdict: "unverifiable", confidence: "dated", provenance: "seed",
      rationale: "Artefact vide — rien à vérifier.", generatedAt,
    };
  }
  return gatherSourcedEvidence(
    { kind: "cross_check", subject, query: `${expected.slice(0, 120)} official source 2026`, expected },
    deps,
    generatedAt,
  );
}
```

- [ ] **Step 4 : Lancer → succès + typecheck/lint.**

- [ ] **Step 5 : Commit**

```bash
git add lib/evidence/cross-check.ts lib/evidence/__tests__/cross-check.test.ts
git commit -m "[evidence][C] cross-check : extraction artefact client + confrontation sources

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 14 : Route `POST /api/evidence/cross-check` + test

**Files:** Create `app/api/evidence/cross-check/route.ts` ; Test `app/api/evidence/cross-check/__tests__/route.test.ts`

- [ ] **Step 1 : Test** (mock `runCrossCheck` + `persistEvidenceObservations` ; 200 sur `{ artefact, type }`, 400 sur corps invalide, type inconnu → 400).

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("@/lib/evidence/cross-check", () => ({
  runCrossCheck: vi.fn(async () => ({ claim: { kind: "cross_check", subject: "X", query: "", expected: "e" }, sources: [], verdict: "match", confidence: "low", provenance: "live", rationale: "ok", generatedAt: "2026-06-10" })),
}));
vi.mock("@/lib/evidence/persist", () => ({ persistEvidenceObservations: vi.fn(async () => 1) }));
import { POST } from "../route";
function req(body: unknown): Request {
  return new Request("http://localhost/api/evidence/cross-check", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" }, body: JSON.stringify(body) });
}
describe("POST /api/evidence/cross-check", () => {
  beforeEach(() => vi.clearAllMocks());
  it("artefact + type valide → 200", async () => {
    const res = await POST(req({ artefact: "OVH héberge en France", type: "provider-cert" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty("verdict");
  });
  it("type inconnu → 400", async () => {
    expect((await POST(req({ artefact: "x", type: "nope" }))).status).toBe(400);
  });
  it("corps invalide → 400", async () => {
    expect((await POST(req(7))).status).toBe(400);
  });
});
```

- [ ] **Step 2 : Lancer → échec.**

- [ ] **Step 3 : Écrire la route**

```ts
import { NextResponse } from "next/server";
import { searchWeb, type WebSearchResult } from "@/lib/pricing/scraper";
import { callLLM, type LlmMessage, type LlmResult } from "@/lib/llm";
import { runCrossCheck, type CrossCheckType } from "@/lib/evidence/cross-check";
import { persistEvidenceObservations } from "@/lib/evidence/persist";
import { enforceRateLimit } from "@/lib/api/rate-limit-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: readonly CrossCheckType[] = ["provider-cert", "status-page", "legal-mention"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function isType(v: unknown): v is CrossCheckType {
  return typeof v === "string" && (TYPES as readonly string[]).includes(v);
}

export async function POST(req: Request): Promise<Response> {
  const limited = enforceRateLimit(req, "evidence-cross-check", 12, 60_000);
  if (limited !== null) return limited;
  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
  if (!isRecord(raw)) return NextResponse.json({ error: "Corps requis (objet)" }, { status: 400 });
  if (!isType(raw.type)) return NextResponse.json({ error: "Type invalide" }, { status: 400 });
  const artefact = typeof raw.artefact === "string" ? raw.artefact : "";

  const generatedAt = new Date().toISOString().slice(0, 10);
  const deps = {
    search: (q: string, n: number): Promise<WebSearchResult[]> => searchWeb(q, n, { apiKey: process.env.CRAWL4AI_API_TOKEN }),
    llm: (m: LlmMessage[]): Promise<LlmResult> => callLLM(m),
  };
  const ev = await runCrossCheck(artefact, raw.type, deps, generatedAt);
  await persistEvidenceObservations([ev]);
  return NextResponse.json(ev);
}
```

- [ ] **Step 4 : Lancer → succès + typecheck/lint.**

- [ ] **Step 5 : Commit**

```bash
git add app/api/evidence/cross-check/
git commit -m "[evidence][C] route /api/evidence/cross-check (type borné, rate-limit, audit)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 15 : i18n + panneau C + montage

**Files:** Modify `messages/{fr,en,ar}.json` (`Results.crossCheck`) ; Create `components/results/CrossCheckPanel.tsx` ; Modify `ResultsView.tsx`

- [ ] **Step 1 : Clés i18n `Results.crossCheck`** (fr/en/ar parité) : `title, intro, typeLabel, typeProviderCert, typeStatusPage, typeLegalMention, pastePlaceholder, runButton, running, verdictMatch, verdictMismatch, verdictUnverifiable, noSources, disclaimer`.

```json
"crossCheck": {
  "title": "Vérification d'authenticité",
  "intro": "Collez un artefact (certificat fournisseur, page de statut, mention légale). On le confronte aux sources publiques trouvées en ligne.",
  "typeLabel": "Type d'artefact",
  "typeProviderCert": "Certificat fournisseur",
  "typeStatusPage": "Page de statut",
  "typeLegalMention": "Mention légale",
  "pastePlaceholder": "Collez ici le contenu à vérifier…",
  "runButton": "Vérifier",
  "running": "Vérification en cours…",
  "verdictMatch": "✅ Cohérent avec les sources publiques",
  "verdictMismatch": "⚠️ Incohérence avec les sources publiques — à investiguer",
  "verdictUnverifiable": "◻️ Invérifiable en ligne",
  "noSources": "Aucune source publique au relevé.",
  "disclaimer": "« Incohérence » n'est pas une accusation de fraude. Vérification par recherche web + IA, faillible : recoupez vous-même."
}
```

- [ ] **Step 2 : `components/results/CrossCheckPanel.tsx`** (calque DriftMonitorPanel : `<select>` du type + `<textarea>` artefact + bouton ; POST `/api/evidence/cross-check` ; rend verdict + sources).

```tsx
"use client";
import { useTranslations } from "next-intl";
import { useState, type ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { SourcedEvidence } from "@/lib/evidence/types";
import type { CrossCheckType } from "@/lib/evidence/cross-check";

const TYPES: CrossCheckType[] = ["provider-cert", "status-page", "legal-mention"];
const TYPE_KEY: Record<CrossCheckType, "typeProviderCert" | "typeStatusPage" | "typeLegalMention"> = {
  "provider-cert": "typeProviderCert", "status-page": "typeStatusPage", "legal-mention": "typeLegalMention",
};
const VERDICT_KEY: Record<string, "verdictMatch" | "verdictMismatch" | "verdictUnverifiable"> = {
  match: "verdictMatch", mismatch: "verdictMismatch", unverifiable: "verdictUnverifiable",
};

export function CrossCheckPanel(): ReactElement {
  const t = useTranslations("Results.crossCheck");
  const [type, setType] = useState<CrossCheckType>("provider-cert");
  const [artefact, setArtefact] = useState("");
  const [ev, setEv] = useState<SourcedEvidence | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (): Promise<void> => {
    setBusy(true);
    try {
      const res = await fetch("/api/evidence/cross-check", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artefact, type }),
      });
      if (!res.ok) return;
      const json: unknown = await res.json();
      if (typeof json === "object" && json !== null && "verdict" in json) setEv(json as SourcedEvidence);
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <h2 className="font-display text-headline-md text-on-surface">{t("title")}</h2>
      <p className="mt-1 max-w-2xl text-body-sm text-on-surface-variant">{t("intro")}</p>
      <label htmlFor="cc-type" className="mt-3 block text-label-caps uppercase text-on-surface-variant">{t("typeLabel")}</label>
      <select id="cc-type" value={type} onChange={(e) => setType(e.target.value as CrossCheckType)} className="mt-1 rounded-input border border-outline-variant bg-surface p-2 text-body-sm text-on-surface">
        {TYPES.map((ty) => <option key={ty} value={ty}>{t(TYPE_KEY[ty])}</option>)}
      </select>
      <textarea value={artefact} onChange={(e) => setArtefact(e.target.value)} rows={5} placeholder={t("pastePlaceholder")} className="mt-2 w-full rounded-card border border-outline-variant bg-surface p-3 font-mono text-xs text-on-surface" />
      <Button variant="primary" onClick={() => void run()} disabled={busy || artefact.trim() === ""} className="mt-2">{busy ? t("running") : t("runButton")}</Button>
      {ev !== null ? (
        <div className="mt-4 rounded-card border border-outline-variant bg-surface p-3 text-body-sm" role="status">
          <p className="font-medium text-on-surface">{t(VERDICT_KEY[ev.verdict] ?? "verdictUnverifiable")}</p>
          {ev.rationale !== "" ? <p className="mt-1 text-on-surface-variant">{ev.rationale}</p> : null}
          {ev.sources.length > 0 ? (
            <ul className="mt-1 list-disc ps-5">
              {ev.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{s.title || s.url}</a></li>)}
            </ul>
          ) : <p className="mt-1 text-on-surface-variant/80">{t("noSources")}</p>}
        </div>
      ) : null}
      <p className="mt-2 text-body-sm text-on-surface-variant/80">{t("disclaimer")}</p>
    </Card>
  );
}
```

- [ ] **Step 3 : Monter dans `ResultsView.tsx`** (`<CrossCheckPanel />`, zone preuve).

- [ ] **Step 4 : typecheck + lint + build** → 0 erreur.

- [ ] **Step 5 : Commit**

```bash
git add components/results/CrossCheckPanel.tsx components/results/ResultsView.tsx messages/fr.json messages/en.json messages/ar.json
git commit -m "[evidence][C] panneau vérif authenticité + i18n + montage

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

**✅ Fin Phase C.**

---

## PHASE E2E + clôture

### Task 16 : e2e des 3 panneaux

**Files:** Create `e2e/evidence.spec.ts`

- [ ] **Step 1 : Écrire `e2e/evidence.spec.ts`** (calque une spec panneau existante — ex. `e2e/` du Drift)

```ts
import { test, expect } from "@playwright/test";

// Parcours preuve sourcée : les 3 panneaux apparaissent dans la zone preuve (mode expert) de /resultats.
// On vérifie le RENDU + l'interactivité de base (pas le réseau live : SearXNG/LLM peuvent être indisponibles
// en CI → on n'asserte pas un verdict, seulement la présence des contrôles).

test.describe("Preuve sourcée (evidence)", () => {
  test("les 3 panneaux sont présents et actionnables", async ({ page }) => {
    // Aller jusqu'à /resultats avec un profil (réutiliser le helper de navigation des autres specs e2e).
    await page.goto("/resultats");
    // Activer le mode expert si nécessaire (suivre le pattern des specs vague 2).
    await expect(page.getByRole("heading", { name: /Sources & preuves|Sources & evidence/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /dérive externe|external drift/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /authenticité|authenticity/i })).toBeVisible();
  });
});
```

> ⚠️ Lire une spec e2e existante (`ls e2e/` puis ouvrir celle qui teste un panneau de /resultats) pour
> reprendre EXACTEMENT le helper de navigation (remplir le wizard / charger un profil + activer le mode
> expert). Gater le test si l'environnement n'a pas SearXNG/LLM (présence des contrôles seulement).

- [ ] **Step 2 : Lancer l'e2e**

Run: `npm run test:e2e -- evidence.spec.ts`
Expected: PASS (rendu des 3 panneaux).

- [ ] **Step 3 : Commit**

```bash
git add e2e/evidence.spec.ts
git commit -m "[evidence] e2e : présence + interactivité des 3 panneaux

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 17 : Vérification finale + migration prod + push

- [ ] **Step 1 : Suite complète**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: typecheck 0 · lint 0/0 · tests verts · build OK.

- [ ] **Step 2 : Appliquer la migration en prod** (on-LAN ; cf. note Task 5)

Run: `cat supabase/migrations/20260610120000_evidence_observations.sql | ssh -i ~/.ssh/serveurai_mnemo serveurai@192.168.100.8 'docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1'`
Vérifier RLS : `... psql ... -c "select relrowsecurity from pg_class where relname='evidence_observations';"` → `t`.

- [ ] **Step 3 : Push (déclenche l'auto-deploy)**

Run: `git push origin main`
Puis vérifier le déploiement `finished` (coolify-db on-LAN) + health 200, et tester une route en prod (ex. `POST /api/evidence/citations` avec un profil → 200, items présents).

- [ ] **Step 4 : MAJ pilotage** — `.ralph/prd.json` (nouvelles stories A/B/C `passes=true`), `.ralph/progress.md` (log + pattern « preuve sourcée »), `PASSATION.md`. Commit `docs(passation)…`.

---

## Self-Review (à exécuter après rédaction — déjà intégré)

- **Couverture spec** : §2 brique (Tasks 1-6) · §3 A (7-9) · §4 B (10-12) · §5 C (13-15) · §6 affichage/i18n/sécu (9,12,15) · §7 tests (chaque task + 16) · §8 hors-périmètre (respecté : pas de scheduler, pas d'upload, hash pas signature). ✅
- **Cohérence des types** : `SourcedEvidence`/`EvidenceClaim`/`GatherDeps` définis Task 1/3, réutilisés à l'identique partout ; `buildEvidencePack` (Task 4) ; `persistEvidenceObservations` (Task 6) ; `ExternalDriftReport` (Task 10). ✅
- **Points à confirmer au fil de l'eau (marqués ⚠️ dans les tasks)** : exports réels du moteur (`recommend`/`defaultProfile`/`Profile`/`Recommendation`), `parseProfile`, signature `buildExitBundle` + resolver serveur, champs réels de `BundleManifest`, zone preuve / mode expert de `ResultsView`, helper de navigation e2e. **Chaque task dit de vérifier avant d'écrire** — pas de placeholder, mais des garde-fous de vérification.
```
