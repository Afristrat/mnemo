import { describe, it, expect } from "vitest";
import { recommend, type Profile } from "@/lib/engine";

// S-049, garde anti-dette : growth et latency étaient collectés (Wizard) + affichés (livrable) mais
// JAMAIS calculés. Ces tests prouvent qu'ils influencent désormais la sortie de `recommend`
// (dimensionnement compute + diagnostics). Le compte d'instances reflète le choix même à prix neutres.

function prof(over: Partial<Profile> = {}): Profile {
  return {
    activity: "pme-startup",
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

describe("growth + latency intégrés au moteur (S-049)", () => {
  it("growth pilote la réserve de capacité compute (high > low)", () => {
    const low = recommend(prof({ growth: "low" })).compute.instances[0]?.count ?? 0;
    const high = recommend(prof({ growth: "high" })).compute.instances[0]?.count ?? 0;
    expect(high).toBeGreaterThan(low);
  });

  it("latency pousse le palier compute SOUS CHARGE (fast > relaxed), neutre sur petit profil", () => {
    // Sous charge : latence faible exige de la marge.
    const loadRelaxed = recommend(prof({ volume: "gt1000", latency: "relaxed" })).compute.instances[0]?.count ?? 0;
    const loadFast = recommend(prof({ volume: "gt1000", latency: "fast" })).compute.instances[0]?.count ?? 0;
    expect(loadFast).toBeGreaterThan(loadRelaxed);
    // Petit profil : pas d'inflation (la latence seule ne change rien).
    const smallRelaxed = recommend(prof({ latency: "relaxed" })).compute.instances[0]?.count ?? 0;
    const smallFast = recommend(prof({ latency: "fast" })).compute.instances[0]?.count ?? 0;
    expect(smallFast).toBe(smallRelaxed);
  });

  it("latency=fast incohérente avec LIGHT → risque signalé", () => {
    const r = recommend(
      prof({ sensitivity: "public", users: 1, budget: "lt50", volume: "lt1", growth: "low", latency: "fast" }),
    );
    expect(r.preset).toBe("LIGHT");
    expect(r.risks.some((x) => x.id === "diagnostics.risks.latencyLight")).toBe(true);
  });

  it("growth=high incohérente avec LIGHT → risque signalé", () => {
    const r = recommend(
      prof({ sensitivity: "public", users: 1, budget: "lt50", volume: "lt1", latency: "relaxed", growth: "high" }),
    );
    expect(r.preset).toBe("LIGHT");
    expect(r.risks.some((x) => x.id === "diagnostics.risks.growthLight")).toBe(true);
  });
});
