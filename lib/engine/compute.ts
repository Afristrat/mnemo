// Compute souverain — dimensionnement des serveurs self-hosted (S-033, pur).
//
// Comble le trou : les VM CPU/RAM qui font tourner Postgres, Qdrant, l'orchestrateur (LiteLLM/vLLM),
// l'app et le vault en self-hosted étaient invisibles (forfait C6 codé en dur). Ici elles sont
// DIMENSIONNÉES (preset + volume + users + débit) et chiffrées avec des **prix injectés** (DÉFCON 1) —
// au même titre que le pool GPU (S-016). Hypothèses ±30 %, documentées dans
// docs/pricing/compute-cost-sources.md.

import type { CostSource, Preset, Profile } from "./types";

/** Spécification d'une instance (catalogue vendor, sourcée). */
export type ComputeInstanceSpec = {
  name: string;
  vcpu: number;
  ramGb: number;
  pricePerHourEur: number;
  source: CostSource | null;
};

/** Contrat de prix compute (implémenté/sourcé par `lib/pricing/compute-seed`, injecté ici). */
export type ComputePriceTable = {
  /** Petite instance pour le profil managé (LIGHT) : vault + glue. */
  glue: ComputeInstanceSpec;
  /** Nœud self-host (MEDIUM/HARD) : orchestrateur, Postgres, Qdrant, app. */
  node: ComputeInstanceSpec;
};

export type ComputeInstanceLine = {
  role: string;
  spec: ComputeInstanceSpec;
  count: number;
  monthlyCost: number;
};

export type ComputeSizing = {
  instances: ComputeInstanceLine[];
  monthlyCost: number;
  sources: CostSource[];
};

const HOURS_PER_MONTH = 730;

function monthly(spec: ComputeInstanceSpec, count: number): number {
  return Math.round(spec.pricePerHourEur * HOURS_PER_MONTH * count);
}

function dedupeSources(sources: (CostSource | null)[]): CostSource[] {
  const seen = new Set<string>();
  const out: CostSource[] = [];
  for (const s of sources) {
    if (s !== null && !seen.has(s.url)) {
      seen.add(s.url);
      out.push(s);
    }
  }
  return out;
}

/**
 * Dimensionne le compute souverain (serveurs self-hosted) selon le preset et la charge. Pur.
 * - LIGHT : services managés → 1 petite instance (glue/vault).
 * - MEDIUM : nœud self-host mutualisé, + 1 si gros volume / beaucoup d'users / fort débit.
 * - HARD : 2 nœuds (séparation + redondance), + 1 si gros volume.
 */
export function computeSovereignCompute(
  profile: Profile,
  preset: Preset,
  prices: ComputePriceTable,
): ComputeSizing {
  const bigVolume = profile.volume === "100to1000" || profile.volume === "gt1000";
  const manyUsers = profile.users > 50;
  const highReq = profile.reqPerDay === "gt10k";
  const lines: ComputeInstanceLine[] = [];

  if (preset === "LIGHT") {
    const count = 1;
    lines.push({
      role: "Glue souveraine (vault, scripts) — services principaux managés",
      spec: prices.glue,
      count,
      monthlyCost: monthly(prices.glue, count),
    });
  } else {
    const base = preset === "HARD" ? 2 : 1;
    const count = base + (bigVolume ? 1 : 0) + (manyUsers ? 1 : 0) + (highReq ? 1 : 0);
    lines.push({
      role:
        preset === "HARD"
          ? "Nœuds on-prem séparés + redondance (Postgres, Qdrant, orchestrateur, app)"
          : "Nœud self-host mutualisé (LiteLLM, Postgres, Qdrant, app, vault)",
      spec: prices.node,
      count,
      monthlyCost: monthly(prices.node, count),
    });
  }

  const monthlyCost = lines.reduce((sum, l) => sum + l.monthlyCost, 0);
  return { instances: lines, monthlyCost, sources: dedupeSources(lines.map((l) => l.spec.source)) };
}

/** Table neutre (coûts 0) — défaut d'injection pour préserver la pureté/les invariants. */
export const NEUTRAL_COMPUTE_PRICES: ComputePriceTable = {
  glue: { name: "—", vcpu: 0, ramGb: 0, pricePerHourEur: 0, source: null },
  node: { name: "—", vcpu: 0, ramGb: 0, pricePerHourEur: 0, source: null },
};
