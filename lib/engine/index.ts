// Moteur de recommandation Mnémo — point d'entrée public.
export * from "./types";
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
  deriveBackupPlan,
  costBackup,
  buildBackupPlan,
  baseBackupGb,
  legalRetentionYears,
  type BackupPriceTable,
  type BackupCore,
} from "./backup";
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
