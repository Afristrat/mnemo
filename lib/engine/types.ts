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
export type Requirement = "no" | "desired" | "required";
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
  audit: Requirement;
  bitemporal: Requirement;
  techLevel: TechLevel;
  budget: Budget;
  reqPerDay: ReqPerDay;
  latency: Latency;
  voices: Voices;
  /** Niveau d'intensité par module (0 = désactivé, jusqu'à maxLevel). */
  modules: Record<ModuleId, number>;
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
