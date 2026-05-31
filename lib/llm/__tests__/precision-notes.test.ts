import { describe, it, expect } from "vitest";
import type { Profile } from "@/lib/engine";
import { buildOtherPrecisionNotes } from "@/lib/llm/precision-notes";

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

describe("buildOtherPrecisionNotes (S-064, contexte LLM)", () => {
  it("aucune précision « Autre » → aucune note", () => {
    expect(buildOtherPrecisionNotes(prof())).toEqual([]);
  });

  it("intègre la précision activité quand activity = other + texte saisi", () => {
    const notes = buildOtherPrecisionNotes(prof({ activity: "other", otherText: { activity: "Coopérative agricole" } }));
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain("Coopérative agricole");
  });

  it("ignore le texte résiduel quand la valeur n'est pas other", () => {
    const notes = buildOtherPrecisionNotes(prof({ activity: "pme-startup", otherText: { activity: "résiduel" } }));
    expect(notes).toEqual([]);
  });

  it("intègre zone et région « Autre » (residency.primaryRegion = other)", () => {
    const notes = buildOtherPrecisionNotes(
      prof({
        zone: "other",
        otherText: { zone: "Suisse", region: "Genève" },
        residency: { primaryRegion: "other", allowedRegions: [] },
      }),
    );
    expect(notes.some((n) => n.includes("Suisse"))).toBe(true);
    expect(notes.some((n) => n.includes("Genève"))).toBe(true);
  });
});
