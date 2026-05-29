// Feed de prix LIVE (S-025), extraction structurée Firecrawl + garde-fou DÉFCON 1.
//
// Doctrine (mémoire `prix-jamais-hardcodes-feed-live`) : les prix d'infra ne sont PAS des
// littéraux figés. Ce module interroge en direct, côté serveur, les pages vendor (Scaleway,
// souverain UE) et en extrait les **vraies valeurs publiées**, puis chaque valeur est confrontée
// à la baseline sourcée (`reconcilePrice`) : promue si plausible, sinon repli seed + drapeau.
//
// Périmètre live (extraction nette et validable) : pool GPU souverain (L4, H100) et stockage
// objet/froid Scaleway + postes backup (egress, archive, retrait). Les API tierces à l'usage
// ($ OpenAI/Google/Runway, unités dérivées) restent au seed sourcé (non extractibles de façon
// fiable), leur fraîcheur est suivie ailleurs. Tout échec/aberration → repli seed (garde-fou).
//
// La clé Firecrawl reste serveur ; `fetchImpl` est injectable (tests sans réseau).

import type { MultimodalPriceEntry, MultimodalPriceTable } from "@/lib/engine";
import type { Confidence } from "@/components/ui/StatusDot";
import { scrapeStructuredJson, type ScrapeDeps } from "./scraper";
import { fetchUsdToEur, getMediaPricesEur, type FxDeps, type FxRate } from "./media-feed";
import { BACKUP_PRICE_SEED, type BackupPriceTable } from "./backup-seed";
import { reconcilePrice, type PriceStatus } from "./reconcile";
import { TtlCache } from "./cache";

const GPU_URL = "https://www.scaleway.com/en/pricing/gpu/";
const H100_URL = "https://www.scaleway.com/en/h100/";
const STORAGE_URL = "https://www.scaleway.com/en/pricing/storage/";

/** Heures mensuelles d'utilisation par palier GPU (hypothèse documentée, cf. notes du seed médias). */
const GPU_HOURS = { shared: 200, dedicatedSmall: 730, dedicatedLarge: 730 } as const;

const GPU_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    gpus: {
      type: "array",
      items: {
        type: "object",
        properties: { model: { type: "string" }, pricePerHourEur: { type: "number" } },
        required: ["model", "pricePerHourEur"],
      },
    },
  },
  required: ["gpus"],
};

const STORAGE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    standardStoragePerGbMonthEur: { type: "number" },
    glacierStoragePerGbMonthEur: { type: "number" },
    glacierRetrievalPerGbEur: { type: "number" },
    egressPerGbEur: { type: "number" },
  },
};

// --- Lecture sûre d'un JSON inconnu (sans `as`, sans `any`) -----------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function prop(v: unknown, key: string): unknown {
  return isRecord(v) ? v[key] : undefined;
}

/** Prix horaire (€) du premier GPU dont le modèle commence par `prefix` (insensible à la casse). */
function gpuPricePerHour(json: unknown, prefix: string): number | null {
  const gpus = prop(json, "gpus");
  if (!Array.isArray(gpus)) return null;
  const wanted = prefix.toUpperCase();
  for (const item of gpus) {
    const model = str(prop(item, "model"));
    const price = num(prop(item, "pricePerHourEur"));
    if (model !== null && price !== null && model.toUpperCase().startsWith(wanted)) return price;
  }
  return null;
}

// --- Statut par poste (pour l'UI : fraîcheur + provenance) ------------------------------------

export type LivePriceItem = {
  key: string;
  label: string;
  group: "media" | "backup";
  status: PriceStatus;
  confidence: Confidence;
  amountEur: number;
  unit: string;
  url: string;
  checkedAt: string;
  note?: string;
};

export type LivePriceFeed = {
  media: MultimodalPriceTable;
  backup: BackupPriceTable;
  items: LivePriceItem[];
  fx: FxRate;
  generatedAt: string;
};

function isoDate(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/** Construit une entrée € réconciliée à partir du seed + d'une valeur live (ou null). */
function reconciledEntry(
  seed: MultimodalPriceEntry,
  live: number | null,
  checkedAt: string,
): { entry: MultimodalPriceEntry; status: PriceStatus } {
  const r = reconcilePrice(live, seed.amount, seed.confidence);
  const source =
    seed.source === null ? null : { ...seed.source, checkedAt: r.status === "live" ? checkedAt : seed.source.checkedAt };
  const note = r.note ?? seed.note;
  return {
    entry: {
      amount: r.amount,
      currency: "EUR",
      unit: seed.unit,
      confidence: r.confidence,
      source,
      ...(note === undefined ? {} : { note }),
    },
    status: r.status,
  };
}

function item(
  key: string,
  label: string,
  group: "media" | "backup",
  entry: MultimodalPriceEntry,
  status: PriceStatus,
  checkedAt: string,
): LivePriceItem {
  return {
    key,
    label,
    group,
    status,
    confidence: entry.confidence,
    amountEur: entry.amount,
    unit: entry.unit,
    url: entry.source?.url ?? "",
    checkedAt: status === "live" ? checkedAt : entry.source?.checkedAt ?? checkedAt,
    ...(entry.note === undefined ? {} : { note: entry.note }),
  };
}

export type LiveFeedDeps = ScrapeDeps & { now?: () => number; fxDeps?: FxDeps };

/**
 * Récupère les prix LIVE (médias GPU/stockage + backup) en € avec garde-fou vs baseline.
 * Ne lève jamais : toute extraction absente/aberrante retombe sur le seed daté.
 */
export async function getLivePrices(deps: LiveFeedDeps): Promise<LivePriceFeed> {
  const nowMs = (deps.now ?? ((): number => Date.now()))();
  const checkedAt = isoDate(nowMs);
  const scrapeDeps: ScrapeDeps = { apiKey: deps.apiKey, fetchImpl: deps.fetchImpl, timeoutMs: deps.timeoutMs };

  const [gpuJson, h100Json, storageJson, fx] = await Promise.all([
    scrapeStructuredJson(
      GPU_URL,
      GPU_SCHEMA,
      "Extract the hourly on-demand price in EUR for each GPU instance type (L4, L40S, H100…). Return a list of {model, pricePerHourEur}.",
      scrapeDeps,
    ),
    scrapeStructuredJson(
      H100_URL,
      GPU_SCHEMA,
      "Extract the hourly on-demand price in EUR for the H100 PCIe and H100 SXM GPU instances. Return a list of {model, pricePerHourEur}.",
      scrapeDeps,
    ),
    scrapeStructuredJson(
      STORAGE_URL,
      STORAGE_SCHEMA,
      "From Scaleway Object Storage pricing, extract in EUR: standardStoragePerGbMonthEur (Standard Multi-AZ class, per GB per month), glacierStoragePerGbMonthEur (Glacier/cold class, per GB per month), glacierRetrievalPerGbEur (restore/retrieval of Glacier data, per GB), egressPerGbEur (network egress beyond the free tier, per GB).",
      scrapeDeps,
    ),
    fetchUsdToEur(deps.fxDeps ?? { fetchImpl: deps.fetchImpl, now: deps.now }),
  ]);

  // Base € (seed normalisé), les postes API $ restent ainsi seed+FX ; on n'écrase que le live validé.
  const base = getMediaPricesEur(fx.rate);

  // GPU : €/h live → mensuel (× heures), réconcilié vs le mensuel seed.
  const l4PerHour = gpuPricePerHour(gpuJson, "L4-1");
  const h100PerHour = gpuPricePerHour(h100Json, "H100 PCIE");

  const shared = reconciledEntry(base.gpuMonthly.shared, l4PerHour === null ? null : l4PerHour * GPU_HOURS.shared, checkedAt);
  const dedSmall = reconciledEntry(
    base.gpuMonthly["dedicated-small"],
    l4PerHour === null ? null : l4PerHour * GPU_HOURS.dedicatedSmall,
    checkedAt,
  );
  const dedLarge = reconciledEntry(
    base.gpuMonthly["dedicated-large"],
    h100PerHour === null ? null : h100PerHour * GPU_HOURS.dedicatedLarge,
    checkedAt,
  );

  // Stockage chaud (média C5).
  const storage = reconciledEntry(base.storagePerGbMonth, num(prop(storageJson, "standardStoragePerGbMonthEur")), checkedAt);

  const media: MultimodalPriceTable = {
    ...base,
    gpuMonthly: {
      ...base.gpuMonthly,
      shared: shared.entry,
      "dedicated-small": dedSmall.entry,
      "dedicated-large": dedLarge.entry,
    },
    storagePerGbMonth: storage.entry,
  };

  // Backup (tout EUR, page stockage).
  const egress = reconciledEntry(BACKUP_PRICE_SEED.egressPerGb, num(prop(storageJson, "egressPerGbEur")), checkedAt);
  const archive = reconciledEntry(
    BACKUP_PRICE_SEED.archiveStoragePerGbMonth,
    num(prop(storageJson, "glacierStoragePerGbMonthEur")),
    checkedAt,
  );
  const retrieval = reconciledEntry(
    BACKUP_PRICE_SEED.archiveRetrievalPerGb,
    num(prop(storageJson, "glacierRetrievalPerGbEur")),
    checkedAt,
  );
  // La copie hors-site est un proxy de l'egress : même valeur live, baseline propre.
  const offsite = reconciledEntry(BACKUP_PRICE_SEED.offsiteBandwidthPerGb, num(prop(storageJson, "egressPerGbEur")), checkedAt);

  const backup: BackupPriceTable = {
    egressPerGb: egress.entry,
    archiveStoragePerGbMonth: archive.entry,
    archiveRetrievalPerGb: retrieval.entry,
    offsiteBandwidthPerGb: offsite.entry,
  };

  const items: LivePriceItem[] = [
    item("gpu.shared", "GPU L4 mutualisé (Scaleway)", "media", shared.entry, shared.status, checkedAt),
    item("gpu.dedicated-small", "GPU L4 dédié (Scaleway)", "media", dedSmall.entry, dedSmall.status, checkedAt),
    item("gpu.dedicated-large", "GPU H100 dédié (Scaleway)", "media", dedLarge.entry, dedLarge.status, checkedAt),
    item("storage", "Stockage objet (Scaleway)", "media", storage.entry, storage.status, checkedAt),
    item("backup.egress", "Egress / restauration (Scaleway)", "backup", egress.entry, egress.status, checkedAt),
    item("backup.archive", "Stockage froid / archive (Scaleway)", "backup", archive.entry, archive.status, checkedAt),
    item("backup.retrieval", "Retrait d'archive (Scaleway)", "backup", retrieval.entry, retrieval.status, checkedAt),
    item("backup.offsite", "Copie hors-site (Scaleway)", "backup", offsite.entry, offsite.status, checkedAt),
  ];

  return { media, backup, items, fx, generatedAt: new Date(nowMs).toISOString() };
}

// Cache partagé 6 h : l'extraction structurée est lente + coûteuse en crédits Firecrawl. Volatile
// par instance (persistance durable = S-012). `cache`/`now` injectables pour les tests.
const sharedCache = new TtlCache<LivePriceFeed>(6 * 60 * 60 * 1000);

export async function getLivePricesCached(
  deps: LiveFeedDeps & { cache?: TtlCache<LivePriceFeed> },
): Promise<LivePriceFeed> {
  const nowMs = (deps.now ?? ((): number => Date.now()))();
  const cache = deps.cache ?? sharedCache;
  const hit = cache.get("live", nowMs);
  if (hit !== null) return hit;
  const feed = await getLivePrices(deps);
  cache.set("live", feed, nowMs);
  return feed;
}
