// Seed des prix spécifiques à la sauvegarde (S-025) — DÉFCON 1.
//
// Postes propres au backup : sortie/restauration (egress), stockage froid (archive), retrait
// d'archive, transfert hors-site. Référent souverain = Scaleway (France/UE, EUR) → aucune
// conversion. Le stockage CHAUD est réutilisé du seed médias (Scaleway Standard Multi-AZ).
//
// Chaque valeur est RÉELLEMENT publiée (URL + date + confiance). Sourcing : recherche web réelle
// consignée dans `docs/pricing/backup-cost-sources.md` (relevé 2026-05-27).
//
// ⚠ Ne JAMAIS éditer un montant ici sans mettre à jour `docs/pricing/backup-cost-sources.md`.
// Le feed live (`backup-feed.ts`) ré-extrait et réconcilie ces valeurs ; ce seed est le repli daté
// ET la baseline de validation (garde-fou).

import type { BackupPriceTable } from "@/lib/engine";

// Le contrat `BackupPriceTable` est défini côté moteur (lib/engine/backup) — prix injectés (DÉFCON 1).
export type { BackupPriceTable } from "@/lib/engine";

const CHECKED_AT = "2026-05-27";
const SCALEWAY_STORAGE = "https://www.scaleway.com/en/pricing/storage/";

export const BACKUP_PRICE_SEED: BackupPriceTable = {
  egressPerGb: {
    amount: 0.01,
    currency: "EUR",
    unit: "Go",
    confidence: "high",
    source: {
      label: "Scaleway — Object Storage egress (au-delà de 75 Go/mois gratuits)",
      url: SCALEWAY_STORAGE,
      checkedAt: CHECKED_AT,
    },
  },
  archiveStoragePerGbMonth: {
    amount: 0.00254,
    currency: "EUR",
    unit: "Go·mois",
    confidence: "high",
    source: { label: "Scaleway — Glacier / Cold storage", url: SCALEWAY_STORAGE, checkedAt: CHECKED_AT },
  },
  archiveRetrievalPerGb: {
    amount: 0.009,
    currency: "EUR",
    unit: "Go",
    confidence: "high",
    source: { label: "Scaleway — Cold storage restore", url: SCALEWAY_STORAGE, checkedAt: CHECKED_AT },
  },
  offsiteBandwidthPerGb: {
    amount: 0.01,
    currency: "EUR",
    unit: "Go",
    confidence: "medium",
    source: {
      label: "Scaleway — egress (proxy d'une copie hors-site)",
      url: SCALEWAY_STORAGE,
      checkedAt: CHECKED_AT,
    },
    note: "estimation, à confirmer par devis (varie selon destination/fournisseur)",
  },
};

/** Prix backup en € — table seed (repli/baseline). Le live arrive via `getBackupPricesLive`. */
export function getBackupPrices(): BackupPriceTable {
  return BACKUP_PRICE_SEED;
}
