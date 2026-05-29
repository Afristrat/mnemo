// Résidence multi-juridiction + DR/failover (spec n°2, S-044). Pur, déterministe, prix injectés.
//
// Modélise la résidence des données par juridiction + la réplication inter-région + le DR (none/warm/
// hot + actif-actif) comme dimension COSTABLE + CONFORME : `Profile.residency` → `ResidencyPlan`
// (topologie de régions + DR) → coût agrégé sourcé (egress inter-région injecté S-043 + régions en
// attente via `computeSovereignCompute` S-041) → conformité des transferts (lib/legal S-043, DÉFCON 1)
// → conflit résidence × DR exposé (JAMAIS résolu en douce) → `geoSovScore`. Prix INJECTÉS, défaut
// neutre (invariant `totalCost` préservé). Intégration dans `recommend` = S-046.

import type {
  CostSource,
  DrTier,
  Preset,
  Profile,
  Region,
  RegionAssignment,
  RegionRole,
  ResidencyPlan,
  TransferFlag,
  Zone,
} from "./types";
import { decidePreset } from "./preset";
import { computeSovereignCompute, NEUTRAL_COMPUTE_PRICES, type ComputePriceTable } from "./compute";
import { lookupTransferBasis, type TransferContext } from "@/lib/legal/transfers";
import type { MultimodalPriceEntry } from "./sizing";

// --- Contrat de prix résidence (DANS le moteur ; le SEED sourcé vit dans lib/pricing/residency-seed,
// comme BackupPriceTable/backup-seed). Prix INJECTÉS, le moteur reste pur (zéro import lib/pricing). --

/** Profil d'hébergement d'un vecteur d'egress. `sovereign` = false uniquement pour les hyperscalers. */
export type HostingClass = "self-hosted" | "sovereign-eu" | "secnumcloud" | "hyperscaler";

/** Vecteur d'egress inter-région sourcé pour un fournisseur (first-class, multi-segment). */
export type EgressVector = {
  provider: string;
  hostingClass: HostingClass;
  sovereign: boolean;
  /** Egress inter-région, devise native, montant **par Go** (unité native rappelée en `note`). */
  interRegionEgress: MultimodalPriceEntry;
};

/** Table résidence injectée : vecteurs d'egress + sécurisation inter-site. */
export type ResidencyPriceTable = {
  egressVectors: EgressVector[];
  interSiteSecurityPerMonth: MultimodalPriceEntry;
};

/** Table neutre (un vecteur 0 €/Go par classe) : défaut d'injection, invariant `totalCost` préservé. */
export const NEUTRAL_RESIDENCY_PRICES: ResidencyPriceTable = {
  egressVectors: (["self-hosted", "sovereign-eu", "secnumcloud", "hyperscaler"] as const).map((hostingClass) => ({
    provider: "neutre",
    hostingClass,
    sovereign: hostingClass !== "hyperscaler",
    interRegionEgress: { amount: 0, currency: "EUR", unit: "Go", confidence: "low", source: null },
  })),
  interSiteSecurityPerMonth: { amount: 0, currency: "EUR", unit: "mois", confidence: "low", source: null },
};

/** Vecteurs d'egress d'une classe d'hébergement (préserve l'ordre). */
export function vectorsForClass(table: ResidencyPriceTable, hostingClass: HostingClass): EgressVector[] {
  return table.egressVectors.filter((v) => v.hostingClass === hostingClass);
}

/** Vecteur représentatif d'une classe (1ᵉʳ du table) ; repli sur le 1ᵉʳ disponible, sinon vecteur neutre. */
export function selectEgressVector(table: ResidencyPriceTable, hostingClass: HostingClass): EgressVector {
  const first = vectorsForClass(table, hostingClass)[0] ?? table.egressVectors[0];
  return (
    first ?? {
      provider: "neutre",
      hostingClass,
      sovereign: hostingClass !== "hyperscaler",
      interRegionEgress: { amount: 0, currency: "EUR", unit: "Go", confidence: "low", source: null },
    }
  );
}

// --- Hypothèses de modélisation (±30 %, documentées — mêmes conventions que backup S-026) ---------

/** Volume de base (Go) par palier (aligné sur `backup.ts`, hypothèse ±30 %). */
const VOLUME_TO_GB: Record<Profile["volume"], number> = {
  lt1: 5,
  "1to10": 30,
  "10to100": 150,
  "100to1000": 800,
  gt1000: 4000,
};
const EPSILON_PG_VAULT_GB = 2;
const CHURN_RATE_MONTHLY = 0.1; // 10 %/mois de données modifiées → re-répliquées
/** Fraction du compute de référence par région en attente. */
const STANDBY_FRACTION = { warm: 0.3, hot: 1.0, active: 1.0 } as const;

/** RPO/RTO **régionaux** par palier DR (minutes, hypothèse documentée). `none` → RTO = restauration backup. */
const DR_PARAMS: Record<DrTier, { rpo: number; rto: number }> = {
  none: { rpo: 1440, rto: 480 },
  warm: { rpo: 60, rto: 240 },
  hot: { rpo: 15, rto: 60 },
};
const ACTIVE_ACTIVE_PARAMS = { rpo: 0, rto: 5 };

/** Juridictions disposant de ≥ 2 régions distinctes conformes (pas de conflit résidence stricte × DR). */
const MULTI_REGION_JURISDICTIONS: ReadonlySet<Region> = new Set<Region>(["eu", "us"]);

const round = Math.round;

// --- Dérivation profil → topologie (pure, spec §4) ------------------------------------------------

export type ResidencyTopology = {
  primaryRegion: Region;
  secondaryRegion: Region;
  drTier: DrTier;
  activeActive: boolean;
  noTransfer: boolean;
  regulatedData: boolean;
  rpoMinutes: number;
  rtoMinutes: number;
  extras: { region: Region; role: RegionRole; fraction: number }[];
};

function zoneToRegion(zone: Zone): Region {
  return zone === "ue" ? "eu" : zone;
}

/**
 * Classe d'hébergement par défaut dérivée de la zone (choix du vecteur d'egress sourcé, S-048).
 * Souverains UE/Maroc → `sovereign-eu` (vecteurs souverains sourcés) ; US/autre → `hyperscaler`
 * (egress facturé par les hyperscalers). `self-hosted`/`secnumcloud` restent des choix EXPLICITES
 * (jamais imposés par dérivation — ils relèvent d'une décision d'infrastructure, pas de la zone).
 */
export function hostingClassForProfile(p: Profile): HostingClass {
  return p.zone === "us" || p.zone === "other" ? "hyperscaler" : "sovereign-eu";
}

/** Données régulées (déclenche la résidence stricte par défaut + le flag Cloud Act vers les US). */
function isRegulatedData(p: Profile): boolean {
  return (
    p.sensitivity === "secret" ||
    p.regulations.some((r) => r === "cndp" || r === "secret-pro" || r === "hipaa")
  );
}

function raiseTier(tier: DrTier): DrTier {
  return tier === "none" ? "warm" : tier === "warm" ? "hot" : "hot";
}

/** DR par défaut : criticité backup (critical→hot, high→warm, sinon none), relevé d'un cran si HA implicite. */
function defaultDrTier(p: Profile): DrTier {
  const crit = p.backup?.criticality ?? "none";
  const base: DrTier = crit === "critical" ? "hot" : crit === "high" ? "warm" : "none";
  return p.latency === "fast" && p.users > 50 ? raiseTier(base) : base;
}

export function deriveResidencyTopology(p: Profile): ResidencyTopology {
  const r = p.residency ?? {};
  const primaryRegion = r.primaryRegion ?? zoneToRegion(p.zone);
  const regulatedData = isRegulatedData(p);
  // Résidence stricte par défaut si données régulées ; `rgpd` seul → transferts restreints (pas interdits).
  const noTransfer = r.noTransferOutsideJurisdiction ?? regulatedData;
  const drTier = r.drTier ?? defaultDrTier(p);
  const activeActive = r.activeActive ?? false;

  // Région secondaire : sous résidence stricte, rester dans la juridiction (même région) ; sinon une
  // région autorisée distincte si fournie, à défaut la primaire (DR intra-juridiction).
  const distinctAllowed = (r.allowedRegions ?? []).find((reg) => reg !== primaryRegion);
  const secondaryRegion: Region = noTransfer ? primaryRegion : distinctAllowed ?? primaryRegion;

  const drParams = activeActive ? ACTIVE_ACTIVE_PARAMS : DR_PARAMS[drTier];
  const rpoMinutes = r.drRpoMinutes ?? drParams.rpo;
  const rtoMinutes = r.drRtoMinutes ?? drParams.rto;

  const extras: ResidencyTopology["extras"] = [];
  if (activeActive) {
    extras.push({ region: secondaryRegion, role: "active", fraction: STANDBY_FRACTION.active });
  } else if (drTier === "warm") {
    extras.push({ region: secondaryRegion, role: "standby", fraction: STANDBY_FRACTION.warm });
  } else if (drTier === "hot") {
    extras.push({ region: secondaryRegion, role: "standby", fraction: STANDBY_FRACTION.hot });
  }

  return {
    primaryRegion,
    secondaryRegion,
    drTier,
    activeActive,
    noTransfer,
    regulatedData,
    rpoMinutes,
    rtoMinutes,
    extras,
  };
}

// --- Volume & coût (pur, prix injectés, spec §6) --------------------------------------------------

function baseGbOf(p: Profile, override?: number): number {
  return override ?? VOLUME_TO_GB[p.volume] + EPSILON_PG_VAULT_GB;
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

export type ResidencyCost = {
  regions: RegionAssignment[];
  monthlyCost: number;
  setupCost: number;
  costSources: CostSource[];
};

/**
 * Coût résidence/DR (pur, prix INJECTÉS) : régions en attente (compute via `computeSovereignCompute`)
 * + réplication (egress inter-région × volume × churn). `none` + mono-région → 0 (anti double-comptage :
 * le RTO régional sans réplica = restauration backup, déjà chiffrée spec n°1).
 */
export function costResidency(
  p: Profile,
  topo: ResidencyTopology,
  residencyPrices: ResidencyPriceTable = NEUTRAL_RESIDENCY_PRICES,
  computePrices: ComputePriceTable = NEUTRAL_COMPUTE_PRICES,
  preset: Preset = decidePreset(p).preset,
  hostingClass: HostingClass = "sovereign-eu",
  baseGbOverride?: number,
): ResidencyCost {
  const primary: RegionAssignment = {
    region: topo.primaryRegion,
    role: topo.activeActive ? "active" : "primary",
    monthlyCost: 0, // compute de la primaire = base C6 (compté ailleurs), pas une surcharge résidence
  };

  if (topo.extras.length === 0) {
    return { regions: [primary], monthlyCost: 0, setupCost: 0, costSources: [] };
  }

  const baselineSizing = computeSovereignCompute(p, preset, computePrices);
  const baselineCompute = baselineSizing.monthlyCost;
  const egressVector = selectEgressVector(residencyPrices, hostingClass);
  const egressPerGb = egressVector.interRegionEgress.amount;
  const baseGb = baseGbOf(p, baseGbOverride);

  const replicaRegions: RegionAssignment[] = topo.extras.map((e) => ({
    region: e.region,
    role: e.role,
    monthlyCost: round(baselineCompute * e.fraction),
  }));

  const computeMonthly = replicaRegions.reduce((sum, r) => sum + r.monthlyCost, 0);
  // Actif-actif = synchronisation bidirectionnelle → réplication doublée (vs hot standby passif).
  const replicationMultiplier = topo.activeActive ? 2 : 1;
  // Réplication : egress inter-région × volume × churn, par région répliquée.
  const replicationMonthly = round(egressPerGb * baseGb * CHURN_RATE_MONTHLY * topo.extras.length * replicationMultiplier);
  // Amorçage : premier transfert complet vers chaque réplica.
  const setupCost = round(egressPerGb * baseGb * topo.extras.length * replicationMultiplier);

  const costSources = dedupeSources([egressVector.interRegionEgress.source, ...baselineSizing.sources]);

  return {
    regions: [primary, ...replicaRegions],
    monthlyCost: computeMonthly + replicationMonthly,
    setupCost,
    costSources,
  };
}

// --- Conformité des transferts + conflit + geoSov (spec §5/§7) ------------------------------------

function buildTransfers(topo: ResidencyTopology): TransferFlag[] {
  const ctx: TransferContext = { noTransfer: topo.noTransfer, regulatedData: topo.regulatedData };
  const flags: TransferFlag[] = [];
  for (const e of topo.extras) {
    if (e.region === topo.primaryRegion) continue; // réplica intra-juridiction = pas de flux transfrontière
    const b = lookupTransferBasis(topo.primaryRegion, e.region, ctx);
    const cloudActNote = b.cloudAct ? " ⚠ exposition US Cloud Act." : "";
    flags.push({
      from: topo.primaryRegion,
      to: e.region,
      legalBasis: b.legalBasis,
      status: b.status,
      note: `${b.note ?? ""}${cloudActNote} (vérifié ${b.checkedAt}${b.volatile ? ", statut évolutif" : ""}). ${b.disclaimer}`.trim(),
    });
  }
  return flags;
}

function buildConflict(topo: ResidencyTopology): ResidencyPlan["conflict"] {
  const hasDr = topo.drTier !== "none" || topo.activeActive;
  const singleRegionJurisdiction = !MULTI_REGION_JURISDICTIONS.has(topo.primaryRegion);
  if (topo.noTransfer && hasDr && singleRegionJurisdiction) {
    return {
      hasConflict: true,
      reason: `Résidence stricte en « ${topo.primaryRegion} » × DR ${topo.activeActive ? "actif-actif" : topo.drTier} : cette juridiction peut ne pas offrir 2 régions distinctes conformes pour la continuité régionale.`,
      levers: [
        "Région UE secondaire conforme (si un transfert encadré est acceptable).",
        "Accepter un RTO = restauration backup (DR « none », pas de réplica).",
        "Actif-passif intra-région chez un 2ᵉ fournisseur souverain.",
      ],
    };
  }
  return { hasConflict: false, reason: "", levers: [] };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Score « souveraineté géographique » 0-10 (alimente la 10ᵉ dim `geosov`, câblée en S-045). */
function geoSovScore(topo: ResidencyTopology, transfers: TransferFlag[], conflict: ResidencyPlan["conflict"]): number {
  let s = 6;
  s += 2; // données dans la juridiction visée (primaryRegion = zone par construction)
  if (topo.noTransfer && transfers.every((t) => t.status === "ok")) s += 1; // résidence stricte respectée
  for (const t of transfers) {
    if (t.status === "forbidden") s -= 3;
    else if (t.status === "restricted") s -= 1;
  }
  if ((topo.drTier !== "none" || topo.activeActive) && !conflict.hasConflict) s += 1; // résilient + conforme
  return clamp(s, 0, 10);
}

// --- Point d'entrée : plan complet ----------------------------------------------------------------

/**
 * Plan résidence/DR complet (pur, prix injectés). `drTier none` + mono-région → plan neutre (coûts 0).
 * @param hostingClass classe d'hébergement pour choisir le vecteur d'egress (défaut sovereign-eu ; S-048 le câblera au profil).
 */
export function deriveResidencyPlan(
  p: Profile,
  residencyPrices: ResidencyPriceTable = NEUTRAL_RESIDENCY_PRICES,
  computePrices: ComputePriceTable = NEUTRAL_COMPUTE_PRICES,
  preset: Preset = decidePreset(p).preset,
  hostingClass: HostingClass = "sovereign-eu",
  baseGbOverride?: number,
): ResidencyPlan {
  const topo = deriveResidencyTopology(p);
  const cost = costResidency(p, topo, residencyPrices, computePrices, preset, hostingClass, baseGbOverride);
  const transfers = buildTransfers(topo);
  const conflict = buildConflict(topo);
  return {
    primaryRegion: topo.primaryRegion,
    regions: cost.regions,
    drTier: topo.drTier,
    activeActive: topo.activeActive,
    rpoMinutes: topo.rpoMinutes,
    rtoMinutes: topo.rtoMinutes,
    transfers,
    conflict,
    monthlyCost: cost.monthlyCost,
    setupCost: cost.setupCost,
    geoSovScore: geoSovScore(topo, transfers, conflict),
    costSources: cost.costSources,
  };
}
