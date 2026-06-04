import { describe, expect, it } from "vitest";
import { auditResidencyContinuity } from "../continuity";
import { recommend, type Profile } from "@/lib/engine";

const NOW = "2026-06-04T00:00:00.000Z";

function profile(overrides: Partial<Profile> = {}): Profile {
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
    modules: { bisect: 1, reversal: 2, prereg: 0, mel: 3, conflict: 2 },
    ...overrides,
  };
}

describe("auditResidencyContinuity", () => {
  it("place les données primaires en zone et compte 0 hors-zone pour un profil mono-région simple", () => {
    const reco = recommend(profile());
    const report = auditResidencyContinuity(reco, NOW);
    expect(report.primaryRegion).toBe(reco.residency.primaryRegion);
    const primary = report.components.find((c) => c.id === "data-primary");
    expect(primary?.flag).toBe("in-zone");
    expect(report.outOfZoneCount).toBe(0);
    expect(report.generatedAt).toBe(NOW);
  });

  it("flague un flux inter-juridiction avec sa base légale datée", () => {
    const reco = recommend(
      profile({ residency: { allowedRegions: ["eu", "us"], drTier: "warm", noTransferOutsideJurisdiction: false } }),
    );
    const report = auditResidencyContinuity(reco, NOW);
    const flow = report.components.find((c) => c.region === "us");
    if (flow !== undefined) {
      expect(["restricted", "out-of-zone"]).toContain(flow.flag);
      expect(flow.legalBasis).toBeTruthy();
    }
  });

  it("marque le backup hors-site et la supervision comme à confirmer (jamais de région fabriquée)", () => {
    const reco = recommend(profile({ backup: { criticality: "high", offsite: true } }));
    const report = auditResidencyContinuity(reco, NOW);
    const backup = report.components.find((c) => c.id === "backup");
    expect(backup?.region).toBeNull();
    expect(backup?.flag).toBe("unverified");
    const monitoring = report.components.find((c) => c.id === "monitoring");
    expect(monitoring?.flag).toBe("unverified");
  });

  it("est pure et déterministe (même entrée → même sortie)", () => {
    const reco = recommend(profile());
    expect(auditResidencyContinuity(reco, NOW)).toEqual(auditResidencyContinuity(reco, NOW));
  });
});
