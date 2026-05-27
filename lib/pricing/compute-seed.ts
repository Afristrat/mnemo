// Seed des prix de compute souverain (S-033) — DÉFCON 1.
//
// Instances Scaleway (France/UE, EUR) réellement publiées (relevé 2026-05-27, extraction structurée
// Firecrawl). Sources : docs/pricing/compute-cost-sources.md. Le feed live (`live-feed.ts`)
// ré-extrait et réconcilie ; ce seed est le repli daté + la baseline de validation (garde-fou S-025).
//
// ⚠ Ne JAMAIS éditer un prix ici sans mettre à jour docs/pricing/compute-cost-sources.md.

import type { ComputePriceTable } from "@/lib/engine";

export type { ComputePriceTable } from "@/lib/engine";

const CHECKED_AT = "2026-05-27";
const SCALEWAY_INSTANCES = "https://www.scaleway.com/en/pricing/virtual-instances-pricing/";

export const COMPUTE_PRICE_SEED: ComputePriceTable = {
  // Petite instance (profil managé) : vault markdown + glue/scripts.
  glue: {
    name: "DEV1-M",
    vcpu: 3,
    ramGb: 4,
    pricePerHourEur: 0.0198,
    source: { label: "Scaleway — Virtual Instances (DEV1-M)", url: SCALEWAY_INSTANCES, checkedAt: CHECKED_AT },
  },
  // Nœud self-host mutualisé (orchestrateur, Postgres, Qdrant, app).
  node: {
    name: "PRO2-S",
    vcpu: 8,
    ramGb: 32,
    pricePerHourEur: 0.219,
    source: { label: "Scaleway — Virtual Instances (PRO2-S)", url: SCALEWAY_INSTANCES, checkedAt: CHECKED_AT },
  },
};

/** Prix compute en € — table seed (repli/baseline). Le live arrive via `getLivePrices().compute`. */
export function getComputePrices(): ComputePriceTable {
  return COMPUTE_PRICE_SEED;
}
