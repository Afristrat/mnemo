// Moteur de recommandation Mnémo — point d'entrée public.
export * from "./types";
export { MODULES, defaultModuleLevels } from "./modules";
export { PRESET_PROFILES, type PresetProfile } from "./presets";
export { decidePreset, type PresetDecision } from "./preset";
export { buildLayers } from "./layers";
export { layersBaseCost, profileCostFactors, costBand } from "./cost";
export { computeScores } from "./scores";
export { computeCompliance, computeRisks, computeKMChecks } from "./diagnostics";
export { recommend } from "./recommend";
