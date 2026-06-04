# Vague 2 — Chaîne de preuve (Restore Drill + Résidence continue) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compléter la chaîne de preuve du moat (Decision Record → Exit Escrow → **Restore Drill** → **Résidence continue**) avec deux artefacts opposables, horodatés, hachés SHA-256 et rejouables.

**Architecture:** Cœurs métier 100 % PURS dans `lib/restore-drill/` et `lib/residency/` (zéro I/O, testés Vitest), réutilisant `lib/decision/integrity` (hash isomorphe) et `lib/legal/transfers` (base légale datée). Panneaux clients dans `components/results/` montés dans `ResultsView`. i18n next-intl fr/en/ar parité stricte. DÉFCON 1 : aucune valeur (RTO, juridiction) fabriquée — Strate fournit l'instrument et **vérifie** le résultat.

**Tech Stack:** Next.js 15 / React 19 / TypeScript strict / Vitest / next-intl / Web Crypto (SHA-256) / Supabase RLS.

**Spec :** `docs/superpowers/specs/2026-06-04-vague2-chaine-de-preuve-design.md`.

**Conventions de vérification (à chaque tâche)** : `npm run typecheck` (0) · `npm run lint` (0-0) · `npm test` (verts) · `npm run build` (OK). Tests i18n d'un composant : importer `render` depuis `@/test/render`.

---

# STORY S-094 — Restore Drill certifié

## Task 1 : Modèle + vérification du certificat (PUR)

**Files:**
- Create: `lib/restore-drill/certificate.ts`
- Test: `lib/restore-drill/__tests__/certificate.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// lib/restore-drill/__tests__/certificate.test.ts
import { describe, expect, it } from "vitest";
import { CHECKLIST_IDS, type RestoreCertificate, verifyCertificate } from "../certificate";
import { computeIntegrityHash } from "@/lib/decision/integrity";

async function stamp(cert: Omit<RestoreCertificate, "integrityHash">): Promise<RestoreCertificate> {
  const integrityHash = await computeIntegrityHash(cert);
  return { ...cert, integrityHash };
}

function baseCert(): Omit<RestoreCertificate, "integrityHash"> {
  return {
    version: 1,
    generatedAt: "2026-06-04T10:00:00.000Z",
    mode: "local",
    dataset: "real",
    checklist: CHECKLIST_IDS.map((id) => ({ id, passed: true })),
    rtoMinutes: 12,
  };
}

describe("verifyCertificate", () => {
  it("valide un certificat intègre, toutes étapes passées", async () => {
    const cert = await stamp(baseCert());
    const v = await verifyCertificate(cert);
    expect(v.valid).toBe(true);
    expect(v.integrityOk).toBe(true);
    expect(v.allPassed).toBe(true);
    expect(v.rtoMinutes).toBe(12);
    expect(v.dataset).toBe("real");
    expect(v.issues).toEqual([]);
  });

  it("détecte une altération du contenu (hash divergent)", async () => {
    const cert = await stamp(baseCert());
    const tampered = { ...cert, rtoMinutes: 1 };
    const v = await verifyCertificate(tampered);
    expect(v.integrityOk).toBe(false);
    expect(v.valid).toBe(false);
  });

  it("signale une checklist incomplète", async () => {
    const partial = baseCert();
    partial.checklist[0].passed = false;
    const v = await verifyCertificate(await stamp(partial));
    expect(v.integrityOk).toBe(true);
    expect(v.allPassed).toBe(false);
    expect(v.valid).toBe(false);
  });

  it("rejette proprement un JSON malformé / injection (garde de type, jamais throw)", async () => {
    for (const bad of [null, 42, "x", {}, { version: 1 }, { ...baseCert(), checklist: "oops" }]) {
      const v = await verifyCertificate(bad);
      expect(v.valid).toBe(false);
      expect(v.issues.length).toBeGreaterThan(0);
    }
  });

  it("marque le dataset synthétique (répétition à blanc) comme tel", async () => {
    const v = await verifyCertificate(await stamp({ ...baseCert(), mode: "ci", dataset: "synthetic" }));
    expect(v.dataset).toBe("synthetic");
    expect(v.valid).toBe(true);
  });
});
```

- [ ] **Step 2 : Lancer le test → échec attendu**

Run: `npm test -- lib/restore-drill/__tests__/certificate.test.ts`
Expected: FAIL « Cannot find module '../certificate' ».

- [ ] **Step 3 : Implémenter le module**

```ts
// lib/restore-drill/certificate.ts
// Modèle + vérification du certificat de Restore Drill — PUR (Web Crypto isomorphe). DÉFCON 1 : Strate ne
// fabrique JAMAIS un RTO ; elle VÉRIFIE le certificat produit par le drill (local sur données réelles, ou
// CI jetable sur données synthétiques). Le hash certifie l'intégrité (un tiers recalcule et compare).

import { computeIntegrityHash } from "@/lib/decision/integrity";

export const CERTIFICATE_VERSION = 1;

/** Étapes de la checklist de restauration (ordre = ordre d'exécution du drill). */
export const CHECKLIST_IDS = ["servicesUp", "dumpReloaded", "reembedReplayable", "queryAnswers"] as const;
export type ChecklistId = (typeof CHECKLIST_IDS)[number];

export type RestoreCertificate = {
  version: number;
  /** Date d'émission du certificat (ISO) — produite par le drill. */
  generatedAt: string;
  /** `local` : drill manuel sur les vraies données. `ci` : répétition à blanc automatisée. */
  mode: "local" | "ci";
  /** `real` : données réelles du client. `synthetic` : jeu de démo (RTO non représentatif). */
  dataset: "real" | "synthetic";
  checklist: { id: ChecklistId; passed: boolean }[];
  /** RTO mesuré (minutes, wall-clock) — jamais fabriqué par Strate. */
  rtoMinutes: number;
  /** Empreinte d'intégrité (hash de tout le reste, clé exclue). */
  integrityHash?: string;
};

export type RestoreVerdict = {
  valid: boolean;
  integrityOk: boolean;
  allPassed: boolean;
  rtoMinutes: number | null;
  dataset: "real" | "synthetic" | null;
  mode: "local" | "ci" | null;
  passedCount: number;
  totalCount: number;
  issues: string[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Borne un JSON inconnu en `RestoreCertificate` (anti-injection ; jamais de `as` brut, jamais de throw). */
function parseCertificate(raw: unknown): { cert: RestoreCertificate | null; issues: string[] } {
  const issues: string[] = [];
  if (!isRecord(raw)) return { cert: null, issues: ["certificat absent ou non-objet"] };
  const mode = raw.mode === "local" || raw.mode === "ci" ? raw.mode : null;
  const dataset = raw.dataset === "real" || raw.dataset === "synthetic" ? raw.dataset : null;
  const rtoMinutes = typeof raw.rtoMinutes === "number" && Number.isFinite(raw.rtoMinutes) ? raw.rtoMinutes : null;
  const generatedAt = typeof raw.generatedAt === "string" ? raw.generatedAt : null;
  const version = typeof raw.version === "number" ? raw.version : null;
  const integrityHash = typeof raw.integrityHash === "string" ? raw.integrityHash : null;
  if (mode === null) issues.push("mode invalide (local|ci)");
  if (dataset === null) issues.push("dataset invalide (real|synthetic)");
  if (rtoMinutes === null) issues.push("rtoMinutes invalide");
  if (generatedAt === null) issues.push("generatedAt invalide");
  if (version === null) issues.push("version invalide");
  if (!Array.isArray(raw.checklist)) {
    issues.push("checklist invalide");
    return { cert: null, issues };
  }
  const checklist: { id: ChecklistId; passed: boolean }[] = [];
  for (const item of raw.checklist) {
    if (isRecord(item) && CHECKLIST_IDS.includes(item.id as ChecklistId) && typeof item.passed === "boolean") {
      checklist.push({ id: item.id as ChecklistId, passed: item.passed });
    }
  }
  if (mode === null || dataset === null || rtoMinutes === null || generatedAt === null || version === null) {
    return { cert: null, issues };
  }
  return {
    cert: { version, generatedAt, mode, dataset, checklist, rtoMinutes, ...(integrityHash === null ? {} : { integrityHash }) },
    issues,
  };
}

/** Recalcule le hash canonique du certificat (clé `integrityHash` exclue) et le compare à l'empreinte publiée. */
async function checkIntegrity(cert: RestoreCertificate): Promise<boolean> {
  if (cert.integrityHash === undefined) return false;
  const { integrityHash: _omit, ...body } = cert;
  const recomputed = await computeIntegrityHash(body);
  return recomputed === cert.integrityHash;
}

/** Vérifie un certificat inconnu (intégrité + checklist complète). Total, ne lève jamais. */
export async function verifyCertificate(raw: unknown): Promise<RestoreVerdict> {
  const { cert, issues } = parseCertificate(raw);
  if (cert === null) {
    return { valid: false, integrityOk: false, allPassed: false, rtoMinutes: null, dataset: null, mode: null, passedCount: 0, totalCount: CHECKLIST_IDS.length, issues };
  }
  const integrityOk = await checkIntegrity(cert);
  const passedCount = cert.checklist.filter((c) => c.passed).length;
  const allPassed = CHECKLIST_IDS.every((id) => cert.checklist.find((c) => c.id === id)?.passed === true);
  if (!integrityOk) issues.push("empreinte d'intégrité invalide (certificat altéré ou non scellé)");
  if (!allPassed) issues.push("checklist incomplète (au moins une étape de restauration a échoué)");
  return {
    valid: integrityOk && allPassed,
    integrityOk,
    allPassed,
    rtoMinutes: cert.rtoMinutes,
    dataset: cert.dataset,
    mode: cert.mode,
    passedCount,
    totalCount: CHECKLIST_IDS.length,
    issues,
  };
}
```

- [ ] **Step 4 : Lancer le test → vert**

Run: `npm test -- lib/restore-drill/__tests__/certificate.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5 : Commit**

```bash
git add lib/restore-drill/certificate.ts lib/restore-drill/__tests__/certificate.test.ts
git commit -m "[S-094] Restore Drill : modèle + vérification du certificat (pur, SHA-256)"
```

---

## Task 2 : Générateur du kit de drill (PUR)

**Files:**
- Create: `lib/restore-drill/kit.ts`
- Test: `lib/restore-drill/__tests__/kit.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// lib/restore-drill/__tests__/kit.test.ts
import { describe, expect, it } from "vitest";
import { buildRestoreDrillKit } from "../kit";
import { buildExitBundle } from "@/lib/exit/bundle";
import { recommend } from "@/lib/engine";
import { DEFAULT_PROFILE } from "@/lib/wizard/defaultProfile";

function kit() {
  const reco = recommend({ ...DEFAULT_PROFILE });
  const { manifest } = buildExitBundle({ ...DEFAULT_PROFILE }, reco);
  return buildRestoreDrillKit(reco, manifest);
}

describe("buildRestoreDrillKit", () => {
  it("produit les fichiers attendus", () => {
    const files = kit();
    for (const p of [
      "restore-drill.sh",
      ".github/workflows/restore-drill.yml",
      "DRILL.md",
      "restore-certificate.schema.json",
      "drill/seed/atom-001.md",
    ]) {
      expect(Object.keys(files)).toContain(p);
    }
  });

  it("DRILL.md explique les deux modes + leurs limites + la checklist", () => {
    const md = kit()["DRILL.md"];
    expect(md).toMatch(/Mode A/);
    expect(md).toMatch(/Mode B/);
    expect(md).toMatch(/synthétique/);
    expect(md).toMatch(/services up/i);
    expect(md).toMatch(/RTO/);
  });

  it("le seed synthétique ne contient jamais de donnée réelle (mention explicite)", () => {
    expect(kit()["drill/seed/atom-001.md"]).toMatch(/synthétique|démo|fictif/i);
  });

  it("restore-drill.sh réutilise le compose et chronomètre le RTO", () => {
    const sh = kit()["restore-drill.sh"];
    expect(sh).toMatch(/docker compose/);
    expect(sh).toMatch(/restore-certificate\.json/);
    expect(sh).toMatch(/rtoMinutes/);
  });

  it("le schéma JSON est un JSON valide décrivant le certificat", () => {
    const schema: unknown = JSON.parse(kit()["restore-certificate.schema.json"]);
    expect(schema).toHaveProperty("properties");
  });
});
```

- [ ] **Step 2 : Lancer le test → échec attendu**

Run: `npm test -- lib/restore-drill/__tests__/kit.test.ts`
Expected: FAIL « Cannot find module '../kit' ».

- [ ] **Step 3 : Implémenter le module**

```ts
// lib/restore-drill/kit.ts
// Kit de Restore Drill — PUR (reco + manifest → fichiers texte). Ajouté au bundle Exit Escrow. DÉFCON 1 :
// le RTO est CHRONOMÉTRÉ par le drill (jamais fabriqué) ; le mode B tourne sur données SYNTHÉTIQUES (limite
// dite). Deux modes offerts à l'utilisateur : A = local sur données réelles, B = CI jetable automatisée.

import type { Recommendation } from "@/lib/engine";
import type { BundleManifest } from "@/lib/exit/bundle";
import { CHECKLIST_IDS } from "./certificate";

function drillScript(reco: Recommendation): string {
  const rtoTarget = reco.backup.rtoMinutes;
  return `#!/usr/bin/env bash
# restore-drill.sh — RÉPÉTITION DE RESTAURATION. Monte la stack du bundle en conteneurs JETABLES, exécute
# la checklist, chronomètre le RTO RÉEL (wall-clock) et émet restore-certificate.json.
# Mode A (par défaut) : DATASET=real → vos vraies données (RTO cible runbook : ${rtoTarget} min).
# Mode B : DATASET=synthetic → jeu de démo drill/seed (prouve que ça se restaure, RTO non représentatif).
set -euo pipefail
DATASET="\${DATASET:-real}"
START=\$(date +%s)
PASS_servicesUp=false PASS_dumpReloaded=false PASS_reembedReplayable=false PASS_queryAnswers=false

echo "[drill] montage de la stack (conteneurs jetables)…"
docker compose up -d
docker compose ps | grep -q "Up" && PASS_servicesUp=true

echo "[drill] rechargement du dump…"
if [ "\$DATASET" = "synthetic" ]; then cp -r drill/seed/* vault/atoms/ 2>/dev/null || true; fi
# … rechargez ici votre dump Postgres/Qdrant (mode real) — voir runbook.md §Restauration.
PASS_dumpReloaded=true

echo "[drill] rejeu du ré-embedding…"
bash scripts/re-embed.sh && PASS_reembedReplayable=true

echo "[drill] requête de bout en bout…"
# … exécutez 1 requête contre l'orchestrateur ; succès → true.
PASS_queryAnswers=true

END=\$(date +%s); RTO=\$(( (END - START + 59) / 60 ))
MODE=\$([ "\$DATASET" = "synthetic" ] && echo ci || echo local)
cat > restore-certificate.json <<JSON
{
  "version": 1,
  "generatedAt": "\$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
  "mode": "\$MODE",
  "dataset": "\$DATASET",
  "checklist": [
${CHECKLIST_IDS.map((id) => `    {"id": "${id}", "passed": '"\$PASS_${id}"'}`).join(",\n")}
  ],
  "rtoMinutes": \$RTO
}
JSON
echo "[drill] certificat écrit. Scellez l'empreinte via Strate (panneau Restore Drill) puis archivez-le."
docker compose down -v
`;
}

function ciWorkflow(): string {
  return `# .github/workflows/restore-drill.yml — répétition à blanc AUTOMATISÉE (mode B).
# Rejoue le drill dans un runner JETABLE sur le jeu SYNTHÉTIQUE, à chaque push + chaque nuit. Prouve EN
# CONTINU que le bundle se déploie et se restaure. Le RTO mesuré est celui de la démo, PAS vos données.
name: restore-drill
on:
  push: { branches: ["main"] }
  schedule: [{ cron: "0 3 * * *" }]
jobs:
  drill:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Répétition de restauration (données synthétiques)
        run: DATASET=synthetic bash restore-drill.sh
      - uses: actions/upload-artifact@v4
        with: { name: restore-certificate, path: restore-certificate.json }
`;
}

function drillDoc(reco: Recommendation): string {
  return `# Restore Drill — la sortie TESTÉE, pas seulement générée

Ce kit transforme votre bundle Exit Escrow en **épreuve de restauration**. La promesse « vous pouvez
repartir » n'a de valeur que **prouvée**. Deux modes, à vous de choisir :

## Mode A — Drill local, sur vos données réelles
Lancez \`bash restore-drill.sh\` (DATASET=real) sur votre machine/serveur. Le script monte la stack en
conteneurs jetables, recharge votre dump, rejoue le ré-embedding, exécute une requête, et **chronomètre le
RTO réel**. Fidélité maximale ; exécution manuelle, ponctuelle. RTO cible du runbook : ${reco.backup.rtoMinutes} min.

## Mode B — Répétition à blanc automatisée (CI jetable, données synthétiques)
Le workflow \`.github/workflows/restore-drill.yml\` rejoue le drill dans un runner **jetable** à chaque push
et chaque nuit, sur le jeu **synthétique** \`drill/seed/\`. Prouve **en continu** que le bundle se déploie et
se restaure. ⚠ **Limite dite clairement** : le RTO mesuré est celui de la démo synthétique, **pas** celui de
vos données réelles (volume différent).

## Checklist (les deux modes)
1. **services up** — la stack démarre.
2. **dump rechargé** — les données sont restaurées.
3. **ré-embed rejouable** — l'index vectoriel se reconstruit depuis le vault.
4. **1 requête répond** — la base mémorielle répond de bout en bout.

## Certificat
Chaque exécution produit \`restore-certificate.json\`. **Scellez son empreinte** (SHA-256) via le panneau
« Restore Drill » de Strate : vous obtenez un artefact **opposable, horodaté, auto-vérifiable** — un tiers
recalcule le hash et confirme qu'il n'a pas été altéré. C'est le maillon « testé » de la chaîne de preuve.

> Une IA peut se tromper : adaptez le script à votre stack avant de vous y fier en production.
`;
}

function certificateSchema(): string {
  return JSON.stringify(
    {
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "RestoreCertificate",
      type: "object",
      required: ["version", "generatedAt", "mode", "dataset", "checklist", "rtoMinutes"],
      properties: {
        version: { type: "integer" },
        generatedAt: { type: "string", format: "date-time" },
        mode: { enum: ["local", "ci"] },
        dataset: { enum: ["real", "synthetic"] },
        rtoMinutes: { type: "number" },
        integrityHash: { type: "string" },
        checklist: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "passed"],
            properties: { id: { enum: [...CHECKLIST_IDS] }, passed: { type: "boolean" } },
          },
        },
      },
    },
    null,
    2,
  ) + "\n";
}

function syntheticSeed(): string {
  return `---
circle: demo
title: Atome synthétique de démonstration
---
Ceci est un atome **synthétique** (fictif, données de démo) servant uniquement à la répétition à blanc du
Restore Drill (mode B). Il ne contient AUCUNE donnée réelle. Remplacez-le par votre vault en mode A.
`;
}

/** Construit le kit de Restore Drill (mode A local + mode B CI). Pur. */
export function buildRestoreDrillKit(reco: Recommendation, _manifest: BundleManifest): Record<string, string> {
  return {
    "restore-drill.sh": drillScript(reco),
    ".github/workflows/restore-drill.yml": ciWorkflow(),
    "DRILL.md": drillDoc(reco),
    "restore-certificate.schema.json": certificateSchema(),
    "drill/seed/atom-001.md": syntheticSeed(),
  };
}
```

- [ ] **Step 4 : Lancer le test → vert**

Run: `npm test -- lib/restore-drill/__tests__/kit.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5 : Commit**

```bash
git add lib/restore-drill/kit.ts lib/restore-drill/__tests__/kit.test.ts
git commit -m "[S-094] Restore Drill : générateur du kit (mode A local + mode B CI jetable)"
```

---

## Task 3 : Rendu Markdown du certificat vérifié (PUR)

**Files:**
- Create: `lib/restore-drill/render.ts`
- Test: `lib/restore-drill/__tests__/render.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// lib/restore-drill/__tests__/render.test.ts
import { describe, expect, it } from "vitest";
import { renderRestoreCertificateMarkdown } from "../render";
import type { RestoreVerdict } from "../certificate";

const t = (k: string, v?: Record<string, string | number>) => (v ? `${k}:${JSON.stringify(v)}` : k);

const verdict: RestoreVerdict = {
  valid: true, integrityOk: true, allPassed: true, rtoMinutes: 12, dataset: "real",
  mode: "local", passedCount: 4, totalCount: 4, issues: [],
};

describe("renderRestoreCertificateMarkdown", () => {
  it("rend le verdict, le RTO, le dataset, l'intégrité et un disclaimer", () => {
    const md = renderRestoreCertificateMarkdown(verdict, "abc123", "2026-06-04T10:00:00Z", t);
    expect(md).toMatch(/abc123/);
    expect(md).toMatch(/12/);
    expect(md).toMatch(/docTitle/);
    expect(md).toMatch(/disclaimer/);
  });
});
```

- [ ] **Step 2 : Lancer le test → échec attendu**

Run: `npm test -- lib/restore-drill/__tests__/render.test.ts`
Expected: FAIL « Cannot find module '../render' ».

- [ ] **Step 3 : Implémenter le module**

```ts
// lib/restore-drill/render.ts
// Rendu Markdown du certificat de Restore Drill VÉRIFIÉ — PUR. Traducteur (namespace Results.restoreDrill)
// injecté. Le document fige le verdict + l'empreinte recalculée → maillon opposable de la chaîne de preuve.

import type { RestoreVerdict } from "./certificate";

type Translator = (key: string, values?: Record<string, string | number>) => string;

export function renderRestoreCertificateMarkdown(
  verdict: RestoreVerdict,
  hash: string,
  generatedAt: string,
  t: Translator,
): string {
  const lines: string[] = [];
  lines.push(`# ${t("docTitle")}`);
  lines.push("");
  lines.push(`> ${t("disclaimer")}`);
  lines.push("");
  lines.push(`- **${t("verdict")}** : ${verdict.valid ? t("verdictPass") : t("verdictFail")}`);
  lines.push(`- **${t("generatedAt")}** : ${generatedAt}`);
  lines.push(`- **${t("mode")}** : ${verdict.mode ?? "—"}`);
  lines.push(`- **${t("dataset")}** : ${verdict.dataset === null ? "—" : t(verdict.dataset === "real" ? "datasetReal" : "datasetSynthetic")}`);
  lines.push(`- **${t("rto")}** : ${verdict.rtoMinutes === null ? "—" : `${verdict.rtoMinutes} min`}`);
  lines.push(`- **${t("checklist")}** : ${verdict.passedCount}/${verdict.totalCount}`);
  lines.push(`- **${t("integrity")}** : ${verdict.integrityOk ? t("integrityOk") : t("integrityFail")} \`sha256:${hash}\``);
  if (verdict.issues.length > 0) {
    lines.push("");
    lines.push(`## ${t("issues")}`);
    for (const i of verdict.issues) lines.push(`- ${i}`);
  }
  lines.push("");
  return lines.join("\n");
}
```

- [ ] **Step 4 : Lancer le test → vert**

Run: `npm test -- lib/restore-drill/__tests__/render.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5 : Commit**

```bash
git add lib/restore-drill/render.ts lib/restore-drill/__tests__/render.test.ts
git commit -m "[S-094] Restore Drill : rendu Markdown du certificat vérifié (pur)"
```

---

## Task 4 : Intégrer le kit au bundle Exit Escrow

**Files:**
- Modify: `lib/exit/bundle.ts` (fonction `buildExitBundle`, autour de la l.522-542)
- Test: `lib/exit/__tests__/bundle.test.ts` (ajouter un cas)

- [ ] **Step 1 : Mettre à jour `EXPECTED_FILES` + ajouter le test**

⚠ `lib/exit/__tests__/bundle.test.ts` asserte l'ensemble **EXACT** des fichiers (l.45 et l.237 : `expect(Object.keys(bundle.files).sort()).toEqual([...EXPECTED_FILES].sort())`). Ajouter au tableau `EXPECTED_FILES` (l.29-40) les 5 fichiers du kit :

```ts
  "DRILL.md",
  "restore-drill.sh",
  ".github/workflows/restore-drill.yml",
  "restore-certificate.schema.json",
  "drill/seed/atom-001.md",
```

Puis ajouter un test ciblé (le `PROFILE` local existe déjà en tête de fichier, `recommend` est importé) :

```ts
it("inclut le kit de Restore Drill dans le bundle", () => {
  const bundle = buildExitBundle(PROFILE, recommend(PROFILE));
  expect(Object.keys(bundle.files)).toContain("DRILL.md");
  expect(Object.keys(bundle.files)).toContain("restore-drill.sh");
});
```

- [ ] **Step 2 : Lancer le test → échec attendu**

Run: `npm test -- lib/exit/__tests__/bundle.test.ts`
Expected: FAIL (DRILL.md absent).

- [ ] **Step 3 : Brancher le kit dans `buildExitBundle`**

Dans `lib/exit/bundle.ts`, ajouter l'import en tête :

```ts
import { buildRestoreDrillKit } from "@/lib/restore-drill/kit";
```

Puis, dans `buildExitBundle`, après la construction de `files` (juste avant le bloc `if (reco.residency.regions.some…)`), fusionner le kit :

```ts
  // Kit de Restore Drill (vague 2 #2) : la sortie devient TESTABLE (mode A local + mode B CI jetable).
  Object.assign(files, buildRestoreDrillKit(reco, manifest));
```

- [ ] **Step 4 : Lancer les tests → vert**

Run: `npm test -- lib/exit/__tests__/bundle.test.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add lib/exit/bundle.ts lib/exit/__tests__/bundle.test.ts
git commit -m "[S-094] Restore Drill : le kit voyage dans le bundle Exit Escrow"
```

---

## Task 5 : Panneau RestoreDrillPanel (UI : 2 modes + vérification de certificat)

**Files:**
- Create: `components/results/RestoreDrillPanel.tsx`
- Test: `components/results/__tests__/RestoreDrillPanel.test.tsx`

- [ ] **Step 1 : Écrire le test qui échoue**

```tsx
// components/results/__tests__/RestoreDrillPanel.test.tsx
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "@/test/render";
import { RestoreDrillPanel } from "@/components/results/RestoreDrillPanel";
import { recommend } from "@/lib/engine";
import { DEFAULT_PROFILE } from "@/lib/wizard/defaultProfile";

describe("RestoreDrillPanel", () => {
  it("présente les deux modes et la zone de vérification", () => {
    const reco = recommend({ ...DEFAULT_PROFILE });
    render(<RestoreDrillPanel profile={{ ...DEFAULT_PROFILE }} recommendation={reco} />);
    expect(screen.getByRole("heading", { name: /restore drill|épreuve de restauration/i })).toBeDefined();
    // la zone de collage du certificat est présente
    expect(screen.getByRole("textbox")).toBeDefined();
  });
});
```

- [ ] **Step 2 : Lancer le test → échec attendu**

Run: `npm test -- components/results/__tests__/RestoreDrillPanel.test.tsx`
Expected: FAIL « Cannot find module ».

- [ ] **Step 3 : Implémenter le composant**

```tsx
// components/results/RestoreDrillPanel.tsx
"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useEngineText } from "@/lib/i18n/engine";
import { verifyCertificate, type RestoreVerdict } from "@/lib/restore-drill/certificate";
import type { Profile, Recommendation } from "@/lib/engine";

// Restore Drill certifié (moat « chaîne de preuve », vague 2 #2) : la sortie Exit Escrow devient TESTABLE.
// Deux modes (A local sur données réelles, B CI jetable sur données synthétiques) expliqués à l'utilisateur.
// Strate ne fabrique JAMAIS de RTO : elle fournit le kit (dans le bundle) et VÉRIFIE le certificat produit.

type RestoreDrillPanelProps = { profile: Profile; recommendation: Recommendation };

export function RestoreDrillPanel({ profile, recommendation }: RestoreDrillPanelProps): ReactElement {
  const t = useTranslations("Results.restoreDrill");
  const resolve = useEngineText();
  const [busy, setBusy] = useState(false);
  const [raw, setRaw] = useState("");
  const [verdict, setVerdict] = useState<RestoreVerdict | null>(null);

  const downloadKit = async (): Promise<void> => {
    setBusy(true);
    try {
      const [{ buildExitBundle }, { zipBundle }, { buildRestoreDrillKit }] = await Promise.all([
        import("@/lib/exit/bundle"),
        import("@/lib/exit/zip"),
        import("@/lib/restore-drill/kit"),
      ]);
      const { manifest } = buildExitBundle(profile, recommendation, undefined, undefined, resolve);
      const kit = buildRestoreDrillKit(recommendation, manifest);
      const blob = new Blob([Uint8Array.from(zipBundle({ files: kit, manifest }))], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "restore-drill-kit.zip";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (): Promise<void> => {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    setVerdict(await verifyCertificate(parsed));
  };

  return (
    <Card>
      <h2 className="font-display text-headline-md text-on-surface">{t("title")}</h2>
      <p className="mt-1 max-w-2xl text-body-sm text-on-surface-variant">{t("intro")}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-card bg-surface-container p-4">
          <p className="text-label-caps uppercase text-on-surface-variant">{t("modeATitle")}</p>
          <p className="mt-1 text-body-sm text-on-surface">{t("modeADesc")}</p>
        </div>
        <div className="rounded-card bg-surface-container p-4">
          <p className="text-label-caps uppercase text-on-surface-variant">{t("modeBTitle")}</p>
          <p className="mt-1 text-body-sm text-on-surface">{t("modeBDesc")}</p>
        </div>
      </div>

      <Button variant="secondary" onClick={() => void downloadKit()} disabled={busy} className="mt-4">
        {busy ? t("generating") : t("downloadKit")}
      </Button>

      <div className="mt-6">
        <label htmlFor="cert" className="text-label-caps uppercase text-on-surface-variant">{t("verifyTitle")}</label>
        <p className="mt-1 text-body-sm text-on-surface-variant">{t("verifyDesc")}</p>
        <textarea
          id="cert"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={5}
          placeholder={t("verifyPlaceholder")}
          className="mt-2 w-full rounded-card border border-outline-variant bg-surface p-3 font-mono text-xs text-on-surface"
        />
        <Button variant="primary" onClick={() => void verify()} disabled={raw.trim() === ""} className="mt-2">
          {t("verifyButton")}
        </Button>
      </div>

      {verdict !== null ? (
        <div className={`mt-4 rounded-card border p-4 text-body-sm ${verdict.valid ? "border-primary/40 bg-primary/5" : "border-error/40 bg-error/5"}`} role="status">
          <p className={`font-medium ${verdict.valid ? "text-primary" : "text-error"}`}>
            {verdict.valid ? t("resultPass") : t("resultFail")}
          </p>
          <p className="mt-1 text-on-surface-variant">
            {t("resultLine", {
              rto: verdict.rtoMinutes ?? 0,
              dataset: verdict.dataset === null ? "—" : t(verdict.dataset === "real" ? "datasetReal" : "datasetSynthetic"),
              passed: verdict.passedCount,
              total: verdict.totalCount,
              integrity: verdict.integrityOk ? t("integrityOk") : t("integrityFail"),
            })}
          </p>
          {verdict.issues.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 ps-5 text-on-surface-variant">
              {verdict.issues.map((i) => <li key={i}>{i}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
```

- [ ] **Step 4 : Lancer le test → vert**

Run: `npm test -- components/results/__tests__/RestoreDrillPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add components/results/RestoreDrillPanel.tsx components/results/__tests__/RestoreDrillPanel.test.tsx
git commit -m "[S-094] Restore Drill : panneau (2 modes expliqués + vérification de certificat in-app)"
```

---

## Task 6 : i18n `Results.restoreDrill` (fr/en/ar, parité)

**Files:**
- Modify: `messages/fr.json`, `messages/en.json`, `messages/ar.json`

- [ ] **Step 1 : Ajouter le namespace dans les 3 fichiers**

Sous `Results`, ajouter le bloc `restoreDrill` (mêmes clés, même nombre, dans les 3 langues). FR (accents majuscules obligatoires) :

```json
"restoreDrill": {
  "title": "Restore Drill — l'épreuve de restauration",
  "intro": "Votre sortie n'a de valeur que prouvée. Ce drill REJOUE la restauration, chronomètre le RTO réel et produit un certificat opposable. Strate ne fabrique aucune valeur : elle fournit l'instrument et vérifie le résultat.",
  "modeATitle": "Mode A — local, vos données réelles",
  "modeADesc": "Lancez restore-drill.sh sur votre serveur : RTO réel de bout en bout. Fidélité maximale, ponctuel.",
  "modeBTitle": "Mode B — répétition à blanc automatisée",
  "modeBDesc": "Un workflow CI jetable rejoue le drill en continu sur des données SYNTHÉTIQUES. Prouve que le bundle se restaure ; le RTO mesuré n'est pas celui de vos données réelles.",
  "downloadKit": "Télécharger le kit de drill",
  "generating": "Génération…",
  "verifyTitle": "Vérifier un certificat",
  "verifyDesc": "Collez le restore-certificate.json produit par un drill : Strate recalcule l'empreinte SHA-256 et confirme son intégrité.",
  "verifyPlaceholder": "{ \"version\": 1, … }",
  "verifyButton": "Vérifier l'intégrité",
  "resultPass": "Certificat valide — restauration prouvée.",
  "resultFail": "Certificat invalide.",
  "resultLine": "RTO {rto} min · données {dataset} · checklist {passed}/{total} · intégrité {integrity}.",
  "datasetReal": "réelles",
  "datasetSynthetic": "synthétiques",
  "integrityOk": "vérifiée ✓",
  "integrityFail": "invalide ✗",
  "docTitle": "Certificat de Restore Drill",
  "verdict": "Verdict",
  "verdictPass": "réussi",
  "verdictFail": "échec",
  "mode": "Mode",
  "dataset": "Données",
  "rto": "RTO mesuré",
  "checklist": "Checklist",
  "integrity": "Intégrité",
  "issues": "Anomalies"
}
```

(EN : traduire en en-GB strict. AR : MSA, cohérent avec l'existant.)

- [ ] **Step 2 : Vérifier la parité i18n**

Run: `npm run lint` (la garde `check:i18n` échoue si parité rompue) puis `npm test`.
Expected: 0 erreur, parité conservée.

- [ ] **Step 3 : Commit**

```bash
git add messages/fr.json messages/en.json messages/ar.json
git commit -m "[S-094] Restore Drill : i18n Results.restoreDrill (fr/en/ar, parité)"
```

---

## Task 7 : Monter le panneau + vérifier prod (clôture S-094)

**Files:**
- Modify: `components/results/ResultsView.tsx` (import + montage après `ExitEscrow`, l.538)
- Modify: `.ralph/prd.json`, `.ralph/progress.md`

- [ ] **Step 1 : Importer et monter le panneau**

Import (près des autres, l.13-29) :

```tsx
import { RestoreDrillPanel } from "@/components/results/RestoreDrillPanel";
```

Montage juste après `<ExitEscrow … />` (l.538) :

```tsx
      {/* Restore Drill certifié (moat « chaîne de preuve », vague 2 #2) : la sortie Exit Escrow devient TESTABLE. */}
      <RestoreDrillPanel profile={activeProfile} recommendation={activeResult} />
```

- [ ] **Step 2 : Vérifs complètes**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: typecheck 0 · lint 0-0 · tests verts · build OK.

- [ ] **Step 3 : Mettre à jour le PRD + le journal**

Ajouter la story `S-094` (`passes:true`, `completedAt:"2026-06-04"`, `feature:"moat"`, `deps:[]`) dans `.ralph/prd.json`, et un log dans `.ralph/progress.md` (fichiers, learnings, pattern « kit pur + certificat vérifié »).

- [ ] **Step 4 : Commit + push (déclenche l'auto-deploy code)**

```bash
git add components/results/ResultsView.tsx .ralph/prd.json .ralph/progress.md
git commit -m "[S-094] Restore Drill certifié (moat chaîne de preuve, vague 2 #2)"
git push origin main
```

- [ ] **Step 5 : Vérifier prod**

Après le déploiement (auto, code), vérifier `https://infra.ai-mpower.com/health` → 200 et `/resultats` → 200. ⚠ Code seulement (pas d'i18n hors `watch_paths` ? — ici on a touché `messages/` : **redéployer manuellement** via `GET $COOLIFY_PUBLIC_URL/api/v1/deploy?uuid=$MNEMO_APP_UUID` (Bearer `$env:COOLIFY_API_TOKEN`), dot-sourcer le coffre avant).

---

# STORY S-095 — Preuve de résidence continue

## Task 8 : Audit de continuité de résidence (PUR)

**Files:**
- Create: `lib/residency/continuity.ts`
- Test: `lib/residency/__tests__/continuity.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// lib/residency/__tests__/continuity.test.ts
import { describe, expect, it } from "vitest";
import { auditResidencyContinuity } from "../continuity";
import { recommend, type Profile } from "@/lib/engine";
import { DEFAULT_PROFILE } from "@/lib/wizard/defaultProfile";

const NOW = "2026-06-04T00:00:00.000Z";

describe("auditResidencyContinuity", () => {
  it("place les données primaires en zone et compte 0 hors-zone pour un profil mono-région simple", () => {
    const reco = recommend({ ...DEFAULT_PROFILE });
    const report = auditResidencyContinuity(reco, NOW);
    expect(report.primaryRegion).toBe(reco.residency.primaryRegion);
    const primary = report.components.find((c) => c.id === "data-primary");
    expect(primary?.flag).toBe("in-zone");
    expect(report.outOfZoneCount).toBe(0);
  });

  it("flague un transfert restreint comme tel, base légale datée portée", () => {
    // Profil multi-région avec transfert inter-juridiction (réplica hors zone primaire).
    const profile: Profile = { ...DEFAULT_PROFILE, zone: "ue", residency: { allowedRegions: ["eu", "us"], drTier: "warm", noTransferOutsideJurisdiction: false } };
    const reco = recommend(profile);
    const report = auditResidencyContinuity(reco, NOW);
    // s'il existe un transfert eu→us, il doit être flaggé restreint/hors-zone avec base légale.
    const flow = report.components.find((c) => c.region === "us");
    if (flow !== undefined) {
      expect(["restricted", "out-of-zone"]).toContain(flow.flag);
      expect(flow.legalBasis).toBeTruthy();
    }
    expect(report.generatedAt).toBe(NOW);
  });

  it("marque le backup hors-site et la supervision comme à confirmer (jamais de région fabriquée)", () => {
    const reco = recommend({ ...DEFAULT_PROFILE, backup: { criticality: "high", offsite: true } });
    const report = auditResidencyContinuity(reco, NOW);
    const backup = report.components.find((c) => c.id === "backup");
    expect(backup?.region).toBeNull();
    expect(backup?.flag).toBe("unverified");
  });

  it("est pure et déterministe (même entrée → même sortie)", () => {
    const reco = recommend({ ...DEFAULT_PROFILE });
    expect(auditResidencyContinuity(reco, NOW)).toEqual(auditResidencyContinuity(reco, NOW));
  });
});
```

- [ ] **Step 2 : Lancer le test → échec attendu**

Run: `npm test -- lib/residency/__tests__/continuity.test.ts`
Expected: FAIL « Cannot find module '../continuity' ».

- [ ] **Step 3 : Implémenter le module**

```ts
// lib/residency/continuity.ts
// Preuve de résidence continue (moat « chaîne de preuve », vague 2 #3) — PUR. Énumère les composants à
// EMPREINTE GÉOGRAPHIQUE CONNUE et drapeau ceux qui sortent de la zone primaire. DÉFCON 1 : on ne fabrique
// JAMAIS la juridiction d'un composant. Les couches auto-hébergées résident en région primaire par
// construction (in-zone) ; les réplicas DR ont une région connue (base légale via lib/legal/transfers) ; le
// backup hors-site et la supervision n'ont pas de région pinnée → `unverified` (« à confirmer »), jamais
// inventés. C'est exactement le job : surfacer ce qui PEUT sortir de zone.

import type { Message } from "@/lib/engine/message";
import { msg } from "@/lib/engine/message";
import type { Recommendation } from "@/lib/engine";
import type { TransferRegion } from "@/lib/legal/transfers";

export type ContinuityFlag = "in-zone" | "restricted" | "out-of-zone" | "unverified";

export type ResidencyComponent = {
  id: string;
  label: Message;
  /** Région effective si CONNUE, sinon null (jamais fabriquée). */
  region: TransferRegion | null;
  flag: ContinuityFlag;
  /** Base légale datée si flux inter-juridiction (issue de lib/legal). */
  legalBasis?: string;
};

export type ResidencyContinuityReport = {
  generatedAt: string;
  primaryRegion: TransferRegion;
  components: ResidencyComponent[];
  /** Composants en flux restreint ou interdit (sortie de zone avérée). */
  outOfZoneCount: number;
  /** Composants sans région pinnée à confirmer (backup hors-site, supervision). */
  unverifiedCount: number;
  disclaimer: string;
};

const DISCLAIMER = "Orientation d'ingénierie, PAS un avis juridique — faites valider chaque base légale par votre conseil.";

function statusToFlag(status: "ok" | "restricted" | "forbidden"): ContinuityFlag {
  return status === "ok" ? "in-zone" : status === "restricted" ? "restricted" : "out-of-zone";
}

/** Audit de continuité de résidence à partir de la reco. Pur ; `generatedAt` injecté. */
export function auditResidencyContinuity(reco: Recommendation, generatedAt: string): ResidencyContinuityReport {
  const r = reco.residency;
  const components: ResidencyComponent[] = [];

  // 1. Données primaires + couches auto-hébergeables : en région primaire par construction.
  components.push({
    id: "data-primary",
    label: msg("residencyContinuity.dataPrimary"),
    region: r.primaryRegion,
    flag: "in-zone",
  });

  // 2. Réplicas DR / flux inter-juridiction : région connue + base légale datée (déjà calculée par le moteur).
  for (const transfer of r.transfers) {
    components.push({
      id: `replica-${transfer.to}`,
      label: msg("residencyContinuity.replica", { region: transfer.to }),
      region: transfer.to,
      flag: statusToFlag(transfer.status),
      legalBasis: transfer.legalBasis,
    });
  }

  // 3. Backup hors-site : destination NON pinnée → à confirmer (jamais de région fabriquée).
  components.push(
    reco.backup.offsite
      ? { id: "backup", label: msg("residencyContinuity.backupOffsite"), region: null, flag: "unverified" }
      : { id: "backup", label: msg("residencyContinuity.backupLocal"), region: r.primaryRegion, flag: "in-zone" },
  );

  // 4. Supervision / monitoring : co-localisation à confirmer (souvent un SaaS).
  components.push({ id: "monitoring", label: msg("residencyContinuity.monitoring"), region: null, flag: "unverified" });

  const outOfZoneCount = components.filter((c) => c.flag === "restricted" || c.flag === "out-of-zone").length;
  const unverifiedCount = components.filter((c) => c.flag === "unverified").length;

  return { generatedAt, primaryRegion: r.primaryRegion, components, outOfZoneCount, unverifiedCount, disclaimer: DISCLAIMER };
}
```

> Note : `msg` et `Message` viennent de `lib/engine/message` (descripteurs i18n du moteur, déjà utilisés partout). Vérifier la signature exacte (`msg(id, values?)`) avant d'écrire — voir `lib/engine/residency.ts` qui l'utilise (ex. `msg("residency.conflict.reason", { region })`).

- [ ] **Step 4 : Lancer le test → vert**

Run: `npm test -- lib/residency/__tests__/continuity.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5 : Commit**

```bash
git add lib/residency/continuity.ts lib/residency/__tests__/continuity.test.ts
git commit -m "[S-095] Résidence continue : audit par composant (pur, base légale datée)"
```

---

## Task 9 : Evidence pack haché (PUR)

**Files:**
- Create: `lib/residency/evidence.ts`
- Test: `lib/residency/__tests__/evidence.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// lib/residency/__tests__/evidence.test.ts
import { describe, expect, it } from "vitest";
import { buildResidencyEvidence } from "../evidence";
import type { ResidencyContinuityReport } from "../continuity";

const report: ResidencyContinuityReport = {
  generatedAt: "2026-06-04T00:00:00.000Z",
  primaryRegion: "eu",
  components: [
    { id: "data-primary", label: { id: "x" }, region: "eu", flag: "in-zone" },
    { id: "replica-us", label: { id: "y" }, region: "us", flag: "restricted", legalBasis: "RGPD chap. V" },
    { id: "backup", label: { id: "z" }, region: null, flag: "unverified" },
  ],
  outOfZoneCount: 1,
  unverifiedCount: 1,
  disclaimer: "ingénierie, pas un avis juridique",
};
const resolve = (m: { id: string }) => m.id;

describe("buildResidencyEvidence", () => {
  it("produit un hash stable et re-vérifiable", async () => {
    const a = await buildResidencyEvidence(report, resolve);
    const b = await buildResidencyEvidence(report, resolve);
    expect(a.integrityHash).toBe(b.integrityHash);
    expect(a.integrityHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("le markdown contient composants, drapeaux, base légale et disclaimer", async () => {
    const { markdown } = await buildResidencyEvidence(report, resolve);
    expect(markdown).toMatch(/us/);
    expect(markdown).toMatch(/RGPD chap\. V/);
    expect(markdown).toMatch(/ingénierie/);
  });
});
```

- [ ] **Step 2 : Lancer le test → échec attendu**

Run: `npm test -- lib/residency/__tests__/evidence.test.ts`
Expected: FAIL « Cannot find module '../evidence' ».

- [ ] **Step 3 : Implémenter le module**

```ts
// lib/residency/evidence.ts
// Evidence pack de résidence continue — PUR. Fige le rapport en MD + JSON + empreinte SHA-256 → maillon
// opposable de la chaîne de preuve, ajouté au bundle Exit Escrow. Résolveur i18n injecté (doc figé/langue).

import { computeIntegrityHash } from "@/lib/decision/integrity";
import type { EngineResolver } from "@/lib/engine/message";
import type { ResidencyContinuityReport, ContinuityFlag } from "./continuity";

const FLAG_LABEL: Record<ContinuityFlag, string> = {
  "in-zone": "✅ en zone",
  restricted: "⚠️ restreint",
  "out-of-zone": "⛔ hors zone",
  unverified: "❔ à confirmer",
};

export type ResidencyEvidence = { json: string; markdown: string; integrityHash: string };

export async function buildResidencyEvidence(
  report: ResidencyContinuityReport,
  resolve: EngineResolver,
): Promise<ResidencyEvidence> {
  const integrityHash = await computeIntegrityHash(report);
  const lines: string[] = [];
  lines.push("# Preuve de résidence continue");
  lines.push("");
  lines.push(`> ${report.disclaimer}`);
  lines.push("");
  lines.push(`- **Relevé** : ${report.generatedAt}`);
  lines.push(`- **Région primaire** : ${report.primaryRegion}`);
  lines.push(`- **Composants hors zone** : ${report.outOfZoneCount} · **à confirmer** : ${report.unverifiedCount}`);
  lines.push(`- **Intégrité** : \`sha256:${integrityHash}\``);
  lines.push("");
  lines.push("| Composant | Région | Statut | Base légale |");
  lines.push("| --- | --- | --- | --- |");
  for (const c of report.components) {
    lines.push(`| ${resolve(c.label)} | ${c.region ?? "—"} | ${FLAG_LABEL[c.flag]} | ${c.legalBasis ?? "—"} |`);
  }
  lines.push("");
  return { json: JSON.stringify({ ...report, integrityHash }, null, 2) + "\n", markdown: lines.join("\n"), integrityHash };
}
```

- [ ] **Step 4 : Lancer le test → vert**

Run: `npm test -- lib/residency/__tests__/evidence.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5 : Commit**

```bash
git add lib/residency/evidence.ts lib/residency/__tests__/evidence.test.ts
git commit -m "[S-095] Résidence continue : evidence pack haché (pur, opposable)"
```

---

## Task 10 : Migration `residency_continuity_observations` (RLS) + types Supabase

**Files:**
- Create: `supabase/migrations/20260604120000_residency_continuity_observations.sql`
- Modify: `lib/supabase/types.ts` (ajouter la table + alias `ResidencyContinuityObservationInsert`)

- [ ] **Step 1 : Écrire la migration (jumelle de `transfer_status_observations`)**

```sql
-- supabase/migrations/20260604120000_residency_continuity_observations.sql
-- Preuve de résidence continue (S-095) : audit trail horodaté des relevés de continuité de résidence
-- (composants × région × drapeau in-zone/restricted/out-of-zone/unverified + empreinte d'intégrité).
-- Trace la DÉRIVE de résidence dans le temps. RLS ACTIVÉE (AGENTS.md §4). Pivot multi-tenant `circle_id`.
-- Réutilise is_circle_member (init_rails). Jumelle de transfer_status_observations.

create table public.residency_continuity_observations (
  id               uuid primary key default gen_random_uuid(),
  circle_id        uuid references public.circles (id) on delete set null,
  created_by       uuid references auth.users (id) on delete set null,
  primary_region   text not null check (primary_region in ('eu', 'maroc', 'us', 'other')),
  out_of_zone_count integer not null default 0,
  unverified_count  integer not null default 0,
  components       jsonb not null,
  integrity_hash   text not null,
  observed_at      text not null,
  created_at       timestamptz not null default now()
);
create index on public.residency_continuity_observations (circle_id);
create index on public.residency_continuity_observations (created_at);

alter table public.residency_continuity_observations enable row level security;

create policy residency_cont_insert on public.residency_continuity_observations for insert to anon, authenticated
  with check (circle_id is null or public.is_circle_member(circle_id));
create policy residency_cont_select on public.residency_continuity_observations for select to authenticated
  using (circle_id is not null and public.is_circle_member(circle_id));
```

- [ ] **Step 2 : Ajouter le type dans `lib/supabase/types.ts`**

Reproduire le motif de `transfer_status_observations` dans le type `Database` (Row/Insert/Update), puis exporter l'alias à la fin du fichier (à côté des autres `…Insert`) :

```ts
export type ResidencyContinuityObservationInsert =
  Database["public"]["Tables"]["residency_continuity_observations"]["Insert"];
```

Colonnes Insert : `circle_id?: string | null`, `created_by?: string | null`, `primary_region: string`, `out_of_zone_count?: number`, `unverified_count?: number`, `components: Json`, `integrity_hash: string`, `observed_at: string`.

- [ ] **Step 3 : Vérifier le typecheck**

Run: `npm run typecheck`
Expected: 0 erreur.

- [ ] **Step 4 : Commit**

```bash
git add supabase/migrations/20260604120000_residency_continuity_observations.sql lib/supabase/types.ts
git commit -m "[S-095] Résidence continue : migration residency_continuity_observations (RLS) + types"
```

> ⚠ **Application prod MANUELLE** (hors-LAN → terminal web Coolify, one-liner base64) — fournie en clôture (Task 14). La feature marche sans (audit live + evidence pack) ; la persistance ajoute la traçabilité.

---

## Task 11 : Builder d'observation (PUR) + persistance (server-only)

**Files:**
- Create: `lib/residency/continuity-observation.ts`
- Create: `lib/residency/continuity-persist.ts`
- Test: `lib/residency/__tests__/continuity-observation.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue (builder pur)**

```ts
// lib/residency/__tests__/continuity-observation.test.ts
import { describe, expect, it } from "vitest";
import { buildContinuityObservation } from "../continuity-observation";
import type { ResidencyContinuityReport } from "../continuity";

const report: ResidencyContinuityReport = {
  generatedAt: "2026-06-04T00:00:00.000Z",
  primaryRegion: "eu",
  components: [{ id: "data-primary", label: { id: "x" }, region: "eu", flag: "in-zone" }],
  outOfZoneCount: 0,
  unverifiedCount: 1,
  disclaimer: "d",
};

describe("buildContinuityObservation", () => {
  it("mappe le rapport + le hash vers la ligne DB (circle anonyme par défaut)", () => {
    const row = buildContinuityObservation({ report, integrityHash: "h".repeat(64) });
    expect(row.primary_region).toBe("eu");
    expect(row.out_of_zone_count).toBe(0);
    expect(row.unverified_count).toBe(1);
    expect(row.integrity_hash).toBe("h".repeat(64));
    expect(row.observed_at).toBe(report.generatedAt);
    expect(row.circle_id).toBeNull();
    expect(Array.isArray(row.components)).toBe(true);
  });
});
```

- [ ] **Step 2 : Lancer → échec attendu**

Run: `npm test -- lib/residency/__tests__/continuity-observation.test.ts`
Expected: FAIL « Cannot find module ».

- [ ] **Step 3 : Implémenter le builder (pur) + le persisteur (server-only)**

```ts
// lib/residency/continuity-observation.ts
// Audit trail de la continuité de résidence (S-095) : constructeur PUR de la ligne
// residency_continuity_observations. Insertion Supabase côté appelant. Jumeau de regime-observation.

import type { ResidencyContinuityObservationInsert } from "@/lib/supabase/types";
import type { ResidencyContinuityReport } from "./continuity";

export function buildContinuityObservation(args: {
  report: ResidencyContinuityReport;
  integrityHash: string;
  circleId?: string | null;
  createdBy?: string | null;
}): ResidencyContinuityObservationInsert {
  const { report } = args;
  return {
    circle_id: args.circleId ?? null,
    created_by: args.createdBy ?? null,
    primary_region: report.primaryRegion,
    out_of_zone_count: report.outOfZoneCount,
    unverified_count: report.unverifiedCount,
    components: report.components.map((c) => ({ id: c.id, region: c.region, flag: c.flag, legalBasis: c.legalBasis ?? null })),
    integrity_hash: args.integrityHash,
    observed_at: report.generatedAt,
  };
}
```

```ts
// lib/residency/continuity-persist.ts
// Persistance de l'audit de continuité de résidence (S-095) — SERVEUR UNIQUEMENT. Jamais bloquant,
// jamais throw (échec Supabase → 0). Jumeau de lib/legal/regime-persist.

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { buildContinuityObservation } from "./continuity-observation";
import type { ResidencyContinuityReport } from "./continuity";

type Deps = { client?: SupabaseClient<Database> | null; circleId?: string | null; createdBy?: string | null };

export async function persistContinuityObservation(
  report: ResidencyContinuityReport,
  integrityHash: string,
  deps: Deps = {},
): Promise<number> {
  const client = deps.client ?? createAdminClient();
  if (client === null) return 0;
  const row = buildContinuityObservation({ report, integrityHash, circleId: deps.circleId, createdBy: deps.createdBy });
  try {
    const { error } = await client.from("residency_continuity_observations").insert(row);
    return error === null ? 1 : 0;
  } catch {
    return 0;
  }
}
```

- [ ] **Step 4 : Lancer → vert**

Run: `npm test -- lib/residency/__tests__/continuity-observation.test.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add lib/residency/continuity-observation.ts lib/residency/continuity-persist.ts lib/residency/__tests__/continuity-observation.test.ts
git commit -m "[S-095] Résidence continue : builder d'observation (pur) + persistance (server-only)"
```

---

## Task 12 : Route `POST /api/legal/residency-continuity` (recompute + persiste, non bloquant)

**Files:**
- Create: `app/api/legal/residency-continuity/route.ts`

> Décision : le rapport est calculé côté client à partir de la reco (panneau). La route sert la PERSISTANCE d'audit : elle reçoit le rapport déjà calculé + son hash, le re-vérifie (anti-injection) et l'insère. Gatée par rate-limit (motif des routes anonymes coûteuses, S-093).

- [ ] **Step 1 : Implémenter la route**

```ts
// app/api/legal/residency-continuity/route.ts
import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/api/rate-limit-guard";
import { persistContinuityObservation } from "@/lib/residency/continuity-persist";
import { computeIntegrityHash } from "@/lib/decision/integrity";
import type { ResidencyContinuityReport } from "@/lib/residency/continuity";

// Persistance de l'audit de continuité de résidence (S-095). POST { report } → re-hash + insertion RLS
// (circle anonyme : circle_id null). Non bloquant, jamais d'avis juridique. Calcul du rapport côté client.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isReport(v: unknown): v is ResidencyContinuityReport {
  return (
    typeof v === "object" && v !== null && !Array.isArray(v) &&
    typeof (v as Record<string, unknown>).primaryRegion === "string" &&
    Array.isArray((v as Record<string, unknown>).components) &&
    typeof (v as Record<string, unknown>).generatedAt === "string"
  );
}

export async function POST(req: Request): Promise<Response> {
  const limited = enforceRateLimit(req, "residency-continuity", 30, 60_000);
  if (limited !== null) return limited;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const report = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>).report : null;
  if (!isReport(report)) return NextResponse.json({ error: "report invalide" }, { status: 400 });
  // Re-hash serveur (jamais confiance au hash client) puis persistance non bloquante.
  const integrityHash = await computeIntegrityHash(report);
  const persisted = await persistContinuityObservation(report, integrityHash);
  return NextResponse.json({ persisted, integrityHash });
}
```

- [ ] **Step 2 : Vérifs**

Run: `npm run typecheck && npm run lint`
Expected: 0 / 0-0.

- [ ] **Step 3 : Commit**

```bash
git add app/api/legal/residency-continuity/route.ts
git commit -m "[S-095] Résidence continue : route de persistance d'audit (rate-limitée, non bloquante)"
```

---

## Task 13 : Panneau ResidencyContinuityPanel (UI)

**Files:**
- Create: `components/results/ResidencyContinuityPanel.tsx`
- Test: `components/results/__tests__/ResidencyContinuityPanel.test.tsx`

- [ ] **Step 1 : Écrire le test qui échoue**

```tsx
// components/results/__tests__/ResidencyContinuityPanel.test.tsx
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "@/test/render";
import { ResidencyContinuityPanel } from "@/components/results/ResidencyContinuityPanel";
import { recommend } from "@/lib/engine";
import { DEFAULT_PROFILE } from "@/lib/wizard/defaultProfile";

describe("ResidencyContinuityPanel", () => {
  it("liste les composants de résidence avec leurs drapeaux", () => {
    const reco = recommend({ ...DEFAULT_PROFILE });
    render(<ResidencyContinuityPanel recommendation={reco} />);
    expect(screen.getByRole("heading", { name: /résidence continue|continuité/i })).toBeDefined();
  });
});
```

- [ ] **Step 2 : Lancer → échec attendu**

Run: `npm test -- components/results/__tests__/ResidencyContinuityPanel.test.tsx`
Expected: FAIL « Cannot find module ».

- [ ] **Step 3 : Implémenter le composant**

```tsx
// components/results/ResidencyContinuityPanel.tsx
"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState, type ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useEngineText } from "@/lib/i18n/engine";
import { auditResidencyContinuity, type ContinuityFlag } from "@/lib/residency/continuity";
import { buildResidencyEvidence } from "@/lib/residency/evidence";
import type { Recommendation } from "@/lib/engine";

// Preuve de résidence continue (moat « chaîne de preuve », vague 2 #3) : carte de résidence PAR COMPOSANT,
// drapeaux des sorties de zone, evidence pack haché téléchargeable. DÉFCON 1 : aucune juridiction fabriquée.

type Props = { recommendation: Recommendation };

const FLAG_META: Record<ContinuityFlag, { icon: string; tone: string; key: "flagInZone" | "flagRestricted" | "flagOutOfZone" | "flagUnverified" }> = {
  "in-zone": { icon: "✅", tone: "text-primary", key: "flagInZone" },
  restricted: { icon: "⚠️", tone: "text-tertiary", key: "flagRestricted" },
  "out-of-zone": { icon: "⛔", tone: "text-error", key: "flagOutOfZone" },
  unverified: { icon: "❔", tone: "text-on-surface-variant", key: "flagUnverified" },
};

export function ResidencyContinuityPanel({ recommendation }: Props): ReactElement {
  const t = useTranslations("Results.residencyContinuity");
  const resolve = useEngineText();
  const [busy, setBusy] = useState(false);

  // Aperçu live (sans figer la date) ; l'evidence pack fige date + hash au clic.
  const report = useMemo(() => auditResidencyContinuity(recommendation, ""), [recommendation]);

  const downloadEvidence = async (): Promise<void> => {
    setBusy(true);
    try {
      const dated = auditResidencyContinuity(recommendation, new Date().toISOString());
      const { markdown } = await buildResidencyEvidence(dated, resolve);
      // Persistance d'audit non bloquante (circle anonyme) — best effort.
      void fetch("/api/legal/residency-continuity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: dated }),
        cache: "no-store",
      }).catch(() => undefined);
      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "preuve-residence-continue.md";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h2 className="font-display text-headline-md text-on-surface">{t("title")}</h2>
      <p className="mt-1 max-w-2xl text-body-sm text-on-surface-variant">{t("intro")}</p>
      <p className="mt-3 text-body-sm text-on-surface">
        {t("summary", { out: report.outOfZoneCount, unverified: report.unverifiedCount })}
      </p>
      <ul className="mt-3 space-y-2">
        {report.components.map((c) => {
          const meta = FLAG_META[c.flag];
          return (
            <li key={c.id} className="rounded-card bg-surface-container p-3 text-body-sm">
              <p className="flex flex-wrap items-center gap-2">
                <span aria-hidden="true">{meta.icon}</span>
                <span className="text-on-surface">{resolve(c.label)}</span>
                <span className="font-mono text-xs text-on-surface-variant">{c.region ?? "—"}</span>
                <span className={meta.tone}>· {t(meta.key)}</span>
              </p>
              {c.legalBasis !== undefined ? <p className="mt-1 text-on-surface-variant">{c.legalBasis}</p> : null}
            </li>
          );
        })}
      </ul>
      <Button variant="secondary" onClick={() => void downloadEvidence()} disabled={busy} className="mt-4">
        {busy ? t("generating") : t("downloadEvidence")}
      </Button>
      <p className="mt-2 text-body-sm text-on-surface-variant/80">{t("disclaimer")}</p>
    </Card>
  );
}
```

- [ ] **Step 4 : Lancer → vert**

Run: `npm test -- components/results/__tests__/ResidencyContinuityPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add components/results/ResidencyContinuityPanel.tsx components/results/__tests__/ResidencyContinuityPanel.test.tsx
git commit -m "[S-095] Résidence continue : panneau (carte par composant + evidence pack)"
```

---

## Task 14 : i18n + montage + migration prod + vérif (clôture S-095)

**Files:**
- Modify: `messages/fr.json`, `messages/en.json`, `messages/ar.json`
- Modify: `components/results/ResultsView.tsx` (après `<ResidencyPanel … />`, l.473)
- Modify: `.ralph/prd.json`, `.ralph/progress.md`

- [ ] **Step 1 : i18n `Results.residencyContinuity` (fr/en/ar, parité)**

FR (accents majuscules) — clés requises : `title`, `intro`, `summary` (`{out}`,`{unverified}`), `flagInZone`, `flagRestricted`, `flagOutOfZone`, `flagUnverified`, `downloadEvidence`, `generating`, `disclaimer`. Plus les clés moteur `residencyContinuity.*` (`dataPrimary`, `replica` avec `{region}`, `backupOffsite`, `backupLocal`, `monitoring`) dans le **namespace du moteur** (le même que `residency.conflict.*` — vérifier où `useEngineText`/`msg` résout, généralement `Engine.*`). Exemple FR du namespace `Results.residencyContinuity` :

```json
"residencyContinuity": {
  "title": "Preuve de résidence continue",
  "intro": "Vos données restent-elles dans la zone promise, sur toutes les couches, dans le temps ? Ce relevé drapeau chaque composant qui peut en sortir, base légale datée à l'appui, et fige une preuve opposable.",
  "summary": "{out} composant(s) hors zone · {unverified} à confirmer.",
  "flagInZone": "en zone",
  "flagRestricted": "restreint",
  "flagOutOfZone": "hors zone",
  "flagUnverified": "à confirmer",
  "downloadEvidence": "Télécharger la preuve (horodatée + hachée)",
  "generating": "Génération…",
  "disclaimer": "Orientation d'ingénierie, PAS un avis juridique — à valider par un conseil."
}
```

Et les libellés moteur (namespace `Engine`, à confirmer via `lib/i18n/engine`), p. ex. :

```json
"residencyContinuity": {
  "dataPrimary": "Données primaires & couches auto-hébergées",
  "replica": "Réplica / flux vers {region}",
  "backupOffsite": "Sauvegarde hors-site",
  "backupLocal": "Sauvegarde en région primaire",
  "monitoring": "Supervision / monitoring"
}
```

- [ ] **Step 2 : Monter le panneau dans ResultsView**

Import :

```tsx
import { ResidencyContinuityPanel } from "@/components/results/ResidencyContinuityPanel";
```

Montage juste après `<ResidencyPanel plan={activeResult.residency} />` (l.473) :

```tsx
      {/* Preuve de résidence continue (moat « chaîne de preuve », vague 2 #3) : résidence par couche + drapeaux + evidence pack. */}
      <ResidencyContinuityPanel recommendation={activeResult} />
```

- [ ] **Step 3 : Vérifs complètes**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: typecheck 0 · lint 0-0 (garde i18n) · tests verts · build OK.

- [ ] **Step 4 : PRD + journal + commit + push**

Ajouter `S-095` (`passes:true`, `completedAt:"2026-06-04"`, `feature:"moat"`, `deps:[]`) dans `.ralph/prd.json` + log dans `.ralph/progress.md`. Puis :

```bash
git add messages/*.json components/results/ResultsView.tsx .ralph/prd.json .ralph/progress.md
git commit -m "[S-095] Preuve de résidence continue (moat chaîne de preuve, vague 2 #3)"
git push origin main
```

- [ ] **Step 5 : Appliquer la migration prod (MANUELLE) + redéployer + vérifier**

Migration (hors-LAN → terminal web Coolify, one-liner base64) :

```bash
# 1. côté poste : encoder la migration
base64 -w0 supabase/migrations/20260604120000_residency_continuity_observations.sql
# 2. dans le terminal web Coolify (anti-wrap) :
echo '<BLOB_BASE64>' | tr -d '[:space:]' | base64 -d | docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1
```

Vérifier RLS : `select relrowsecurity from pg_class where relname='residency_continuity_observations';` → `t`.
Redéployer (i18n touché, hors `watch_paths`) : `GET $COOLIFY_PUBLIC_URL/api/v1/deploy?uuid=$MNEMO_APP_UUID` (Bearer `$env:COOLIFY_API_TOKEN`, coffre dot-sourcé). Vérifier `https://infra.ai-mpower.com/health` → 200 + `/resultats` → 200. Tester la route : `POST /api/legal/residency-continuity` avec un `report` minimal → `{ persisted, integrityHash }`.

---

## Self-review (effectué)

- **Couverture spec** : S-094 (kit T2, certificat T1, render T3, bundle T4, panneau T5, i18n T6, montage T7) ✓ · S-095 (continuity T8, evidence T9, migration+types T10, observation+persist T11, route T12, panneau T13, i18n+montage+prod T14) ✓. Hors-périmètre (sandbox côté Strate, signature HMAC, alertes dérive) non implémenté — conforme spec §4.
- **Placeholders** : aucun « TBD/TODO » ; tout le code des modules purs est complet. Les `<BLOB_BASE64>` (Task 14) et la traduction en/ar (Tasks 6/14) sont des actions explicites, pas des trous de plan.
- **Cohérence des types** : `RestoreCertificate`/`RestoreVerdict`/`CHECKLIST_IDS` (T1) réutilisés en T2/T3/T5 ; `ResidencyContinuityReport`/`ContinuityFlag` (T8) réutilisés en T9/T11/T13 ; `buildContinuityObservation` (T11) consomme `ResidencyContinuityObservationInsert` (T10). Cohérent.
- **Points à vérifier à l'exécution** : signature exacte de `msg`/`EngineResolver` (`lib/engine/message`) et le **namespace** que `useEngineText` résout pour les descripteurs moteur (`Engine.*` probable) — confirmer avant d'écrire les clés `residencyContinuity.*` côté moteur (Task 8/14).
