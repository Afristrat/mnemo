// Dimensionnement multimédia (S-016, refonte Strate).
//
// Traduit les besoins multimédias (`Profile.mediaNeeds`, 2 volets : mémoriser + créer) en
// RESSOURCES (`Sizing`) : un pool GPU souverain mutualisé compté UNE SEULE FOIS, du stockage
// indexé sur le volume, le drapeau embeddings multimodaux, et des lignes de charge traçables.
//
// Fonction PURE, déterministe, sans dépendance UI (cf. spec §5). Tous les prix sont INJECTÉS
// (`MultimodalPriceTable`) : aucune valeur monétaire codée en dur ici — DÉFCON 1, les tarifs
// sourcés arrivent en S-017 (`getMediaPrices()`). Les facteurs de dimensionnement ci-dessous
// (quantités par palier, empreinte stockage, charge GPU, seuils) sont des HYPOTHÈSES de
// modélisation (±30 %, à raffiner), au même titre que `VOLUME_FACTOR`/`REQ_FACTOR` de `cost.ts`
// — ce ne sont PAS des prix (cf. ADR-010).

import type { Confidence } from "@/components/ui/StatusDot";
import type { GpuTier, MediaNeed, MMTier, Modality, Profile, Sizing, WorkloadLine } from "./types";

// --- Contrat de prix médias (implémenté, sourcé, en S-017 : `getMediaPrices`) ----------------

/**
 * Entrée de prix médias sourcée. `source` est structurellement compatible avec `PriceSource`
 * (`lib/pricing/sources`) : S-017 y injecte des sources réelles (URL + date + confiance, DÉFCON 1).
 */
export type MultimodalPriceEntry = {
  amount: number; // montant en € (par unité native, cf. `unit`)
  unit: string; // ex. « €/min », « €/image », « €/mois », « €/Go/mois »
  confidence: Confidence;
  source: { label: string; url: string; checkedAt: string } | null;
  note?: string;
};

/** Table des prix médias injectée dans le dimensionnement (implémentée et sourcée en S-017). */
export type MultimodalPriceTable = {
  /** Coût mensuel du pool GPU souverain (C6) par palier — `none` = 0. */
  gpuMonthly: Record<GpuTier, MultimodalPriceEntry>;
  /** Stockage objet/index — €/Go/mois (appliqué à C5 en S-018). */
  storagePerGbMonth: MultimodalPriceEntry;
  /** Forfait embeddings multimodaux — €/mois (appliqué à C4 en S-018 si requis). */
  multimodalEmbeddings: MultimodalPriceEntry;
  /** Prix à l'usage des services API tiers (mode `api`), par modalité × volet (par unité native). */
  api: Record<Modality, { ingest: MultimodalPriceEntry; generate: MultimodalPriceEntry }>;
};

// --- Hypothèses de dimensionnement (modélisation, ±30 %, à raffiner — ADR-010) ----------------

type Volet = "ingest" | "generate";

/** Quantité mensuelle représentative par modalité et palier. Audio/vidéo : min/mois ; images : nb/mois. */
const TIER_QUANTITY: Record<Modality, Record<MMTier, number>> = {
  audio: { none: 0, light: 600, medium: 3000, intensive: 15000 },
  video: { none: 0, light: 60, medium: 300, intensive: 1500 },
  images: { none: 0, light: 1000, medium: 10000, intensive: 100000 },
};

/** Empreinte de stockage par unité native (Go) — médias bruts + dérivés. */
const STORAGE_GB_PER_UNIT: Record<Modality, number> = {
  audio: 0.001, // ~1 Mo/min
  video: 0.05, // ~50 Mo/min
  images: 0.002, // ~2 Mo/image
};

/** Charge GPU relative par unité native et par volet. « créer » pèse plus que « mémoriser » ; vidéo >> audio/images. */
const GPU_LOAD_PER_UNIT: Record<Modality, Record<Volet, number>> = {
  audio: { ingest: 0.05, generate: 0.2 },
  video: { ingest: 0.5, generate: 5 },
  images: { ingest: 0.02, generate: 0.1 },
};

/** Seuils (charge GPU cumulée) de bascule de palier souverain : ≤ shared → shared ; ≤ small → dedicated-small ; sinon dedicated-large. */
const GPU_TIER_THRESHOLDS = { shared: 50, small: 800 } as const;

const UNIT_LABEL: Record<Modality, string> = { audio: "min/mois", video: "min/mois", images: "images/mois" };
const VERB_LABEL: Record<Modality, Record<Volet, string>> = {
  audio: { ingest: "transcription audio", generate: "synthèse vocale" },
  video: { ingest: "analyse vidéo", generate: "génération vidéo" },
  images: { ingest: "OCR/vision images", generate: "génération d'images" },
};

/** Un besoin est ACTIF si au moins un volet a un palier ≠ none (sinon il ne dimensionne rien). */
function isActive(need: MediaNeed): boolean {
  return need.ingest.tier !== "none" || need.generate.tier !== "none";
}

/** Quantité mensuelle d'un volet : `volume` override si fourni, sinon dérivée du palier. */
function voletQuantity(modality: Modality, spec: { tier: MMTier; volume?: number }): number {
  if (spec.tier === "none") return 0;
  return spec.volume ?? TIER_QUANTITY[modality][spec.tier];
}

/** Palier GPU à partir de la charge souveraine cumulée. */
function selectGpuTier(load: number): GpuTier {
  if (load <= 0) return "none";
  if (load <= GPU_TIER_THRESHOLDS.shared) return "shared";
  if (load <= GPU_TIER_THRESHOLDS.small) return "dedicated-small";
  return "dedicated-large";
}

/**
 * Dimensionne les ressources multimédias d'un profil. Fonction pure, prix injectés, déterministe.
 *
 * - Le pool GPU souverain (C6) est compté UNE SEULE FOIS : toutes les charges `sovereign`
 *   (ingest + generate, toutes modalités) alimentent un palier unique ; leur `monthlyCost` de ligne
 *   vaut 0 (anti double-comptage C4/C6). Le mode `api` ne consomme PAS ce GPU : son coût à l'usage
 *   est porté par la ligne (`monthlyCost`), à imputer à la couche en S-018.
 * - La génération (`generate`) pèse plus lourd sur le GPU que la mémorisation (`ingest`).
 * - `mediaNeeds` absent / vide / sans besoin actif → dimensionnement neutre.
 */
export function costMultimodalSizing(profile: Profile, prices: MultimodalPriceTable): Sizing {
  const needs = (profile.mediaNeeds ?? []).filter(isActive);

  if (needs.length === 0) {
    return {
      gpu: { tier: "none", monthlyCost: prices.gpuMonthly.none.amount },
      storageGb: 0,
      embeddingsMultimodal: false,
      workloads: [],
    };
  }

  const workloads: WorkloadLine[] = [];
  const volets: Volet[] = ["ingest", "generate"];
  let sovereignLoad = 0;
  let storageGb = 0;

  for (const need of needs) {
    for (const volet of volets) {
      const spec = need[volet];
      if (spec.tier === "none") continue;

      const qty = voletQuantity(need.modality, spec);
      storageGb += qty * STORAGE_GB_PER_UNIT[need.modality];

      let monthlyCost = 0;
      if (need.mode === "sovereign") {
        sovereignLoad += qty * GPU_LOAD_PER_UNIT[need.modality][volet];
      } else {
        monthlyCost = Math.round(qty * prices.api[need.modality][volet].amount);
      }

      const modeLabel = need.mode === "sovereign" ? "souverain" : "API";
      workloads.push({
        source: volet,
        modality: need.modality,
        mode: need.mode,
        estimate: `${VERB_LABEL[need.modality][volet]} ≈ ${qty} ${UNIT_LABEL[need.modality]} (${modeLabel})`,
        monthlyCost,
        contributesTo: volet === "ingest" ? ["C4", "C5", "C6"] : ["C5", "C6"],
      });
    }
  }

  const gpuTier = selectGpuTier(sovereignLoad);

  return {
    gpu: { tier: gpuTier, monthlyCost: prices.gpuMonthly[gpuTier].amount },
    storageGb: Math.round(storageGb),
    embeddingsMultimodal: true,
    workloads,
  };
}
