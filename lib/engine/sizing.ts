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
import { msg } from "./message";
import { BASELINE_SIZING_PARAMS, type SizingParams, type Volet } from "./sizing-params";
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

// --- Étiquettes de lignes de charge (non paramétriques) --------------------------------------
// Les HYPOTHÈSES de dimensionnement (quantités, empreinte stockage, charge GPU, seuils) sont
// désormais des PARAMÈTRES injectables (S-056) : cf. `SizingParams` / `BASELINE_SIZING_PARAMS`.

/** Un besoin est ACTIF si au moins un volet a un palier ≠ none (sinon il ne dimensionne rien). */
function isActive(need: MediaNeed): boolean {
  return need.ingest.tier !== "none" || need.generate.tier !== "none";
}

/** Quantité mensuelle d'un volet : `volume` override si fourni, sinon dérivée du palier (paramétré). */
function voletQuantity(modality: Modality, spec: { tier: MMTier; volume?: number }, params: SizingParams): number {
  if (spec.tier === "none") return 0;
  return spec.volume ?? params.tierQuantity[modality][spec.tier];
}

/** Palier GPU à partir de la charge souveraine cumulée et des seuils paramétrés. */
function selectGpuTier(load: number, thresholds: SizingParams["gpuTierThresholds"]): GpuTier {
  if (load <= 0) return "none";
  if (load <= thresholds.shared) return "shared";
  if (load <= thresholds.small) return "dedicated-small";
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
export function costMultimodalSizing(
  profile: Profile,
  prices: MultimodalPriceTable,
  params: SizingParams = BASELINE_SIZING_PARAMS,
): Sizing {
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

      const qty = voletQuantity(need.modality, spec, params);
      storageGb += qty * params.storageGbPerUnit[need.modality];

      let monthlyCost = 0;
      if (need.mode === "sovereign") {
        sovereignLoad += qty * params.gpuLoadPerUnit[need.modality][volet];
      } else {
        monthlyCost = Math.round(qty * prices.api[need.modality][volet].amount);
      }

      workloads.push({
        source: volet,
        modality: need.modality,
        mode: need.mode,
        // Descripteur i18n (S-058) : verbe (modalité × volet) ≈ quantité unité (mode). Résolu fr/en par l'UI.
        estimate: msg("sizing.estimate", { vkey: `${need.modality}_${volet}`, qty, modality: need.modality, mode: need.mode }),
        monthlyCost,
        contributesTo: volet === "ingest" ? ["C4", "C5", "C6"] : ["C5", "C6"],
      });
    }
  }

  const gpuTier = selectGpuTier(sovereignLoad, params.gpuTierThresholds);

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
