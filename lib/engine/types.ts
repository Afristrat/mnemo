// Types du moteur de recommandation Mnémo.
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
 * est INACTIVE et ne contribue pas au `Sizing` — le consommateur doit la filtrer. `volume` (optionnel) override le palier.
 */
export type MediaNeed = {
  modality: Modality;
  mode: MMMode;
  ingest: { tier: MMTier; volume?: number }; // volet « mémoriser »
  generate: { tier: MMTier; volume?: number }; // volet « créer » (tier "none" = pas de génération)
};
/** Palier du pool GPU souverain (C6), dimensionné par la charge TOTALE (ingest + generate). Granularité provisoire — à valider/affiner en S-016 avant tout consommateur en aval (cf. ADR-009). */
export type GpuTier = "none" | "shared" | "dedicated-small" | "dedicated-large";
export type WorkloadLine = {
  source: "ingest" | "generate";
  modality: Modality;
  mode: MMMode;
  estimate: string;
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

/** Clés des 8 dimensions de scoring (ordre stable). */
export const SCORE_KEYS = ["conf", "audit", "stress", "sov", "adapt", "ttv", "mm", "cost"] as const;
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
};
