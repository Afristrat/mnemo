// Seed des prix d'infra multimédia (S-017, refonte Strate), DÉFCON 1.
//
// Chaque entrée est dans sa DEVISE NATIVE (fidèle à la source publiée : Scaleway en €, OpenAI /
// Google / Runway en $) ; la conversion en € se fait à l'étage FX (`media-feed.ts`), avec un taux
// de change sourcé. Toutes les sources (URL + date + confiance) sont consignées dans
// `docs/pricing/media-cost-sources.md`. Les valeurs dérivées (conversion d'unité, hypothèse
// d'utilisation) portent une confiance dégradée + la mention « estimation, à confirmer par devis ».
//
// ⚠ Ne JAMAIS éditer un montant ici sans mettre à jour `docs/pricing/media-cost-sources.md`
// (source + date). Le feed Firecrawl signale la fraîcheur des pages ; il ne réécrit pas le seed.

import type { MultimodalPriceEntry, MultimodalPriceTable } from "@/lib/engine";

const CHECKED_AT = "2026-05-26";

/**
 * Taux de change de repli (USD → EUR), sourcé : BCE, référence EUR/USD = 1,1634 au 2026-05-26
 * (1 USD = 1 / 1,1634 ≈ 0,85955 EUR). Le feed récupère un taux live (Frankfurter, adossé BCE) et
 * bascule sur celui-ci si indisponible.
 */
export const SEED_USD_TO_EUR = 0.85955;

export const SEED_FX_SOURCE = {
  label: "BCE, taux de référence EUR/USD",
  url: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-usd.en.html",
  checkedAt: CHECKED_AT,
} as const;

type SrcArgs = {
  amount: number;
  currency: MultimodalPriceEntry["currency"];
  unit: string;
  confidence: MultimodalPriceEntry["confidence"];
  label: string;
  url: string;
  note?: string;
};

function priced(args: SrcArgs): MultimodalPriceEntry {
  return {
    amount: args.amount,
    currency: args.currency,
    unit: args.unit,
    confidence: args.confidence,
    source: { label: args.label, url: args.url, checkedAt: CHECKED_AT },
    ...(args.note === undefined ? {} : { note: args.note }),
  };
}

const SCALEWAY_GPU = "https://www.scaleway.com/en/pricing/gpu/";
const SCALEWAY_H100 = "https://www.scaleway.com/en/h100/";
const SCALEWAY_STORAGE = "https://www.scaleway.com/en/pricing/storage/";
const QWEN_VL_EMBED = "https://huggingface.co/Qwen/Qwen3-VL-Embedding-8B";
const OPENAI_WHISPER = "https://developers.openai.com/api/docs/models/whisper-1";
const OPENAI_TTS = "https://developers.openai.com/api/docs/models/tts-1";
const OPENAI_IMAGE = "https://developers.openai.com/api/docs/guides/image-generation";
const GOOGLE_VISION = "https://cloud.google.com/vision/pricing";
const RUNWAY = "https://docs.dev.runwayml.com/guides/pricing";

const ESTIMATE_NOTE = "estimation, à confirmer par devis";

/**
 * Table seed des prix d'infra multimédia, en **devises natives**. Source de vérité (le feed la
 * rafraîchit en fraîcheur, pas en valeur). Voir `docs/pricing/media-cost-sources.md` pour la
 * dérivation complète de chaque chiffre.
 */
export const MEDIA_PRICE_SEED: MultimodalPriceTable = {
  // Pool GPU souverain (Scaleway, UE/France, €). Mensuel = tarif horaire sourcé × utilisation
  // estimée (hypothèse) → confiance `medium`. Cf. media-cost-sources.md §1.
  gpuMonthly: {
    none: {
      amount: 0,
      currency: "EUR",
      unit: "mois",
      confidence: "high",
      source: null,
      note: "Pas de GPU souverain.",
    },
    shared: priced({
      amount: 150,
      currency: "EUR",
      unit: "mois",
      confidence: "medium",
      label: "Scaleway, GPU L4 (0,75 €/h)",
      url: SCALEWAY_GPU,
      note: `L4 0,75 €/h × ~200 h/mois (mutualisé), ${ESTIMATE_NOTE}`,
    }),
    "dedicated-small": priced({
      amount: 548,
      currency: "EUR",
      unit: "mois",
      confidence: "medium",
      label: "Scaleway, GPU L4 (0,75 €/h)",
      url: SCALEWAY_GPU,
      note: `L4 0,75 €/h × 730 h (1 GPU continu), ${ESTIMATE_NOTE}`,
    }),
    "dedicated-large": priced({
      amount: 1993,
      currency: "EUR",
      unit: "mois",
      confidence: "medium",
      label: "Scaleway, GPU H100 (2,73 €/h)",
      url: SCALEWAY_H100,
      note: `H100 2,73 €/h × 730 h (continu), ${ESTIMATE_NOTE}`,
    }),
  },

  // Stockage objet (C5), Scaleway Standard Multi-AZ, valeur € publiée telle quelle.
  storagePerGbMonth: priced({
    amount: 0.0146,
    currency: "EUR",
    unit: "Go·mois",
    confidence: "high",
    label: "Scaleway, Object Storage (Standard Multi-AZ)",
    url: SCALEWAY_STORAGE,
  }),

  // Embeddings multimodaux (C4), pour une base souveraine, le référent #1 est OPEN et self-hosté
  // sur le GPU déjà compté en C6 → aucun surcoût C4 séparé (anti double-comptage). Cf. §3 du doc.
  multimodalEmbeddings: priced({
    amount: 0,
    currency: "EUR",
    unit: "mois",
    confidence: "high",
    label: "Qwen3-VL-Embedding (open, Apache 2.0, #1 MMEB-V2 77,8), self-hosté sur le GPU souverain",
    url: QWEN_VL_EMBED,
    note: "modèle open #1 self-hosté sur le GPU déjà compté (C6) → pas de surcoût C4 séparé (anti double-comptage). Alternatives API : Jina v4 (~0,05 $/1M tokens), Cohere Embed v4",
  }),

  // API à l'usage (mode `api`), devises natives. Cf. media-cost-sources.md §4.
  api: {
    audio: {
      ingest: priced({
        amount: 0.006,
        currency: "USD",
        unit: "min",
        confidence: "medium",
        label: "OpenAI, whisper-1 (0,006 $/min)",
        url: OPENAI_WHISPER,
      }),
      generate: priced({
        amount: 0.0135,
        currency: "USD",
        unit: "min",
        confidence: "low",
        label: "OpenAI, tts-1 (15 $/1M caractères)",
        url: OPENAI_TTS,
        note: `15 $/1M car. × ~900 car./min, ${ESTIMATE_NOTE}`,
      }),
    },
    video: {
      ingest: priced({
        amount: 0.09,
        currency: "USD",
        unit: "min",
        confidence: "low",
        label: "Google Cloud, Vision API (1,50 $/1000 images)",
        url: GOOGLE_VISION,
        note: `échantillonnage ~1 img/s (60 img/min) × 0,0015 $/img, ${ESTIMATE_NOTE}`,
      }),
      generate: priced({
        amount: 3,
        currency: "USD",
        unit: "min",
        confidence: "medium",
        label: "Runway, Gen-4 Turbo (0,05 $/s)",
        url: RUNWAY,
        note: "0,05 $/s × 60 s/min",
      }),
    },
    images: {
      ingest: priced({
        amount: 0.0015,
        currency: "USD",
        unit: "image",
        confidence: "medium",
        label: "Google Cloud, Vision API (1,50 $/1000 images)",
        url: GOOGLE_VISION,
      }),
      generate: priced({
        amount: 0.042,
        currency: "USD",
        unit: "image",
        confidence: "medium",
        label: "OpenAI, gpt-image-1 (medium, 1024², 0,042 $/image)",
        url: OPENAI_IMAGE,
      }),
    },
  },
};
