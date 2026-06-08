// Repli daté du statut fournisseur (filet « tout vivant + seed »). DÉFCON : le seed n'INVENTE pas
// d'incident ni de disponibilité — il déclare honnêtement « statut non récupéré » (operational = null,
// aucun incident) et renvoie vers la page de statut publique. Sert uniquement quand le live échoue.

import type { StatusSource } from "./status-source";
import type { ProviderStatus } from "./status-feed";

/** Snapshot de repli neutre pour un fournisseur : aucun fait inventé, renvoie vers la page officielle. */
export function seedStatusFor(source: StatusSource, checkedAt: string): ProviderStatus {
  return {
    providerId: source.id,
    providerName: source.name,
    operational: null,
    recentIncidents: [],
    sourceUrl: source.pageUrl,
    checkedAt,
    provenance: "seed",
  };
}
