// Paramètres de dimensionnement « vivants » (S-056, option A — décision Amine 2026-05-28).
//
// CONSTAT : le CALCUL de coût reste déterministe (bon pour la repro Exit Escrow, la charte fiduciaire
// explicable, DÉFCON 1), mais les HEURISTIQUES de dimensionnement (charge GPU par modalité/volet,
// empreinte stockage, seuils de palier) étaient FIGÉES dans `sizing.ts` → dette de supervision si une
// solution plus performante émerge (un modèle 2× plus efficient n'était pas reflété dans le chiffrage).
//
// DOCTRINE « tout vivant + filet » étendue aux PARAMÈTRES : ils deviennent INJECTABLES, avec une
// baseline datée (= repli garde-fou) ; un `ComponentCandidate` sourcé (veille Firecrawl + LLM, S-036)
// peut porter un FACTEUR (gpuLoadFactor sur C6, storageFactor sur C5) qui module la baseline — consommé
// SEULEMENT s'il existe ET passe le garde-fou de bornes (sinon repli baseline). Le LLM ne calcule
// JAMAIS un coût ; le moteur reste pur sur des paramètres révisables. Snapshot reproductible : les
// facteurs retenus voyagent avec le catalogue, déjà figé dans le bundle (S-037).

import type { Catalog } from "@/lib/catalog";
import type { CostSource, Modality, MMTier } from "./types";

export type Volet = "ingest" | "generate";

/** Hypothèses de dimensionnement (modélisation ±30 %, ADR-010) — révisables, jamais des prix. */
export type SizingParams = {
  /** Quantité mensuelle représentative par modalité × palier (audio/vidéo : min/mois ; images : nb/mois). */
  tierQuantity: Record<Modality, Record<MMTier, number>>;
  /** Empreinte de stockage par unité native (Go) — médias bruts + dérivés. */
  storageGbPerUnit: Record<Modality, number>;
  /** Charge GPU relative par unité native et par volet (« créer » > « mémoriser » ; vidéo >> audio/images). */
  gpuLoadPerUnit: Record<Modality, Record<Volet, number>>;
  /** Seuils (charge GPU cumulée) de bascule de palier souverain. */
  gpuTierThresholds: { shared: number; small: number };
};

/**
 * Baseline datée + documentée (= valeurs historiques de `sizing.ts`, ADR-010). Sert de DÉFAUT du
 * moteur ET de repli garde-fou. Audit trail : docs/pricing/compute-cost-sources.md (calibration).
 */
export const BASELINE_SIZING_PARAMS: SizingParams = {
  tierQuantity: {
    audio: { none: 0, light: 600, medium: 3000, intensive: 15000 },
    video: { none: 0, light: 60, medium: 300, intensive: 1500 },
    images: { none: 0, light: 1000, medium: 10000, intensive: 100000 },
  },
  storageGbPerUnit: {
    audio: 0.001, // ~1 Mo/min
    video: 0.05, // ~50 Mo/min
    images: 0.002, // ~2 Mo/image
  },
  gpuLoadPerUnit: {
    audio: { ingest: 0.05, generate: 0.2 },
    video: { ingest: 0.5, generate: 5 },
    images: { ingest: 0.02, generate: 0.1 },
  },
  gpuTierThresholds: { shared: 50, small: 800 },
};

/**
 * Bornes du garde-fou : un facteur sourcé hors [min, max] est ABERRANT → ignoré (repli baseline).
 * `0,25×` à `4×` borne l'effet d'un composant « 4× plus/moins efficient » et bloque les valeurs folles.
 */
export const SIZING_FACTOR_BOUNDS = { min: 0.25, max: 4 } as const;

/** Un facteur est exploitable s'il est fini et dans les bornes (DÉFCON 1 : aberrant → repli). */
export function isValidFactor(factor: number | undefined): factor is number {
  return (
    typeof factor === "number" &&
    Number.isFinite(factor) &&
    factor >= SIZING_FACTOR_BOUNDS.min &&
    factor <= SIZING_FACTOR_BOUNDS.max
  );
}

/** Paramètre effectivement appliqué depuis un candidat sourcé (traçabilité + snapshot). */
export type AppliedSizingParam = {
  kind: "gpuLoad" | "storage";
  factor: number;
  componentName: string;
  source: CostSource;
};

export type DerivedSizingParams = { params: SizingParams; applied: AppliedSizingParam[] };

function scaleGpuLoad(base: SizingParams["gpuLoadPerUnit"], factor: number): SizingParams["gpuLoadPerUnit"] {
  return {
    audio: { ingest: base.audio.ingest * factor, generate: base.audio.generate * factor },
    video: { ingest: base.video.ingest * factor, generate: base.video.generate * factor },
    images: { ingest: base.images.ingest * factor, generate: base.images.generate * factor },
  };
}

function scaleStorage(base: SizingParams["storageGbPerUnit"], factor: number): SizingParams["storageGbPerUnit"] {
  return { audio: base.audio * factor, video: base.video * factor, images: base.images * factor };
}

/**
 * Dérive les paramètres de dimensionnement EFFECTIFS depuis le catalogue : le candidat du slot C6
 * (compute/GPU) peut porter `gpuLoadFactor`, celui du slot C5 (stockage) `storageFactor`. Un facteur
 * est CONSOMMÉ seulement s'il existe, passe le garde-fou de bornes, et diffère de 1 — sinon repli sur
 * la baseline interne. Pas de catalogue → baseline. Pure, déterministe ; le LLM ne calcule rien.
 */
export function deriveSizingParams(
  catalog?: Catalog,
  baseline: SizingParams = BASELINE_SIZING_PARAMS,
): DerivedSizingParams {
  const applied: AppliedSizingParam[] = [];
  let params = baseline;
  if (catalog === undefined) return { params, applied };

  const gpuCandidate = catalog.slots.c6.recommended;
  const gpuFactor = gpuCandidate.sizingParams?.gpuLoadFactor;
  if (isValidFactor(gpuFactor) && gpuFactor !== 1) {
    params = { ...params, gpuLoadPerUnit: scaleGpuLoad(params.gpuLoadPerUnit, gpuFactor) };
    applied.push({ kind: "gpuLoad", factor: gpuFactor, componentName: gpuCandidate.name, source: gpuCandidate.source });
  }

  const storageCandidate = catalog.slots.c5.recommended;
  const storageFactor = storageCandidate.sizingParams?.storageFactor;
  if (isValidFactor(storageFactor) && storageFactor !== 1) {
    params = { ...params, storageGbPerUnit: scaleStorage(params.storageGbPerUnit, storageFactor) };
    applied.push({
      kind: "storage",
      factor: storageFactor,
      componentName: storageCandidate.name,
      source: storageCandidate.source,
    });
  }

  return { params, applied };
}
