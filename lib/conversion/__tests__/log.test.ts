import { describe, it, expect } from "vitest";
import { recommend, type Profile } from "@/lib/engine";
import { buildLead, buildLeadCapture, buildSimulationLog, isValidEmail, isValidName } from "@/lib/conversion/log";

function baseProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    activity: "pme-startup",
    continent: "europe",
    country: "union-europeenne",
    zone: "ue",
    users: 1,
    contentTypes: ["text"],
    volume: "1to10",
    growth: "medium",
    regulations: ["rgpd"],
    sensitivity: "internal",
    audit: false,
    bitemporal: false,
    techLevel: "hybrid",
    budget: "50to200",
    reqPerDay: "lt100",
    latency: "fast",
    voices: "solo",
    modules: { bisect: 0, reversal: 0, prereg: 0, mel: 0, conflict: 0 },
    ...overrides,
  };
}

describe("buildSimulationLog", () => {
  it("résume la recommandation et reste anonyme par défaut", () => {
    const profile = baseProfile();
    const rec = recommend(profile);
    const row = buildSimulationLog({ profile, recommendation: rec });
    expect(row.circle_id).toBeNull();
    expect(row.created_by).toBeNull();
    expect(row.preset).toBe(rec.preset);
    expect(row.total_cost).toBe(rec.totalCost);
    expect(row.setup_cost).toBe(rec.setupCost);
    expect(row.verdict).toBe(rec.verdict);
    expect(row.profile).toBe(profile);
  });

  it("rattache au cercle/auteur quand fournis (utilisateur authentifié)", () => {
    const rec = recommend(baseProfile());
    const row = buildSimulationLog({
      profile: baseProfile(),
      recommendation: rec,
      circleId: "circle-1",
      createdBy: "user-1",
    });
    expect(row.circle_id).toBe("circle-1");
    expect(row.created_by).toBe("user-1");
  });
});

describe("buildLeadCapture", () => {
  it("normalise l'e-mail (trim + minuscules) et défaut contexte exit_intent", () => {
    const row = buildLeadCapture({ email: "  Amine@Example.COM " });
    expect(row.email).toBe("amine@example.com");
    expect(row.context).toBe("exit_intent");
    expect(row.simulation_id).toBeNull();
    expect(row.circle_id).toBeNull();
  });

  it("relie la simulation et accepte un contexte explicite", () => {
    const row = buildLeadCapture({ email: "a@b.co", simulationId: "sim-1", context: "report" });
    expect(row.simulation_id).toBe("sim-1");
    expect(row.context).toBe("report");
  });
});

describe("isValidName", () => {
  it("accepte un nom plausible et rejette le trop court", () => {
    expect(isValidName("Amine")).toBe(true);
    expect(isValidName("  Jo ")).toBe(true);
    expect(isValidName("A")).toBe(false);
    expect(isValidName(" ")).toBe(false);
    expect(isValidName("x".repeat(121))).toBe(false);
  });
});

describe("buildLead", () => {
  it("normalise nom (trim) + e-mail (trim + minuscules) et reste anonyme par défaut", () => {
    const row = buildLead({ name: "  Amine  ", email: "  Amine@Example.COM " });
    expect(row.name).toBe("Amine");
    expect(row.email).toBe("amine@example.com");
    expect(row.preset).toBeNull();
    expect(row.circle_id).toBeNull();
    expect(row.created_by).toBeNull();
  });

  it("joint le preset et l'auteur quand fournis", () => {
    const row = buildLead({ name: "Jo", email: "jo@b.co", preset: "HARD", createdBy: "user-1" });
    expect(row.preset).toBe("HARD");
    expect(row.created_by).toBe("user-1");
  });
});

describe("isValidEmail", () => {
  it("accepte une forme plausible et rejette l'invalide", () => {
    expect(isValidEmail("amine@example.com")).toBe(true);
    expect(isValidEmail("  a@b.co ")).toBe(true);
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});
