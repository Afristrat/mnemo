import { describe, expect, it } from "vitest";
import { computeExitCost } from "../meter";
import { recommend, type Profile } from "@/lib/engine";
import { getResidencyPrices } from "@/lib/pricing/residency-seed";

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    activity: "pme-startup",
    continent: "europe",
    country: "union-europeenne",
    zone: "ue",
    users: 5,
    contentTypes: ["text", "audio"],
    volume: "10to100",
    growth: "high",
    regulations: ["rgpd"],
    sensitivity: "confidential",
    audit: true,
    bitemporal: true,
    techLevel: "devops",
    budget: "200to500",
    reqPerDay: "lt1k",
    latency: "fast",
    voices: "multi",
    modules: { bisect: 1, reversal: 2, prereg: 0, mel: 3, conflict: 2 },
    ...overrides,
  };
}

describe("computeExitCost", () => {
  it("chiffre l'egress de sortie = storageGb × egressPerGb, source datée portée", () => {
    const p = profile();
    const reco = recommend(p);
    const cost = computeExitCost(reco, p, getResidencyPrices());
    expect(cost.storageGb).toBe(reco.sizing.storageGb);
    expect(cost.exitEgressCost).toBe(Math.round(cost.storageGb * cost.egressPerGb));
    expect(cost.monthlyCost).toBe(reco.totalCost);
    // egress sourcé → flag true + source datée présente
    if (cost.egressSourced) {
      expect(cost.egressSource).not.toBeNull();
      expect(cost.egressSource?.checkedAt).toBeTruthy();
    }
  });

  it("ne fabrique jamais les frais d'API ni l'engagement", () => {
    const p = profile();
    const cost = computeExitCost(recommend(p), p, getResidencyPrices());
    expect(cost.apiFees).toBe("unknown");
    expect(cost.minCommitment).toBe("unknown");
  });

  it("calcule l'équivalent en mois de service (cohérent avec le coût mensuel)", () => {
    const p = profile();
    const reco = recommend(p);
    const cost = computeExitCost(reco, p, getResidencyPrices());
    if (cost.monthlyCost > 0) {
      expect(cost.monthsEquivalent).toBe(Math.round((cost.exitEgressCost / cost.monthlyCost) * 10) / 10);
    } else {
      expect(cost.monthsEquivalent).toBeNull();
    }
  });

  it("est pure et déterministe", () => {
    const p = profile();
    const reco = recommend(p);
    expect(computeExitCost(reco, p, getResidencyPrices())).toEqual(computeExitCost(reco, p, getResidencyPrices()));
  });
});
