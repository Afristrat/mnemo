import { describe, it, expect } from "vitest";
import { computeScores, type MediaNeed, type Profile } from "@/lib/engine";

// S-015, garde de validation des types migrés (au-delà du typecheck) :
// audit/bitemporal booléens lisibles par le moteur, et nouveaux champs optionnels valides.

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    activity: "freelance",
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

describe("S-015, types migrés (booléens + nouveaux champs)", () => {
  it("computeScores lit audit/bitemporal booléens (dimension audit pilotée par bitemporal)", () => {
    const dims = computeScores("MEDIUM", makeProfile({ audit: true, bitemporal: false }), 100);
    expect(dims.find((d) => d.key === "audit")?.score).toBe(5); // bitemporal=false → base 5
    expect(dims.find((d) => d.key === "conf")?.score ?? 0).toBeGreaterThan(0);
  });

  it("la dimension audit monte à 10 quand bitemporal=true hors LIGHT", () => {
    const dims = computeScores("MEDIUM", makeProfile({ bitemporal: true }), 100);
    expect(dims.find((d) => d.key === "audit")?.score).toBe(10);
  });

  it("Profile reste valide avec mediaNeeds vide et freeNotes partiel", () => {
    const p = makeProfile({ mediaNeeds: [], freeNotes: { profil: "note libre" } });
    expect(p.mediaNeeds).toHaveLength(0);
    expect(p.freeNotes?.profil).toBe("note libre");
    expect(() => computeScores("LIGHT", p, 50)).not.toThrow();
  });

  it("MediaNeed couvre les deux volets (mémoriser + créer)", () => {
    const need: MediaNeed = {
      modality: "video",
      mode: "sovereign",
      ingest: { tier: "medium", volume: 10 },
      generate: { tier: "none" },
    };
    const p = makeProfile({ mediaNeeds: [need] });
    expect(p.mediaNeeds?.[0]?.ingest.tier).toBe("medium");
    expect(p.mediaNeeds?.[0]?.generate.tier).toBe("none");
  });
});
