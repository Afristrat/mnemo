// Moteur de recommandation Strate, point d'entrée public.
export * from "./types";
export { msg, type Message, type MessageValue, type MessageValues, type EngineResolver } from "./message";
export { MODULES, defaultModuleLevels } from "./modules";
export { PRESET_PROFILES, type PresetProfile } from "./presets";
export { decidePreset, type PresetDecision } from "./preset";
export { buildLayers } from "./layers";
export { layersBaseCost, profileCostFactors, costBand } from "./cost";
export { computeScores } from "./scores";
export {
  costMultimodalSizing,
  computeSetupCost,
  mediaCostSources,
  NEUTRAL_MEDIA_PRICES,
  type Currency,
  type MultimodalPriceTable,
  type MultimodalPriceEntry,
} from "./sizing";
export { applyMultimodalSizing } from "./cost";
export {
  deriveSizingParams,
  isValidFactor,
  BASELINE_SIZING_PARAMS,
  SIZING_FACTOR_BOUNDS,
  type SizingParams,
  type AppliedSizingParam,
  type DerivedSizingParams,
  type Volet,
} from "./sizing-params";
export {
  deriveBackupPlan,
  costBackup,
  buildBackupPlan,
  baseBackupGb,
  legalRetentionYears,
  type BackupPriceTable,
  type BackupCore,
} from "./backup";
export {
  computeSovereignCompute,
  NEUTRAL_COMPUTE_PRICES,
  type ComputeInstanceSpec,
  type ComputePriceTable,
  type ComputeInstanceLine,
  type ComputeSizing,
} from "./compute";
export {
  deriveResidencyPlan,
  deriveResidencyTopology,
  hostingClassForProfile,
  costResidency,
  costInterSiteSecurity,
  selectEgressVector,
  vectorsForClass,
  NEUTRAL_RESIDENCY_PRICES,
  type ResidencyTopology,
  type ResidencyCost,
  type EgressVector,
  type HostingClass,
  type ResidencyPriceTable,
  type InterSiteSecurityPrices,
} from "./residency";
export { computeCompliance, computeRisks, computeKMChecks } from "./diagnostics";
export { recommend } from "./recommend";
export {
  buildEnsemble,
  ENSEMBLE_VARIANT_IDS,
  type Ensemble,
  type EnsembleVariant,
  type EnsembleVariantId,
  type EnsembleSpread,
  type EnsembleAgreement,
} from "./ensemble";
