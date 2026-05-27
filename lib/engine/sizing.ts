// Dimensionnement multimédia (S-016, refonte Strate).
//
// Traduit les besoins multimédias (`Profile.mediaNeeds`, 2 volets : mémoriser + créer) en
// RESSOURCES (`Sizing`) : un pool GPU souverain mutualisé compté UNE SEULE FOIS, du stockage
// indexé sur le volume, le drapeau embeddings multimodaux, et des lignes de charge traçables.
//
// Fonction PURE, déterministe, sans dépendance UI (cf. spec §5). Tous les prix sont INJECTÉS
// (`MultimodalPriceTable`) : aucune valeur monétaire codée en dur ici, DÉFCON 1, les tarifs
// sourcés arrivent en S-017 (`getMediaPrices()`). Les facteurs de dimensionnement ci-dessous
// (quantités par palier, empreinte stockage, charge GPU, seuils) sont des HYPOTHÈSES de
// modélisation (±30 %, à raffiner), au même titre que `VOLUME_FACTOR`/`REQ_FACTOR` de `cost.ts`
//, ce ne sont PAS des prix (cf. ADR-010).

import type { Confidence } from "@/components/ui/StatusDot";
import type { CostSource, GpuTier, MediaNeed, MMTier, Modality, Profile, Sizing, WorkloadLine } from "./types";

// --- Contrat de prix médias (implémenté, sourcé, en S-017 : `getMediaPrices`) ----------------

/** Devise d'un prix vendor, stockée **native** (fidèle à la source), convertie en € à l'étage FX. */
export type Currency = "EUR" | "USD";

/**
 * Entrée de prix médias sourcée, dans sa **devise native** (DÉFCON 1 : aucune conversion figée
 * dans le seed, le montant est celui réellement publié). `unit` est le dénominateur (« min »,
 * « image », « Go·mois », « mois ») ; le numérateur est donné par `currency`. `source` est
 * structurellement compatible avec `PriceSource` (`lib/pricing/sources`) : S-017 y injecte des
 * sources réelles (URL + date + confiance). La normalisation en € (via un taux de change sourcé)
 * se fait en aval, cf. `normalizeMediaPricesToEur` (`lib/pricing/media-feed`).
 */
export type MultimodalPriceEntry = {
  amount: number; // montant dans `currency`, par `unit`
  currency: Currency;
  unit: string; // dénominateur : « min », « image », « Go·mois », « mois »
  confidence: Confidence;
  source: { label: string; url: string; checkedAt: string } | null;
  note?: string;
};

/**
 * Table des prix médias injectée dans le dimensionnement (implémentée et sourcée en S-017).
 * Le seed la fournit en **devises natives** ; `costMultimodalSizing` attend une table **normalisée
 * en €** (devise unique), la conversion est faite en amont par l'étage FX (`media-feed`).
 */
export type MultimodalPriceTable = {
  /** Coût mensuel du pool GPU souverain (C6) par palier, `none` = 0. */
  gpuMonthly: Record<GpuTier, MultimodalPriceEntry>;
  /** Stockage objet/index, par Go·mois (appliqué à C5 en S-018). */
  storagePerGbMonth: MultimodalPriceEntry;
  /** Forfait embeddings multimodaux, par mois (appliqué à C4 en S-018 si requis). */
  multimodalEmbeddings: MultimodalPriceEntry;
  /** Prix à l'usage des services API tiers (mode `api`), par modalité × volet (par unité native). */
  api: Record<Modality, { ingest: MultimodalPriceEntry; generate: MultimodalPriceEntry }>;
};

// --- Hypothèses de dimensionnement (modélisation, ±30 %, à raffiner, ADR-010) ----------------

type Volet = "ingest" | "generate";

/** Quantité mensuelle représentative par modalité et palier. Audio/vidéo : min/mois ; images : nb/mois. */
const TIER_QUANTITY: Record<Modality, Record<MMTier, number>> = {
  audio: { none: 0, light: 600, medium: 3000, intensive: 15000 },
  video: { none: 0, light: 60, medium: 300, intensive: 1500 },
  images: { none: 0, light: 1000, medium: 10000, intensive: 100000 },
};

/** Empreinte de stockage par unité native (Go), médias bruts + dérivés. */
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
 *
 * Précondition : `prices` doit être **normalisée dans une devise unique** (€), les montants sont
 * sommés tels quels. Le seed natif (devises mixtes) passe d'abord par `normalizeMediaPricesToEur`.
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

/**
 * Table de prix **neutre** (tous montants à 0 €, sans source), défaut du moteur pour rester PUR
 * (zéro import `lib/pricing`). Donne un dimensionnement structurellement valide mais à coût nul :
 * les appelants réels (UI, S-022) injectent `getMediaPricesEur()` pour un chiffrage effectif.
 */
export const NEUTRAL_MEDIA_PRICES: MultimodalPriceTable = (() => {
  const zero: MultimodalPriceEntry = { amount: 0, currency: "EUR", unit: "—", confidence: "low", source: null };
  return {
    gpuMonthly: { none: zero, shared: zero, "dedicated-small": zero, "dedicated-large": zero },
    storagePerGbMonth: zero,
    multimodalEmbeddings: zero,
    api: {
      audio: { ingest: zero, generate: zero },
      video: { ingest: zero, generate: zero },
      images: { ingest: zero, generate: zero },
    },
  };
})();

/**
 * Coût ponctuel de mise en route = ingestion du **backlog existant** déclaré par modalité
 * (`MediaNeed.backlog`). Pure, prix injectés. Le corpus initial est traité une fois ; on le chiffre
 * au tarif d'ingestion à l'usage de la modalité (`api.<modality>.ingest`), borne haute conservatrice,
 * valable que la modalité soit ensuite exploitée en souverain ou en API (cf. ADR-012). Hors backlog → 0.
 */
export function computeSetupCost(profile: Profile, prices: MultimodalPriceTable): number {
  let setup = 0;
  for (const need of profile.mediaNeeds ?? []) {
    const backlog = need.backlog ?? 0;
    if (backlog > 0) setup += backlog * prices.api[need.modality].ingest.amount;
  }
  return Math.round(setup);
}

/**
 * Sources des prix effectivement mobilisés pour ce profil/dimensionnement (DÉFCON 1 : traçabilité).
 * Dédupliquées par URL, sources nulles écartées. Pure.
 */
export function mediaCostSources(profile: Profile, sizing: Sizing, prices: MultimodalPriceTable): CostSource[] {
  const seen = new Set<string>();
  const out: CostSource[] = [];
  const add = (s: MultimodalPriceEntry["source"]): void => {
    if (s !== null && !seen.has(s.url)) {
      seen.add(s.url);
      out.push({ label: s.label, url: s.url, checkedAt: s.checkedAt });
    }
  };
  if (sizing.gpu.monthlyCost > 0) add(prices.gpuMonthly[sizing.gpu.tier].source);
  if (sizing.storageGb > 0) add(prices.storagePerGbMonth.source);
  if (sizing.embeddingsMultimodal) add(prices.multimodalEmbeddings.source);
  for (const w of sizing.workloads) {
    if (w.mode === "api") add(prices.api[w.modality][w.source].source);
  }
  for (const need of profile.mediaNeeds ?? []) {
    if ((need.backlog ?? 0) > 0) add(prices.api[need.modality].ingest.source);
  }
  return out;
}
