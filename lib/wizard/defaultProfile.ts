import { defaultModuleLevels, type Profile } from "@/lib/engine";

export const STORAGE_KEY = "mnemo:profile:v1";

export const DEFAULT_PROFILE: Profile = {
  activity: "freelance",
  zone: "ue",
  users: 1,
  contentTypes: ["text"],
  volume: "1to10",
  growth: "medium",
  regulations: ["rgpd"],
  sensitivity: "confidential",
  audit: "desired",
  bitemporal: "desired",
  techLevel: "hybrid",
  budget: "50to200",
  reqPerDay: "lt100",
  latency: "fast",
  voices: "solo",
  modules: defaultModuleLevels(),
};
