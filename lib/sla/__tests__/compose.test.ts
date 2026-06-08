import { describe, it, expect } from "vitest";
import { recommend, type Profile } from "@/lib/engine";
import { computeSlaAssessment, slaModeForResidency, MINUTES_PER_MONTH } from "@/lib/sla/compose";

// Vague 3 (#5) : SLA paramétrique = composition des SLA PUBLIÉS par classe d'hébergement (sourcés, datés),
// modèle honnête « plancher = IaaS » (pas de multiplication en série de couches co-localisées).

const BASE: Profile = {
  activity: "pme-startup",
  continent: "europe",
  country: "union-europeenne",
  zone: "ue",
  users: 5,
  contentTypes: ["text"],
  volume: "10to100",
  growth: "medium",
  regulations: ["rgpd"],
  sensitivity: "confidential",
  audit: false,
  bitemporal: false,
  techLevel: "hybrid",
  budget: "200to500",
  reqPerDay: "lt1k",
  latency: "acceptable",
  voices: "solo",
  modules: { bisect: 1, reversal: 1, prereg: 0, mel: 2, conflict: 1 },
};

describe("computeSlaAssessment (vague 3 #5)", () => {
  it("souverain UE : fournit le spectre OVH + Scaleway, sourcé, sans référent unique", () => {
    const a = computeSlaAssessment(BASE, recommend(BASE));
    expect(a.hostingClass).toBe("sovereign-eu");
    expect(a.selfHosted).toBe(false);
    const names = a.providers.map((p) => p.name).sort();
    expect(names).toEqual(["OVHcloud", "Scaleway"]);
    a.providers.forEach((p) => expect(p.sourceUrl).toMatch(/^https:\/\//));
    expect(a.range).not.toBeNull();
  });

  it("hyperscaler (zone US) : AWS + GCP + Azure", () => {
    const a = computeSlaAssessment({ ...BASE, zone: "us", country: "etats-unis", continent: "north-america" }, recommend({ ...BASE, zone: "us", country: "etats-unis", continent: "north-america" }));
    expect(a.hostingClass).toBe("hyperscaler");
    expect(a.providers.length).toBe(3);
  });

  it("auto-hébergé : aucun SLA tiers ; expose les IaaS managés en RÉFÉRENCE (spectre complet)", () => {
    const p: Profile = { ...BASE, residency: { selfHosted: true } };
    const a = computeSlaAssessment(p, recommend(p));
    expect(a.hostingClass).toBe("self-hosted");
    expect(a.selfHosted).toBe(true);
    expect(a.providers).toHaveLength(0);
    // référence = souverain UE + SecNumCloud + hyperscaler
    expect(a.reference.length).toBeGreaterThanOrEqual(5);
    expect(a.range).not.toBeNull();
  });

  it("traduit le % en indisponibilité/mois (99,99 % → 4,3 min sur 30 j)", () => {
    const a = computeSlaAssessment(BASE, recommend(BASE));
    const ovh = a.providers.find((p) => p.id === "ovh-pci");
    expect(ovh?.pct).toBe(99.99);
    expect(ovh?.downtimeMinutes).toBe(Math.round(MINUTES_PER_MONTH * 0.0001 * 10) / 10); // 4.3
  });

  it("liste les couches co-localisées (partagent le sort de l'infra)", () => {
    const a = computeSlaAssessment(BASE, recommend(BASE));
    expect(a.coLocatedLayers.length).toBeGreaterThan(0);
  });
});

describe("slaModeForResidency", () => {
  it("redondance active-active → mode ha", () => {
    expect(slaModeForResidency({ activeActive: true, drTier: "none" })).toBe("ha");
  });
  it("DR « hot » → mode ha", () => {
    expect(slaModeForResidency({ activeActive: false, drTier: "hot" })).toBe("ha");
  });
  it("sinon → mode single", () => {
    expect(slaModeForResidency({ activeActive: false, drTier: "warm" })).toBe("single");
  });
});
