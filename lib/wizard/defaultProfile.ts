import { defaultModuleLevels, type Profile } from "@/lib/engine";

// v2 (S-015) : audit/bitemporal sont passés de chaîne (Requirement) à booléen → bump de version
// pour invalider les profils v1 sérialisés en chaînes ("required" truthy ≠ true) et éviter une hydratation corrompue.
export const STORAGE_KEY = "mnemo:profile:v2";

export const DEFAULT_PROFILE: Profile = {
  activity: "freelance",
  zone: "ue",
  users: 1,
  contentTypes: ["text"],
  volume: "1to10",
  growth: "medium",
  regulations: ["rgpd"],
  sensitivity: "confidential",
  audit: false,
  bitemporal: false,
  techLevel: "hybrid",
  budget: "50to200",
  reqPerDay: "lt100",
  latency: "fast",
  voices: "solo",
  modules: defaultModuleLevels(),
  freeNotes: {},
};
