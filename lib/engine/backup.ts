// Sauvegarde & résilience, moteur pur (spec n°1, S-026).
//
// `deriveBackupPlan(profile)` traduit la criticité (+ affinage expert + surcharge conformité) en
// paramètres de plan ; `costBackup(...)` chiffre le plan avec des **prix injectés** (DÉFCON 1 :
// aucune valeur monétaire en dur ici) ; `buildBackupPlan(...)` assemble le `BackupPlan` complet
// consommé par `recommend` (S-028). Déterministe, sans dépendance UI ni réseau.
//
// Hypothèses de modélisation (±30 %, comme les facteurs média de S-016) : documentées ci-dessous,
// surchargeables. Les coûts réutilisent les prix stockage (médias) + backup (egress/archive/hors-site).

import { msg, type Message } from "./message";
import type { MultimodalPriceEntry } from "./sizing";
import type {
  Backup,
  BackupCriticality,
  BackupPlan,
  BackupStorageTier,
  CostSource,
  ErasurePolicy,
  Profile,
  Regulation,
  Sizing,
  ThreeTwoOne,
  VectorDecision,
} from "./types";

/** Contrat de prix backup (implémenté/sourcé par `lib/pricing/backup-seed`, injecté ici). */
export type BackupPriceTable = {
  egressPerGb: MultimodalPriceEntry;
  archiveStoragePerGbMonth: MultimodalPriceEntry;
  archiveRetrievalPerGb: MultimodalPriceEntry;
  offsiteBandwidthPerGb: MultimodalPriceEntry;
};

/** Table neutre (coûts 0), défaut d'injection pour préserver la pureté du moteur et les invariants. */
export const NEUTRAL_BACKUP_PRICES: BackupPriceTable = {
  egressPerGb: { amount: 0, currency: "EUR", unit: "Go", confidence: "low", source: null },
  archiveStoragePerGbMonth: { amount: 0, currency: "EUR", unit: "Go·mois", confidence: "low", source: null },
  archiveRetrievalPerGb: { amount: 0, currency: "EUR", unit: "Go", confidence: "low", source: null },
  offsiteBandwidthPerGb: { amount: 0, currency: "EUR", unit: "Go", confidence: "low", source: null },
};

// --- §4 Dérivation criticité → paramètres (défauts prudents, surchargeables) -------------------

type CriticalityParams = {
  rpoMinutes: number;
  rtoMinutes: number;
  retentionDays: number;
  copies: number;
  offsite: boolean;
  airgap: boolean;
  immutable: boolean;
  tier: BackupStorageTier;
  pitr: boolean;
  restoreTestsPerYear: number;
  erasurePolicy: ErasurePolicy;
};

const CRITICALITY_PARAMS: Record<BackupCriticality, CriticalityParams> = {
  none: {
    rpoMinutes: 0, rtoMinutes: 0, retentionDays: 0, copies: 0,
    offsite: false, airgap: false, immutable: false, tier: "hot",
    pitr: false, restoreTestsPerYear: 0, erasurePolicy: "expiration",
  },
  standard: {
    rpoMinutes: 1440, rtoMinutes: 480, retentionDays: 30, copies: 2,
    offsite: true, airgap: false, immutable: false, tier: "hot",
    pitr: false, restoreTestsPerYear: 1, erasurePolicy: "expiration",
  },
  high: {
    rpoMinutes: 60, rtoMinutes: 240, retentionDays: 90, copies: 3,
    offsite: true, airgap: true, immutable: false, tier: "cold",
    pitr: true, restoreTestsPerYear: 2, erasurePolicy: "expiration",
  },
  critical: {
    rpoMinutes: 1, rtoMinutes: 60, retentionDays: 365, copies: 3,
    offsite: true, airgap: true, immutable: true, tier: "cold",
    pitr: true, restoreTestsPerYear: 4, erasurePolicy: "crypto-shred",
  },
};

// --- §6 Conformité : rétention légale (plancher) + érasure ------------------------------------
//
// Durées MINIMALES de conservation par régime, en années. Valeurs SOURCÉES + vérifiées (DÉFCON 1),
// table complète (URL + citation + confiance) dans docs/pricing/backup-cost-sources.md §conformité.
// ⚠ Orientation d'ingénierie, PAS un avis juridique (cf. disclaimer du runbook). RGPD/CNDP n'imposent
// PAS de plancher (principe de minimisation, plafond) → 0 ; le plancher vient des régimes sectoriels.
const LEGAL_RETENTION_YEARS: Partial<Record<Regulation, number>> = {
  rgpd: 0, // RGPD art. 5(1)(e) : limitation de conservation (plafond), aucun minimum
  cndp: 0, // Maroc loi 09-08 : limitation, pas de plancher
  aiact: 10, // Règlement UE 2024/1689 art. 18 : documentation technique conservée 10 ans (plancher le + long du régime ; logs art. 19 = ≥ 6 mois)
  hipaa: 6, // 45 CFR §164.316(b)(2)(i) : 6 ans
  "secret-pro": 5, // recommandation CNB (Guide RGPD avocats) adossée à la prescription civile 5 ans, confiance medium
  none: 0,
};

/** Régimes « régulés » déclenchant la surcharge conformité (crypto-shred + immutable + plancher légal). */
const REGULATED: ReadonlySet<Regulation> = new Set<Regulation>(["secret-pro", "hipaa"]);

function isRegulated(profile: Profile): boolean {
  return profile.sensitivity === "secret" || profile.regulations.some((r) => REGULATED.has(r));
}

/** Plancher de rétention légale (années) = max des obligations des régimes cochés. */
export function legalRetentionYears(regulations: Regulation[]): number {
  let max = 0;
  for (const r of regulations) {
    const years = LEGAL_RETENTION_YEARS[r] ?? 0;
    if (years > max) max = years;
  }
  return max;
}

// --- Noyau du plan (sans coûts) ----------------------------------------------------------------

/** Champs structurels du plan, avant chiffrage. */
export type BackupCore = Omit<
  BackupPlan,
  "backupStorageGb" | "vector" | "monthlyCost" | "setupCost" | "costSources"
>;

function pick<T>(override: T | undefined, derived: T): T {
  return override === undefined ? derived : override;
}

/**
 * Dérive les paramètres du plan depuis la criticité, l'affinage expert et la surcharge conformité
 * (règle `max(criticité, contraintes)`). `none` → plan neutre. Pur.
 */
export function deriveBackupPlan(profile: Profile): BackupCore {
  const b: Backup = profile.backup ?? { criticality: "none" };
  const p = CRITICALITY_PARAMS[b.criticality];
  const regulated = isRegulated(profile);
  const legal = legalRetentionYears(profile.regulations);

  if (b.criticality === "none") {
    // Plan neutre : aucune sauvegarde modélisée (le scoring `resilience` et les risques le signalent).
    return {
      criticality: "none",
      rpoMinutes: 0, rtoMinutes: 0, retentionDays: 0, legalRetentionYears: legal,
      copies: 0, offsite: false, airgap: false, immutable: false,
      tier: "hot", byok: pick(b.byok, false), pitr: false,
      erasurePolicy: pick(b.erasurePolicy, "expiration"), restoreTestsPerYear: 0,
      threeTwoOne: { copies: 0, mediaTypes: 0, offsite: false, airgap: false, tested: false },
    };
  }

  // Surcharge conformité : régulé/secret → érasure crypto-shred + immutabilité forcées.
  const immutable = pick(b.immutable, p.immutable) || regulated;
  const erasurePolicy: ErasurePolicy = regulated ? "crypto-shred" : pick(b.erasurePolicy, p.erasurePolicy);
  const copies = pick(b.copies, p.copies);
  const offsite = pick(b.offsite, p.offsite);
  const airgap = pick(b.airgap, p.airgap);
  const restoreTestsPerYear = pick(b.restoreTestsPerYear, p.restoreTestsPerYear);

  const threeTwoOne: ThreeTwoOne = {
    copies,
    mediaTypes: copies >= 2 ? 2 : 1, // ≥ 2 copies = ≥ 2 supports (règle 3-2-1)
    offsite,
    airgap,
    tested: restoreTestsPerYear > 0,
  };

  return {
    criticality: b.criticality,
    rpoMinutes: pick(b.rpoMinutes, p.rpoMinutes),
    rtoMinutes: pick(b.rtoMinutes, p.rtoMinutes),
    retentionDays: pick(b.retentionDays, p.retentionDays),
    legalRetentionYears: legal,
    copies,
    offsite,
    airgap,
    immutable,
    tier: pick(b.tier, p.tier),
    byok: pick(b.byok, regulated),
    pitr: p.pitr,
    erasurePolicy,
    restoreTestsPerYear,
    threeTwoOne,
  };
}

// --- §7 Coût (agrégé, prix injectés) -----------------------------------------------------------

/** Volume de base (Go) par palier de volume, hypothèse ±30 %, documentée (comme les facteurs S-016). */
const VOLUME_TO_GB: Record<Profile["volume"], number> = {
  lt1: 5,
  "1to10": 30,
  "10to100": 150,
  "100to1000": 800,
  gt1000: 4000,
};

const EPSILON_PG_VAULT_GB = 2; // Postgres + vault (petit, non nul)
const CHURN_RATE_MONTHLY = 0.1; // 10 %/mois de données modifiées (incréments)
const DEDUP_COMPRESSION = 0.6; // dédup + compression → 60 % du volume brut
const RESTORE_TEST_FRACTION = 0.1; // un test restaure ~10 % du volume
const WAL_FRACTION = 0.2; // stockage WAL (PITR) ≈ 20 % du volume de base
const VECTOR_FRACTION = 0.15; // part du corpus représentée par les vecteurs
const REEMBED_HORIZON_MONTHS = 12; // fenêtre de comparaison backup (mensuel) vs ré-embed (one-time)

function eur(entry: MultimodalPriceEntry): number {
  return entry.amount;
}

/** Volume de base (corpus) en Go : palier + médias dimensionnés + Postgres/vault. */
export function baseBackupGb(profile: Profile, sizing: Sizing): number {
  return VOLUME_TO_GB[profile.volume] + sizing.storageGb + EPSILON_PG_VAULT_GB;
}

type CostBackupResult = {
  backupStorageGb: number;
  vector: VectorDecision;
  monthlyCost: number;
  setupCost: number;
  costSources: CostSource[];
};

/**
 * Chiffre un plan (prix injectés). Réutilise le prix de stockage chaud (médias) pour `tier: hot`,
 * le prix d'archive (backup) pour `tier: cold`. Arbitrage vecteurs : choisit backup vs ré-embed au
 * moindre coût sur l'horizon, sauf criticité `critical` (RTO trop court pour ré-embed). Pur.
 */
export function costBackup(
  core: BackupCore,
  sizing: Sizing,
  profile: Profile,
  hotStoragePerGbMonth: MultimodalPriceEntry,
  backupPrices: BackupPriceTable,
): CostBackupResult {
  if (core.criticality === "none") {
    return {
      backupStorageGb: 0,
      vector: { strategy: "backup", backupMonthlyCost: 0, reembedCost: 0, reason: msg("backup.vector.none") },
      monthlyCost: 0,
      setupCost: 0,
      costSources: [],
    };
  }

  const baseGb = baseBackupGb(profile, sizing);
  const retentionFactor = 1 + CHURN_RATE_MONTHLY * (core.retentionDays / 30);
  const hotPrice = eur(hotStoragePerGbMonth);
  const coldPrice = eur(backupPrices.archiveStoragePerGbMonth);

  // Backup opérationnel CHAUD (copie récente accessible pour le RTO), présent à tous les paliers.
  // Le tier froid n'est PAS un remplacement (sinon un plan « high » coûterait moins qu'un « standard »
  // vu le tarif archive ~6× plus bas) mais une archive longue durée EN PLUS → monotonie préservée.
  const operationalGb = baseGb * retentionFactor * core.copies * DEDUP_COMPRESSION;
  let storageGb = operationalGb;
  let storageCost = operationalGb * hotPrice;
  if (core.tier === "cold") {
    const archiveGb = baseGb * DEDUP_COMPRESSION; // 1 copie d'archive froide longue durée
    storageGb += archiveGb;
    storageCost += archiveGb * coldPrice;
  }

  // Tests de restauration (retrait de la fraction testée, mensualisé).
  const egressTestsCost =
    (core.restoreTestsPerYear * RESTORE_TEST_FRACTION * baseGb * eur(backupPrices.archiveRetrievalPerGb)) / 12;
  // Transfert hors-site mensuel (incréments) ; air-gap = une copie de plus.
  const offsiteCopies = (core.offsite ? 1 : 0) + (core.airgap ? 1 : 0);
  const offsiteCost = offsiteCopies * baseGb * CHURN_RATE_MONTHLY * eur(backupPrices.offsiteBandwidthPerGb);
  // Stockage WAL (PITR) au tarif chaud.
  const walCost = core.pitr ? baseGb * WAL_FRACTION * hotPrice : 0;

  // Arbitrage vecteurs (§5) : sauvegarder vs ré-embed (reconstructibles depuis la source).
  const vectorGb = baseGb * VECTOR_FRACTION;
  const vectorOperationalGb = vectorGb * retentionFactor * core.copies * DEDUP_COMPRESSION;
  const vectorBackupMonthly = vectorOperationalGb * hotPrice;
  // Ré-embed : souverain (GPU déjà compté) ⇒ ≈ 0 € mais RTO long ; API ⇒ via le retrait/relecture.
  const usesApi = (profile.mediaNeeds ?? []).some((m) => m.mode === "api");
  const reembedCost = usesApi ? vectorGb * eur(backupPrices.archiveRetrievalPerGb) : 0;
  const forced = profile.backup?.vectorStrategy ?? "auto";
  const reembedViable = core.criticality !== "critical"; // RTO critical trop court pour ré-embed
  let vectorStrategy: "backup" | "reembed";
  let reason: Message;
  if (forced === "backup") {
    vectorStrategy = "backup";
    reason = msg("backup.vector.forcedBackup");
  } else if (forced === "reembed") {
    vectorStrategy = "reembed";
    reason = msg("backup.vector.forcedReembed");
  } else if (reembedViable && reembedCost <= vectorBackupMonthly * REEMBED_HORIZON_MONTHS) {
    vectorStrategy = "reembed";
    reason = msg("backup.vector.autoReembed", { months: REEMBED_HORIZON_MONTHS });
  } else {
    vectorStrategy = "backup";
    reason =
      core.criticality === "critical"
        ? msg("backup.vector.autoBackupCritical")
        : msg("backup.vector.autoBackup");
  }
  const vector: VectorDecision = {
    strategy: vectorStrategy,
    backupMonthlyCost: round2(vectorBackupMonthly),
    reembedCost: round2(reembedCost),
    reason,
  };

  // Si on ré-embed, on ne sauvegarde PAS les vecteurs → retrancher leur poids (chaud) du backup.
  const vectorSavingGb = vectorStrategy === "reembed" ? vectorOperationalGb : 0;
  const effectiveStorageGb = Math.max(0, storageGb - vectorSavingGb);
  const monthlyCost = round2(storageCost - vectorSavingGb * hotPrice + egressTestsCost + offsiteCost + walCost);
  // Mise en route : premier full transféré hors-site (+ ré-embed one-time si choisi).
  const setupCost = round2(
    baseGb * eur(backupPrices.offsiteBandwidthPerGb) + (vectorStrategy === "reembed" ? reembedCost : 0),
  );

  const costSources = dedupeSources([
    hotStoragePerGbMonth.source,
    core.tier === "cold" ? backupPrices.archiveStoragePerGbMonth.source : null,
    backupPrices.archiveRetrievalPerGb.source,
    backupPrices.offsiteBandwidthPerGb.source,
  ]);

  return { backupStorageGb: round2(effectiveStorageGb), vector, monthlyCost, setupCost, costSources };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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

/** Assemble le `BackupPlan` complet (dérivation + chiffrage). Consommé par `recommend` (S-028). */
export function buildBackupPlan(
  profile: Profile,
  sizing: Sizing,
  hotStoragePerGbMonth: MultimodalPriceEntry,
  backupPrices: BackupPriceTable,
): BackupPlan {
  const core = deriveBackupPlan(profile);
  const cost = costBackup(core, sizing, profile, hotStoragePerGbMonth, backupPrices);
  return { ...core, ...cost };
}
