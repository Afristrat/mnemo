// Exit Escrow (F7, moat ①) : génère un bundle de déploiement reproductible à partir
// de la recommandation, IaC (Compose + Terraform skeleton), squelette de coffre,
// runbook opérationnel, scripts de ré-embedding et de backup, manifeste machine.
// Tout est pur (profil + reco → fichiers texte) : zéro I/O, entièrement testable.
//
// Raison d'être : garantir au client qu'il peut TOUT réinstaller ailleurs, sans nous.
// Anti vendor lock-in par construction (cf. docs/MOAT-HUNT.md).

import type { BackupPlan, Layer, Preset, Profile, Recommendation, ResidencyPlan, Zone } from "@/lib/engine";
import type { Catalog, Provenance, SlotId } from "@/lib/catalog";
import { LAYER_PRICING } from "@/lib/pricing/sources";

export type BundleManifestLayer = {
  id: number;
  name: string;
  choice: string;
  cost: number;
  note: string;
  alternatives: string;
};

/** Catalogue retenu, figé pour la reproductibilité (S-037) : un candidat sourcé par couche. */
export type BundleManifestCatalog = {
  assembledAt: string;
  source: "live" | "seed" | "mixed";
  slots: { slot: SlotId; component: string; provenance: Provenance; confidence: string; sourceUrl: string }[];
};

export type BundleManifest = {
  product: string;
  generatedAt: string;
  preset: Preset;
  zone: Zone;
  totalCost: number;
  scoreAvg: number;
  layers: BundleManifestLayer[];
  modules: { id: string; name: string; level: number; maxLevel: number }[];
  /** Plan de sauvegarde réel (source de vérité du runbook + backup.sh ; cohérence manifest↔plan). */
  backup: BackupPlan;
  /** Plan résidence/DR réel (source de vérité du runbook DR + terraform multi-région). Spec n°2 §8. */
  residency: ResidencyPlan;
  /** Catalogue retenu (provenance + sources + assembledAt) — présent si la veille a été branchée. */
  catalog?: BundleManifestCatalog;
  sources: { label: string; url: string; checkedAt: string }[];
  disclaimer: string;
};

const CATALOG_SLOT_ORDER: SlotId[] = ["c0", "c1", "c2", "c3", "c4", "c5", "c6"];

/** Transpose le catalogue retenu en empreinte machine figée (rejouable). */
function catalogManifest(catalog: Catalog): BundleManifestCatalog {
  return {
    assembledAt: catalog.assembledAt,
    source: catalog.source,
    slots: CATALOG_SLOT_ORDER.map((slot) => {
      const rec = catalog.slots[slot].recommended;
      return {
        slot,
        component: rec.name,
        provenance: rec.provenance,
        confidence: rec.confidence,
        sourceUrl: rec.source.url,
      };
    }),
  };
}

export type ExitBundle = {
  /** Chemin relatif → contenu texte. */
  files: Record<string, string>;
  manifest: BundleManifest;
};

const DISCLAIMER =
  "Bundle généré par Strate, recette ouverte, reproductible, sans dépendance à Strate. Une IA peut se tromper : revérifiez chaque valeur et chaque source avant production.";

function layerById(reco: Recommendation, id: number): Layer {
  const found = reco.layers.find((l) => l.id === id);
  if (found === undefined) throw new Error(`couche ${id} absente de la recommandation`);
  return found;
}

function collectSources(reco: Recommendation): BundleManifest["sources"] {
  const out: BundleManifest["sources"] = [];
  const seen = new Set<string>();
  for (const layer of reco.layers) {
    const pricing = LAYER_PRICING[layer.id];
    if (pricing?.source == null || seen.has(pricing.source.url)) continue;
    seen.add(pricing.source.url);
    out.push({ ...pricing.source });
  }
  return out;
}

function manifestOf(
  profile: Profile,
  reco: Recommendation,
  generatedAt: string,
  catalog?: Catalog,
): BundleManifest {
  return {
    product: "Strate, base mémorielle IA souveraine",
    generatedAt,
    preset: reco.preset,
    zone: profile.zone,
    totalCost: reco.totalCost,
    scoreAvg: reco.scoreAvg,
    layers: reco.layers.map((l) => ({
      id: l.id,
      name: l.name,
      choice: l.choice,
      cost: l.cost,
      note: l.note,
      alternatives: l.alternatives,
    })),
    modules: reco.activeModules.map((m) => ({
      id: m.id,
      name: m.name,
      level: m.level,
      maxLevel: m.maxLevel,
    })),
    backup: reco.backup,
    residency: reco.residency,
    ...(catalog !== undefined ? { catalog: catalogManifest(catalog) } : {}),
    sources: collectSources(reco),
    disclaimer: DISCLAIMER,
  };
}

/** Formate une durée en minutes de façon lisible (RPO/RTO). */
function fmtMinutes(min: number): string {
  if (min <= 0) return "—";
  if (min < 60) return `${min} min`;
  if (min % 1440 === 0) return `${min / 1440} j`;
  if (min % 60 === 0) return `${min / 60} h`;
  return `${Math.round(min / 60)} h`;
}

/** Libellé de la politique d'érasure (droit à l'oubli). */
function erasureLabel(policy: BackupPlan["erasurePolicy"]): string {
  return policy === "crypto-shred"
    ? "crypto-shredding (chiffrement par enregistrement ; « suppression » = destruction de la clé → donnée illisible y compris en sauvegarde)"
    : "suppression logique + purge à l'expiration de la rétention";
}

/** Section « Sauvegarde & résilience » du runbook, DÉRIVÉE du plan réel (spec n°1 §9). */
function backupSection(b: BackupPlan): string {
  if (b.criticality === "none") {
    return `## Sauvegarde & résilience
- Criticité « aucune » : **aucune politique de sauvegarde dimensionnée**. Une base mémorielle sans
  sauvegarde est exposée à la perte de données — définissez une criticité dans le configurateur (Bloc ② Infra).

## Restauration
1. \`restic restore latest --target ./restore\` (si un dépôt Restic a été configuré manuellement).
2. Recharger les volumes Postgres/Qdrant, puis \`bash scripts/re-embed.sh\`.`;
  }
  const threeTwoOne =
    `${b.copies} copies` +
    (b.offsite ? ", 1 hors-site" : "") +
    (b.airgap ? ", 1 air-gap (hors-ligne, anti-ransomware)" : "") +
    (b.immutable ? ", WORM/object-lock (immuable)" : "");
  return `## Sauvegarde & résilience (plan « ${b.criticality} »)
- **RPO** (perte de données max) : ${fmtMinutes(b.rpoMinutes)} · **RTO** (reprise max) : ${fmtMinutes(b.rtoMinutes)}.
- **Rétention** : ${b.retentionDays} jours${b.legalRetentionYears > 0 ? ` (plancher légal : ${b.legalRetentionYears} an(s))` : ""}.
- **3-2-1-1-0** : ${threeTwoOne} ; ${b.restoreTestsPerYear} restauration(s) testée(s)/an.
- **Stockage** : tier ${b.tier}${b.pitr ? " + WAL/PITR Postgres (RPO quasi-continu)" : ""}.
- **Vecteurs** : stratégie ${b.vector.strategy} — ${b.vector.reason}
- **Érasure (droit à l'oubli)** : ${erasureLabel(b.erasurePolicy)}.${b.byok ? " Clés gérées par le client (BYOK)." : ""}
- Script : \`scripts/backup.sh\` (Restic chiffré, rétention dérivée du plan).
> Orientation d'ingénierie, pas un avis juridique : faites valider la rétention légale par votre conseil.

## Restauration (RTO cible ${fmtMinutes(b.rtoMinutes)})
1. \`restic restore latest --target ./restore\`.
2. Recharger les volumes Postgres/Qdrant.
3. \`bash scripts/re-embed.sh\` ${b.vector.strategy === "reembed" ? "(stratégie vecteurs = ré-embed : index reconstruit depuis le vault, RTO plus long)" : "si l'index doit être reconstruit depuis le vault"}.`;
}

const TRANSFER_STATUS_LABEL: Record<ResidencyPlan["transfers"][number]["status"], string> = {
  ok: "✅ ok",
  restricted: "⚠️ restreint",
  forbidden: "⛔ interdit",
};

/** Section « Résidence & continuité régionale (DR) » du runbook, DÉRIVÉE du plan réel (spec n°2 §8). */
function residencySection(r: ResidencyPlan): string {
  const replicas = r.regions.filter((reg) => reg.role !== "primary");
  if (r.drTier === "none" && !r.activeActive && replicas.length === 0) {
    return `## Résidence & continuité régionale (DR)
- **Résidence** : données en région « ${r.primaryRegion} », mono-région.
- **DR régional** : aucun (RTO régional = restauration de sauvegarde, voir ci-dessus). Pas de réplica inter-région dimensionné.`;
  }

  const drLabel = r.activeActive ? "actif-actif" : r.drTier;
  const regionOrder = r.regions
    .map((reg, i) => `${i + 1}. **${reg.region}** (${reg.role})${reg.monthlyCost > 0 ? ` — ≈ ${reg.monthlyCost} €/mois` : ""}`)
    .join("\n");
  const transferLines =
    r.transfers.length === 0
      ? "- Aucun flux inter-juridiction (réplication intra-juridiction)."
      : r.transfers
          .map((t) => `- ${t.from} → ${t.to} : ${TRANSFER_STATUS_LABEL[t.status]} — ${t.legalBasis}`)
          .join("\n");
  const conflictBlock = r.conflict.hasConflict
    ? `\n\n> ⚠️ **Conflit résidence × DR à arbitrer** : ${r.conflict.reason}\n${r.conflict.levers.map((l) => `> - ${l}`).join("\n")}`
    : "";

  return `## Résidence & continuité régionale (DR « ${drLabel} »)
- **Région primaire** : ${r.primaryRegion}.
- **RPO régional** : ${fmtMinutes(r.rpoMinutes)} · **RTO régional (bascule)** : ${fmtMinutes(r.rtoMinutes)}.
- **Topologie / ordre de priorité des régions** :
${regionOrder}
- **Coût résidence/DR** : ≈ ${Math.round(r.monthlyCost)} €/mois récurrent + ${Math.round(r.setupCost)} € de mise en route (amorçage des réplicas).

### Conformité des transferts inter-région
${transferLines}
> Orientation d'ingénierie, PAS un avis juridique : faites valider chaque base légale par votre conseil.${conflictBlock}

### Procédure de bascule régionale (failover, RTO cible ${fmtMinutes(r.rtoMinutes)})
1. Constater l'indisponibilité de la région primaire « ${r.primaryRegion} » (sonde santé + alerte).
2. ${r.activeActive ? "Retirer la région en défaut du pool actif-actif (le trafic continue sur les régions saines)." : "Promouvoir la région en attente la plus prioritaire (voir topologie) en primaire."}
3. Repointer le DNS / l'entrée d'ingress vers la nouvelle région primaire.
4. Vérifier la réplication (RPO ${fmtMinutes(r.rpoMinutes)}) puis rouvrir les écritures.
5. Reconstruire/rétablir la région en défaut, puis la réintégrer comme réplica (voir \`terraform/dr.tf\`).`;
}

/** IaC multi-région (réplication inter-région) — généré quand le plan DR dimensionne des réplicas. */
function drTerraform(r: ResidencyPlan): string {
  const replicas = r.regions.filter((reg) => reg.role !== "primary");
  const regionsList = r.regions.map((reg) => `"${reg.region}/${reg.role}"`).join(", ");
  return `# terraform/dr.tf, squelette multi-région (résidence/DR « ${r.activeActive ? "actif-actif" : r.drTier} »)
# Topologie : ${regionsList}
# Région primaire : ${r.primaryRegion} · RPO régional ${fmtMinutes(r.rpoMinutes)} · RTO ${fmtMinutes(r.rtoMinutes)}.
# Adaptez le provider à votre hébergeur souverain ; respectez les bases légales de transfert (voir runbook.md).

variable "primary_region"  { type = string, default = "${r.primaryRegion}" }
variable "replica_regions" {
  type    = list(string)
  default = [${replicas.map((reg) => `"${reg.region}"`).join(", ")}]
}

# Pour chaque région en attente : déployer un nœud (Postgres réplica + objet) et configurer la
# réplication depuis la primaire. ${r.activeActive ? "Actif-actif : synchronisation bidirectionnelle." : "Actif-passif : la réplique est promue à la bascule."}
# resource "..._instance" "replica" {
#   for_each = toset(var.replica_regions)
#   region   = each.value
#   tags     = ["mnemo", "dr", "${r.activeActive ? "active" : "standby"}"]
# }

output "dr_topology" {
  value = "primaire ${r.primaryRegion} + ${replicas.length} région(s) en attente (${r.activeActive ? "actif-actif" : r.drTier})"
}
`;
}

function readme(m: BundleManifest, reco: Recommendation): string {
  const layerLines = reco.layers
    .map((l) => `| C${l.id} | ${l.name} | ${l.choice} | ${l.cost > 0 ? `${l.cost} €/mois` : "inclus"} |`)
    .join("\n");
  return `# Bundle de déploiement Strate, Exit Escrow

> Preset **${m.preset}** · zone **${m.zone}** · coût estimé **${m.totalCost} €/mois** · score **${m.scoreAvg}/10**
> Généré le ${m.generatedAt}.

Ce bundle contient tout le nécessaire pour **redéployer votre base mémorielle ailleurs, sans Strate**.
C'est la matérialisation de la promesse « zéro vendor lock-in » : la recette est ouverte.

## Contenu

- \`manifest.json\`, description machine de la stack (source de vérité).
- \`docker-compose.yml\`, services auto-hébergeables (vector DB, Postgres, orchestrateur).
- \`terraform/\`, squelette de provisioning de l'infra (C6)${reco.residency.regions.some((r) => r.role !== "primary") ? " + `dr.tf` (multi-région : réplication inter-région)" : ""}.
- \`vault/\`, squelette du coffre à secrets (noms de variables, **jamais** de valeur).
- \`runbook.md\`, exploitation : déploiement, backup 3-2-1, restauration, **résidence & bascule régionale (DR)**, MEL, incident.
- \`scripts/re-embed.sh\`, ré-embedding du vault vers la base vectorielle.
- \`scripts/backup.sh\`, sauvegarde chiffrée (Restic).

## Stack recommandée

| Couche | Nom | Choix | Coût |
|---|---|---|---|
${layerLines}

## Redéployer en 4 étapes

1. \`cp vault/.env.example vault/.env\` puis renseignez vos clés (voir \`vault/README.md\`).
2. \`docker compose up -d\` (services auto-hébergeables).
3. \`bash scripts/re-embed.sh\` pour (re)constituer l'index vectoriel depuis le vault markdown.
4. Suivez \`runbook.md\` pour le backup et la supervision.

---

> ${m.disclaimer}
`;
}

function dockerCompose(reco: Recommendation): string {
  const c3 = layerById(reco, 3);
  const c5 = layerById(reco, 5);
  const c2 = layerById(reco, 2);
  const needsLiteLLM = reco.preset !== "LIGHT";
  const litellm = needsLiteLLM
    ? `
  orchestrator:
    # C2, ${c2.choice}
    image: ghcr.io/berriai/litellm:main-stable
    restart: unless-stopped
    env_file: [vault/.env]
    ports: ["4000:4000"]
    depends_on: [qdrant, postgres]
`
    : `
  # C2, ${c2.choice}
  # Preset LIGHT : orchestrateur lancé hors conteneur (script Python), API LLM directe.
`;
  return `# docker-compose.yml, généré par Strate (preset ${reco.preset})
# Services auto-hébergeables de la stack. Les couches « API » (LLM, embeddings SaaS)
# sont configurées via vault/.env, pas conteneurisées.
services:
  qdrant:
    # C3, ${c3.choice}
    image: qdrant/qdrant:latest
    restart: unless-stopped
    ports: ["6333:6333"]
    volumes: ["qdrant_data:/qdrant/storage"]

  postgres:
    # C5, ${c5.choice}
    image: pgvector/pgvector:pg16
    restart: unless-stopped
    env_file: [vault/.env]
    environment:
      POSTGRES_DB: \${POSTGRES_DB:-mnemo}
    volumes: ["pg_data:/var/lib/postgresql/data"]
${litellm}
volumes:
  qdrant_data:
  pg_data:
`;
}

function terraformMain(reco: Recommendation): string {
  const c6 = layerById(reco, 6);
  return `# terraform/main.tf, squelette de provisioning (C6)
# Cible : ${c6.choice}
# Adaptez le provider à votre hébergeur souverain (Scaleway / Hetzner / OVH / on-prem).

terraform {
  required_version = ">= 1.6"
}

variable "region"        { type = string }
variable "instance_type" { type = string }
variable "ssh_public_key"{ type = string }

# Exemple Scaleway (à remplacer selon l'hébergeur retenu) :
# provider "scaleway" { region = var.region }
# resource "scaleway_instance_server" "mnemo" {
#   type  = var.instance_type
#   image = "ubuntu_jammy"
#   tags  = ["mnemo", "${reco.preset}"]
# }

output "next_steps" {
  value = "Provisionnez l'instance, installez Docker, puis 'docker compose up -d'."
}
`;
}

function terraformVars(profile: Profile, reco: Recommendation): string {
  const region = profile.zone === "maroc" ? "fr-par" : profile.zone === "us" ? "us-east" : "fr-par";
  const instance = reco.preset === "HARD" ? "GPU-3070-S" : reco.preset === "MEDIUM" ? "DEV1-L" : "DEV1-S";
  return `# terraform/terraform.tfvars, valeurs par défaut (preset ${reco.preset})
region        = "${region}"
instance_type = "${instance}"
ssh_public_key = "CHANGEZ-MOI"
`;
}

function vaultEnv(reco: Recommendation): string {
  const lines = [
    "# vault/.env.example, squelette de secrets. NE JAMAIS COMMITTER vault/.env.",
    "# Renseignez les valeurs côté client ; Strate ne les voit jamais.",
    "",
    "POSTGRES_DB=mnemo",
    "POSTGRES_USER=mnemo",
    "POSTGRES_PASSWORD=CHANGEZ-MOI",
    "",
    "# Couche LLM / embeddings (selon la reco)",
    "ANTHROPIC_API_KEY=",
    "MISTRAL_API_KEY=",
  ];
  if (reco.preset !== "LIGHT") {
    lines.push("LITELLM_MASTER_KEY=CHANGEZ-MOI", "QDRANT_API_KEY=");
  }
  lines.push("", "# Backup (Restic)", "RESTIC_REPOSITORY=", "RESTIC_PASSWORD=CHANGEZ-MOI", "B2_ACCOUNT_ID=", "B2_ACCOUNT_KEY=");
  return lines.join("\n") + "\n";
}

function vaultReadme(): string {
  return `# Coffre à secrets (vault)

- Copiez \`.env.example\` en \`.env\` et renseignez vos valeurs.
- \`.env\` ne doit **jamais** être committé ni quitter votre périmètre.
- Le vault markdown (vos atomes de connaissance) est la **source de vérité** : la base
  vectorielle n'en est qu'une projection rejouable via \`scripts/re-embed.sh\`.
- Rotation des clés : documentez-la dans \`runbook.md\`.
`;
}

function runbook(reco: Recommendation): string {
  const c6 = layerById(reco, 6);
  return `# Runbook opérationnel, Strate (preset ${reco.preset})

## Déploiement
1. Provisionner l'infra (\`terraform/\`), cible : ${c6.choice}.
2. Installer Docker + Docker Compose sur l'hôte.
3. \`cp vault/.env.example vault/.env\` et renseigner les secrets.
4. \`docker compose up -d\` puis vérifier \`docker compose ps\`.
5. \`bash scripts/re-embed.sh\` pour constituer l'index.

${backupSection(reco.backup)}

${residencySection(reco.residency)}

## MEL, Minimum Equipment List (dégradation)
| Composant | En panne → | Mode dégradé | Délai max réparation |
|---|---|---|---|
| Base vectorielle (Qdrant) | Recherche sémantique KO | Repli recherche plein-texte Postgres | 4 h |
| Orchestrateur / cascade | Pas d'escalade T1→T2 | Appel LLM direct (T2) | 2 h |
| LLM principal | Génération KO | Bascule fournisseur secondaire (vault) | 1 h |

## Incident
- Geler les écritures, snapshot, diagnostiquer, documenter un postmortem référençant le pre-reg.

---
Une IA peut se tromper : ce runbook est un point de départ à adapter à votre contexte.
`;
}

function reEmbedScript(reco: Recommendation): string {
  return `#!/usr/bin/env bash
# scripts/re-embed.sh, reconstruit l'index vectoriel depuis le vault markdown.
# Le vault markdown est la source de vérité ; l'index est une projection rejouable.
set -euo pipefail

VAULT_DIR="\${VAULT_DIR:-./vault/atoms}"
QDRANT_URL="\${QDRANT_URL:-http://localhost:6333}"
COLLECTION="\${COLLECTION:-mnemo}"

echo "Preset : ${reco.preset}, ré-embedding depuis \$VAULT_DIR vers \$QDRANT_URL/\$COLLECTION"

# 1. Créer la collection si absente (dimension selon le modèle d'embeddings retenu).
# 2. Pour chaque atome markdown : parser le frontmatter (champ 'circle' = pivot RLS),
#    générer l'embedding (API ou modèle local selon C4), upsert dans Qdrant.
find "\$VAULT_DIR" -name '*.md' -print0 | while IFS= read -r -d '' atom; do
  echo "TODO embed: \$atom"
  # embedding=\$(curl ... )  # brancher la couche C4 de la reco
  # curl -X PUT "\$QDRANT_URL/collections/\$COLLECTION/points" ...
done

echo "Ré-embedding terminé."
`;
}

function backupScript(reco: Recommendation): string {
  const b = reco.backup;
  if (b.criticality === "none") {
    return `#!/usr/bin/env bash
# scripts/backup.sh — AUCUNE politique de sauvegarde dimensionnée (criticité « aucune »).
# Définissez une criticité dans le configurateur (Bloc ② Infra) pour générer une vraie politique.
set -euo pipefail
echo "Criticité « aucune » : aucune sauvegarde planifiée. Risque de perte de données."
`;
  }
  const notes: string[] = [];
  if (b.pitr) notes.push("# PITR : configurez l'archivage WAL Postgres (archive_command) en complément de ce snapshot.");
  if (b.immutable) notes.push("# Immutabilité : activez l'object-lock / WORM sur le bucket de destination (anti-altération).");
  if (b.airgap) notes.push("# Air-gap : répliquez une copie sur un support hors-ligne (anti-ransomware).");
  if (b.erasurePolicy === "crypto-shred") {
    notes.push("# Érasure : chiffrement par enregistrement ; « suppression » RGPD = destruction de la clé.");
  }
  return `#!/usr/bin/env bash
# scripts/backup.sh — sauvegarde chiffrée via Restic, politique DÉRIVÉE du plan « ${b.criticality} ».
# RPO ${fmtMinutes(b.rpoMinutes)} · RTO ${fmtMinutes(b.rtoMinutes)} · rétention ${b.retentionDays} j · ${b.copies} copies.
set -euo pipefail
: "\${RESTIC_REPOSITORY:?Définir RESTIC_REPOSITORY dans vault/.env}"
: "\${RESTIC_PASSWORD:?Définir RESTIC_PASSWORD dans vault/.env}"

restic backup ./vault ./data --tag strate --tag ${b.criticality}
# Rétention dérivée du plan (conserver les snapshots des ${b.retentionDays} derniers jours).
restic forget --keep-within ${b.retentionDays}d --prune
restic check --read-data-subset=5%
${notes.join("\n")}
echo "Backup OK (plan ${b.criticality}). Testez une restauration ${b.restoreTestsPerYear}x/an."
`;
}

/**
 * Construit le bundle Exit Escrow complet. Fonction pure.
 * `catalog` (optionnel) fige le catalogue retenu dans `manifest.catalog` + `catalog.json` (S-037).
 */
export function buildExitBundle(
  profile: Profile,
  reco: Recommendation,
  now: Date = new Date(),
  catalog?: Catalog,
): ExitBundle {
  const manifest = manifestOf(profile, reco, now.toISOString().slice(0, 10), catalog);
  const files: Record<string, string> = {
    "manifest.json": JSON.stringify(manifest, null, 2) + "\n",
    "README.md": readme(manifest, reco),
    "docker-compose.yml": dockerCompose(reco),
    "terraform/main.tf": terraformMain(reco),
    "terraform/terraform.tfvars": terraformVars(profile, reco),
    "vault/.env.example": vaultEnv(reco),
    "vault/README.md": vaultReadme(),
    "runbook.md": runbook(reco),
    "scripts/re-embed.sh": reEmbedScript(reco),
    "scripts/backup.sh": backupScript(reco),
  };
  // IaC multi-région générée seulement si le plan DR dimensionne des réplicas (cohérence manifest↔plan).
  if (reco.residency.regions.some((r) => r.role !== "primary")) {
    files["terraform/dr.tf"] = drTerraform(reco.residency);
  }
  // Catalogue retenu figé à part (rejouable) : composants + provenance + sources + date d'assemblage.
  if (manifest.catalog !== undefined) {
    files["catalog.json"] = JSON.stringify(manifest.catalog, null, 2) + "\n";
  }
  return { files, manifest };
}
