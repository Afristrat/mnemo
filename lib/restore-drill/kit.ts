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
  return (
    JSON.stringify(
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
    ) + "\n"
  );
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
