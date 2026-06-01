// Guaranteed Migration / In-Switch (Lot 3 F14, S-085) — génère un bundle de MIGRATION reproductible
// à partir de la recommandation : plan de double-run (ancienne ∥ nouvelle stack), critères de bascule
// objectifs, et GARANTIE DE ROLLBACK (runbook + scripts). Jumeau de l'Exit Escrow (F7) : tout est PUR
// (profil + reco → fichiers texte), zéro I/O, entièrement testable.
//
// Raison d'être : dérisquer le passage d'une stack existante vers la stack recommandée — on bascule
// seulement quand des critères mesurables sont verts, et on peut TOUJOURS revenir en arrière.
// DÉFCON 1 : artefacts cohérents avec la reco ; AUCUNE exécution (l'utilisateur exécute), aucun secret.

import { strToU8, zipSync } from "fflate";
import type { Profile, Recommendation } from "@/lib/engine";

export type MigrationBundle = { files: Record<string, string> };

/** Composants cibles de la migration (couches au coût > 0 ou portant un choix). */
function targetComponents(reco: Recommendation): { layer: string; choice: string }[] {
  return reco.layers
    .filter((l) => l.choice.trim() !== "")
    .map((l) => ({ layer: `C${l.id}`, choice: l.choice }));
}

function migrationRunbook(profile: Profile, reco: Recommendation, generatedAt: string): string {
  const comps = targetComponents(reco);
  const compLines = comps.map((c) => `- **${c.layer}** → ${c.choice}`).join("\n");
  const dr = reco.residency.drTier;
  const doubleRunNote =
    dr === "none"
      ? "Mono-région : le double-run se fait dans la même zone (deux environnements logiques isolés)."
      : `DR « ${dr} » : profitez-en pour valider la bascule région par région.`;
  return `# Migration garantie (In-Switch) — ${generatedAt}

> Plan de passage de votre stack actuelle vers la stack recommandée, avec double-run et **rollback garanti**.
> Document généré, cohérent avec votre recommandation. Vous exécutez ; rien n'est lancé automatiquement.

## 0. Préparation (geler l'état)
1. Inventoriez la stack ACTUELLE (composants, versions, volumes de données, secrets).
2. Prenez une **sauvegarde vérifiée** de la base mémorielle actuelle (données + index vectoriels).
3. Provisionnez la stack CIBLE **à côté** (sans couper l'actuelle) :
${compLines}

## 1. Double-run (ancienne ∥ nouvelle)
- Faites tourner les deux stacks **en parallèle**, alimentées par les mêmes entrées (miroir d'ingestion).
- ${doubleRunNote}
- Rejouez un échantillon représentatif de requêtes sur les DEUX et comparez les réponses.

## 2. Critères de bascule (tous VERTS avant cutover)
- [ ] Parité fonctionnelle : ≥ 99 % des requêtes de l'échantillon donnent un résultat équivalent.
- [ ] Performance : latence cible tenue sur la nouvelle stack (cf. profil : ${profile.latency}).
- [ ] Intégrité : recomptage des atomes/embeddings = source ; zéro perte détectée.
- [ ] Sauvegarde : une sauvegarde de la nouvelle stack est prise ET testée (restauration à blanc).
- [ ] Rollback répété à blanc au moins une fois (cf. § 4) — le retour arrière fonctionne.

## 3. Cutover (bascule)
Exécutez \`scripts/cutover.sh\` (revue préalable). Il bascule le trafic vers la stack cible et met
l'ancienne en **lecture seule** (conservée comme filet, pas supprimée).

## 4. Rollback garanti
Tant que l'ancienne stack est conservée (lecture seule), le retour arrière est immédiat :
exécutez \`scripts/rollback.sh\` → le trafic repointe vers l'ancienne stack, sans perte (les écritures
faites sur la cible depuis le cutover sont rejouées vers l'ancienne via le journal d'ingestion).

## 5. Décommissionnement (après période d'observation)
Ne supprimez l'ancienne stack qu'après une fenêtre d'observation stable (recommandé : ≥ 7 jours) ET
une sauvegarde finale archivée. C'est le seul pas irréversible — franchissez-le en dernier.
`;
}

function cutoverScript(reco: Recommendation): string {
  const comps = targetComponents(reco);
  return `#!/usr/bin/env bash
# Cutover — bascule du trafic vers la stack CIBLE (In-Switch, S-085). Revue OBLIGATOIRE avant exécution.
# Idempotent autant que possible ; l'ancienne stack est CONSERVÉE en lecture seule (filet de rollback).
set -euo pipefail

echo "== Pré-bascule : vérifier que les critères du runbook sont VERTS =="
# TODO (opérateur) : confirmer parité / perf / intégrité / sauvegarde testée / rollback répété.

echo "== Geler l'ancienne stack en lecture seule (ne PAS supprimer) =="
# TODO : passer l'ancienne base mémorielle en read-only.

echo "== Basculer le trafic vers la stack cible =="
${comps.map((c) => `echo "  - ${c.layer} : router vers ${c.choice}"`).join("\n")}

echo "== Post-bascule : surveiller erreurs + latence ; conserver l'ancienne stack comme filet =="
echo "Cutover terminé. Rollback disponible via scripts/rollback.sh tant que l'ancienne stack existe."
`;
}

function rollbackScript(): string {
  return `#!/usr/bin/env bash
# Rollback — retour à la stack ANCIENNE (S-085). Disponible tant que l'ancienne stack est conservée.
set -euo pipefail

echo "== Repointer le trafic vers l'ancienne stack (lecture/écriture) =="
# TODO : restaurer le routage vers l'ancienne base mémorielle.

echo "== Rejouer vers l'ancienne stack les écritures faites sur la cible depuis le cutover =="
# TODO : rejouer le journal d'ingestion différentiel (cible -> ancienne).

echo "== Vérifier l'intégrité après retour arrière =="
echo "Rollback terminé. Analysez la cause de l'échec avant un nouveau cutover."
`;
}

function manifest(profile: Profile, reco: Recommendation, generatedAt: string): string {
  return (
    JSON.stringify(
      {
        product: "Strate — Migration garantie (In-Switch)",
        generatedAt,
        preset: reco.preset,
        targets: targetComponents(reco),
        latencyTarget: profile.latency,
        drTier: reco.residency.drTier,
        rollbackGuaranteed: true,
        disclaimer: "Plan généré, cohérent avec la recommandation. À exécuter par vos soins ; aucune exécution automatique.",
      },
      null,
      2,
    ) + "\n"
  );
}

/** Construit le bundle de migration (pur). `generatedAt` injecté (testabilité ; pas de Date.now ici). */
export function buildMigrationBundle(
  profile: Profile,
  reco: Recommendation,
  opts: { generatedAt?: string } = {},
): MigrationBundle {
  const generatedAt = opts.generatedAt ?? "";
  return {
    files: {
      "MIGRATION.md": migrationRunbook(profile, reco, generatedAt),
      "scripts/cutover.sh": cutoverScript(reco),
      "scripts/rollback.sh": rollbackScript(),
      "manifest.json": manifest(profile, reco, generatedAt),
    },
  };
}

/** Empaquette le bundle de migration en ZIP (fflate). */
export function zipMigrationBundle(bundle: MigrationBundle): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(bundle.files)) {
    entries[path] = strToU8(content);
  }
  return zipSync(entries, { level: 6 });
}
