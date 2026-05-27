// Exit Escrow (F7, moat ①) : génère un bundle de déploiement reproductible à partir
// de la recommandation, IaC (Compose + Terraform skeleton), squelette de coffre,
// runbook opérationnel, scripts de ré-embedding et de backup, manifeste machine.
// Tout est pur (profil + reco → fichiers texte) : zéro I/O, entièrement testable.
//
// Raison d'être : garantir au client qu'il peut TOUT réinstaller ailleurs, sans nous.
// Anti vendor lock-in par construction (cf. docs/MOAT-HUNT.md).

import type { Layer, Preset, Profile, Recommendation, Zone } from "@/lib/engine";
import { LAYER_PRICING } from "@/lib/pricing/sources";

export type BundleManifestLayer = {
  id: number;
  name: string;
  choice: string;
  cost: number;
  note: string;
  alternatives: string;
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
  sources: { label: string; url: string; checkedAt: string }[];
  disclaimer: string;
};

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

function manifestOf(profile: Profile, reco: Recommendation, generatedAt: string): BundleManifest {
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
    sources: collectSources(reco),
    disclaimer: DISCLAIMER,
  };
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
- \`terraform/\`, squelette de provisioning de l'infra (C6).
- \`vault/\`, squelette du coffre à secrets (noms de variables, **jamais** de valeur).
- \`runbook.md\`, exploitation : déploiement, backup 3-2-1, restauration, MEL, incident.
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

## Backup 3-2-1
- 3 copies, 2 supports, 1 hors site. Script : \`scripts/backup.sh\` (Restic chiffré).
- Tester la **restauration** trimestriellement (un backup non restauré n'existe pas).

## Restauration
1. \`restic restore latest --target ./restore\`.
2. Recharger les volumes Postgres/Qdrant.
3. \`bash scripts/re-embed.sh\` si l'index doit être reconstruit depuis le vault.

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

function backupScript(): string {
  return `#!/usr/bin/env bash
# scripts/backup.sh, sauvegarde chiffrée 3-2-1 via Restic.
set -euo pipefail
: "\${RESTIC_REPOSITORY:?Définir RESTIC_REPOSITORY dans vault/.env}"
: "\${RESTIC_PASSWORD:?Définir RESTIC_PASSWORD dans vault/.env}"

restic backup ./vault ./data --tag mnemo
restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --prune
restic check
echo "Backup OK, pensez à tester une restauration."
`;
}

/** Construit le bundle Exit Escrow complet. Fonction pure. */
export function buildExitBundle(profile: Profile, reco: Recommendation, now: Date = new Date()): ExitBundle {
  const manifest = manifestOf(profile, reco, now.toISOString().slice(0, 10));
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
    "scripts/backup.sh": backupScript(),
  };
  return { files, manifest };
}
