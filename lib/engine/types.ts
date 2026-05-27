// Types du moteur de recommandation Strate.
// Porté de design-reference/.../simulator-archi-base-memorielle-v2.html (logique pure, sans UI).

export const PRESETS = ["LIGHT", "MEDIUM", "HARD"] as const;
export type Preset = (typeof PRESETS)[number];

export const CONTENT_TYPES = ["text", "audio", "video", "images", "code", "structured"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const REGULATIONS = ["rgpd", "cndp", "aiact", "hipaa", "secret-pro", "none"] as const;
export type Regulation = (typeof REGULATIONS)[number];

export type Zone = "ue" | "maroc" | "us" | "other";
export type Volume = "lt1" | "1to10" | "10to100" | "100to1000" | "gt1000";
export type Growth = "low" | "medium" | "high";
export type Sensitivity = "public" | "internal" | "confidential" | "secret";
export type TechLevel = "none" | "dev" | "hybrid" | "devops";
export type Budget = "lt50" | "50to200" | "200to500" | "500to2k" | "gt2k";
export type ReqPerDay = "lt100" | "lt1k" | "lt10k" | "gt10k";
export type Latency = "fast" | "acceptable" | "relaxed";
export type Voices = "solo" | "multi" | "many";

export type Activity =
  | "freelance"
  | "cabinet-regule"
  | "particulier"
  | "agence"
  | "pme-startup"
  | "recherche"
  | "other";

export const MODULE_IDS = ["bisect", "reversal", "prereg", "mel", "conflict"] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

// --- Refonte Strate : besoins multimédias, dimensionnement, verdict (S-015) ---
// Types définis maintenant, consommés en S-016 (sizing) et S-018 (verdict / Recommendation).

export type MMTier = "none" | "light" | "medium" | "intensive";
/** Mode d'exécution d'une modalité : `sovereign` = self-host (consomme le pool GPU C6) ; `api` = service tiers (coût à l'usage, ne consomme pas le GPU souverain). */
export type MMMode = "sovereign" | "api";
export type Modality = "audio" | "video" | "images";
/**
 * Besoin pour une modalité, à deux volets qui dimensionnent tous deux l'infra :
 * `ingest` = mémoriser/traiter l'existant ; `generate` = créer/produire sur l'infra de l'utilisateur.
 * Convention (consommée en S-016) : si `ingest.tier === "none"` ET `generate.tier === "none"`, la MediaNeed
 * est INACTIVE et ne contribue pas au `Sizing`, le consommateur doit la filtrer. `volume` (optionnel) override le palier.
 */
export type MediaNeed = {
  modality: Modality;
  mode: MMMode;
  ingest: { tier: MMTier; volume?: number }; // volet « mémoriser »
  generate: { tier: MMTier; volume?: number }; // volet « créer » (tier "none" = pas de génération)
  /**
   * Volume du **backlog existant** à ingérer une seule fois (corpus déjà là), en unité native de la
   * modalité (min pour audio/vidéo, nb pour images). Alimente le `setupCost` one-time (≠ récurrent).
   * Saisi par le bloc Médias du wizard (UI en S-020) ; consommé dès S-018 par `computeSetupCost`.
   */
  backlog?: number;
};
/**
 * Palier du pool GPU souverain (C6), dimensionné par la charge TOTALE (ingest + generate).
 * Granularité **validée en S-016** (4 paliers suffisants pour le conseil ±30 %, cf. ADR-010) :
 * `none` (pas de GPU), `shared` (mutualisé, petites charges), `dedicated-small` (1 GPU dédié),
 * `dedicated-large` (multi-GPU, génération vidéo intensive).
 */
export type GpuTier = "none" | "shared" | "dedicated-small" | "dedicated-large";
/**
 * Ligne de charge multimédia produite par le dimensionnement (`sizing.ts`, S-016), traçabilité.
 * `monthlyCost` (€/mois) : coût récurrent propre de la ligne, **0** pour `sovereign` (la charge est
 * absorbée par le pool GPU mutualisé `Sizing.gpu`, compté UNE SEULE FOIS → anti double-comptage C4/C6),
 * **> 0** pour `api` (coût à l'usage du service tiers). `contributesTo` : couches alimentées par cette
 * charge (C4 embeddings · C5 stockage · C6 inférence/GPU), exploité par la décomposition de coûts
 * S-018/S-022. (Extension additive de la spec §4.3, cf. ADR-010.)
 */
export type WorkloadLine = {
  source: "ingest" | "generate";
  modality: Modality;
  mode: MMMode;
  estimate: string;
  monthlyCost: number;
  contributesTo: ("C4" | "C5" | "C6")[];
};
export type Sizing = {
  gpu: { tier: GpuTier; monthlyCost: number };
  storageGb: number;
  embeddingsMultimodal: boolean;
  workloads: WorkloadLine[];
};
export type Verdict = {
  pain: string;
  risk: string;
  gain: string;
  firmPriceTier: string; // prix ferme service Strate ([PLACEHOLDER])
  variableCostBand: { low: number; high: number };
  setupCostBand: { low: number; high: number };
  nextStep: string;
};
export type BlockId = "profil" | "infra" | "memoire" | "medias";

/** Source d'un coût (URL + date), structurellement compatible avec `PriceSource` (`lib/pricing`). */
export type CostSource = { label: string; url: string; checkedAt: string };

// --- Sauvegarde & résilience (backup, spec n°1 §3, types S-026, consommés S-028→S-031) ---

export type BackupCriticality = "none" | "standard" | "high" | "critical";
export type BackupStorageTier = "hot" | "cold"; // chaud (objet) / froid (archive)
export type ErasurePolicy = "crypto-shred" | "expiration";
/** Arbitrage vecteurs : `auto` = le moteur tranche au moindre coût ; sinon forcé. */
export type VectorBackupStrategy = "auto" | "backup" | "reembed";

/**
 * Entrée de sauvegarde (hybride palier + expert). `criticality` (chemin 90 s) dérive tout le reste ;
 * les champs optionnels permettent l'affinage expert (sinon dérivés du palier, cf. backup.ts §4).
 */
export type Backup = {
  criticality: BackupCriticality;
  rpoMinutes?: number; // perte de données max tolérée
  rtoMinutes?: number; // temps de reprise max
  retentionDays?: number; // rétention récurrente (GFS simplifié)
  copies?: number; // 3-2-1 : nombre de copies
  offsite?: boolean; // 1 copie hors-site
  airgap?: boolean; // +1 copie hors-ligne / air-gap (ransomware)
  immutable?: boolean; // WORM / object-lock
  tier?: BackupStorageTier;
  byok?: boolean; // clés de chiffrement gérées par le client
  restoreTestsPerYear?: number; // « 0 erreur » = restaurations testées
  vectorStrategy?: VectorBackupStrategy;
  erasurePolicy?: ErasurePolicy;
};

/** Complétude 3-2-1-1-0 (3 copies, 2 supports, 1 hors-site, 1 air-gap, 0 erreur testée). */
export type ThreeTwoOne = {
  copies: number;
  mediaTypes: number;
  offsite: boolean;
  airgap: boolean;
  tested: boolean;
};

/** Arbitrage « sauvegarder vs ré-embed » les vecteurs (reconstructibles depuis la source). */
export type VectorDecision = {
  strategy: "backup" | "reembed";
  backupMonthlyCost: number; // coût récurrent si on sauvegarde les vecteurs
  reembedCost: number; // coût one-time (à la restauration) si on ré-embed
  reason: string;
};

/** Plan de sauvegarde déduit (ajouté à `Recommendation`). `criticality "none"` → plan neutre, coûts 0. */
export type BackupPlan = {
  criticality: BackupCriticality;
  rpoMinutes: number;
  rtoMinutes: number;
  retentionDays: number;
  legalRetentionYears: number; // = max(régimes), §6, plancher légal
  copies: number;
  offsite: boolean;
  airgap: boolean;
  immutable: boolean;
  tier: BackupStorageTier;
  byok: boolean;
  pitr: boolean; // WAL/PITR Postgres (criticité ≥ high)
  erasurePolicy: ErasurePolicy;
  restoreTestsPerYear: number;
  backupStorageGb: number; // volume de sauvegarde dimensionné
  vector: VectorDecision;
  threeTwoOne: ThreeTwoOne;
  monthlyCost: number; // récurrent €/mois
  setupCost: number; // one-time : premier full du corpus existant
  costSources: CostSource[]; // DÉFCON 1
};

/**
 * Clés des 9 dimensions de scoring (ordre stable). `resilience` (9ᵉ) ajoutée en S-027 (refonte 8→9) :
 * pilotée par le `BackupPlan` (criticité, 3-2-1-1-0, restauration testée, immutabilité, érasure).
 */
export const SCORE_KEYS = ["conf", "audit", "stress", "sov", "adapt", "ttv", "mm", "cost", "resilience"] as const;
export type ScoreKey = (typeof SCORE_KEYS)[number];

export type Profile = {
  activity: Activity;
  zone: Zone;
  users: number;
  contentTypes: ContentType[];
  volume: Volume;
  growth: Growth;
  regulations: Regulation[];
  sensitivity: Sensitivity;
  audit: boolean;
  bitemporal: boolean;
  techLevel: TechLevel;
  budget: Budget;
  reqPerDay: ReqPerDay;
  latency: Latency;
  voices: Voices;
  /** Niveau d'intensité par module (0 = désactivé, jusqu'à maxLevel). */
  modules: Record<ModuleId, number>;
  /** Besoins multimédias détaillés (refonte Strate, consommés en S-016). */
  mediaNeeds?: MediaNeed[];
  /** Sauvegarde & résilience (spec n°1, consommé en S-026/S-028). Absent ⇒ criticité `none`. */
  backup?: Backup;
  /** Notes libres par bloc du wizard (refonte 4-blocs, S-019). */
  freeNotes?: Partial<Record<BlockId, string>>;
};

export type ModuleLevel = { label: string; desc: string };

export type EngineModule = {
  id: ModuleId;
  name: string;
  why: string;
  layers: string;
  effort: "S" | "M" | "L";
  costFull: number;
  maxLevel: number;
  bonusFull: Partial<Record<ScoreKey, number>>;
  levels: ModuleLevel[];
  baseTask: string;
};

export type ActiveModule = {
  id: ModuleId;
  name: string;
  level: number;
  maxLevel: number;
  levelLabel: string;
  levelDesc: string;
  fraction: number;
  cost: number;
  task: string;
  bonusFull: Partial<Record<ScoreKey, number>>;
};

export type Layer = {
  id: number;
  name: string;
  color: string;
  choice: string;
  cost: number;
  note: string;
  alternatives: string;
};

export type ScoreDimension = {
  key: ScoreKey;
  label: string;
  score: number;
  why: string;
};

export type KMCheck = {
  cause: string;
  coverage: string;
  ok: boolean;
  warn: boolean;
};

export type Recommendation = {
  preset: Preset;
  presetReason: string;
  layers: Layer[];
  baseCost: number;
  moduleCost: number;
  totalCost: number;
  scores: ScoreDimension[];
  scoreAvg: number;
  activeModules: ActiveModule[];
  compliance: string[];
  risks: string[];
  kmChecks: KMCheck[];
  /** Dimensionnement multimédia déduit des besoins (refonte Strate, S-018). */
  sizing: Sizing;
  /** Coût ponctuel de mise en route (ingestion du backlog existant), distinct du récurrent. */
  setupCost: number;
  /** Sources des coûts multimédias effectivement utilisés (URL + date), dédupliquées (DÉFCON 1). */
  costSources: CostSource[];
  /** Synthèse « verdict » pour le chemin 90 s (douleur/risque/gain/prix ferme/coûts/next step). */
  verdict: Verdict;
};
