import { describe, it, expect } from "vitest";
import type { Profile } from "@/lib/engine";
import {
  candidateViolatesConstraints,
  constraintPromptBlock,
  constraintQueryHint,
  deriveCatalogConstraints,
} from "@/lib/catalog/constraints";

function prof(over: Partial<Profile> = {}): Profile {
  return {
    activity: "pme-startup",
    continent: "europe",
    country: "union-europeenne",
    zone: "ue",
    users: 5,
    contentTypes: ["text"],
    volume: "10to100",
    growth: "medium",
    regulations: ["rgpd"],
    sensitivity: "internal",
    audit: false,
    bitemporal: false,
    techLevel: "hybrid",
    budget: "200to500",
    reqPerDay: "lt1k",
    latency: "fast",
    voices: "solo",
    modules: { bisect: 0, reversal: 0, prereg: 0, mel: 0, conflict: 0 },
    ...over,
  };
}

describe("Contraintes veille = choix utilisateur absolus (S-072)", () => {
  it("le toggle preferSovereign EXIGE la souveraineté (rejette toute API tierce)", () => {
    expect(deriveCatalogConstraints(prof({ preferSovereign: true })).requireSovereign).toBe(true);
    expect(candidateViolatesConstraints("api-third-party", prof({ preferSovereign: true }))).toBe(true);
    expect(candidateViolatesConstraints("sovereign", prof({ preferSovereign: true }))).toBe(false);
    expect(candidateViolatesConstraints("eu-hosted", prof({ preferSovereign: true }))).toBe(false);
  });

  it("secret / secret-pro / hipaa exigent la souveraineté", () => {
    expect(candidateViolatesConstraints("api-third-party", prof({ sensitivity: "secret" }))).toBe(true);
    expect(candidateViolatesConstraints("api-third-party", prof({ regulations: ["secret-pro"] }))).toBe(true);
    expect(candidateViolatesConstraints("api-third-party", prof({ regulations: ["hipaa"] }))).toBe(true);
  });

  it("RGPD + interne (sans choix explicite de souveraineté) n'interdit PAS une API tierce (transferts encadrés)", () => {
    expect(deriveCatalogConstraints(prof()).requireSovereign).toBe(false);
    expect(candidateViolatesConstraints("api-third-party", prof())).toBe(false);
  });

  it("la requête et le prompt portent les contraintes (souveraineté + zone)", () => {
    const sovProf = prof({ preferSovereign: true });
    expect(constraintQueryHint(sovProf)).toContain("self-hostable");
    expect(constraintQueryHint(prof({ zone: "ue" }))).toContain("EU-hosted");
    expect(constraintQueryHint(prof({ zone: "maroc" }))).toContain("Morocco");
    const block = constraintPromptBlock(sovProf);
    expect(block).toContain("self-hostable / sovereign");
    expect(block).toContain("reject api-third-party");
  });
});
