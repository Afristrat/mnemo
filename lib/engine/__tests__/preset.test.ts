import { describe, it, expect } from "vitest";
import { decidePreset, type Profile } from "@/lib/engine";

// S-051 : preset scoré + explicable. Déclencheurs durs → HARD ; sinon score de besoin (volume
// dominant) départage LIGHT (≤ 4) / MEDIUM. Le score et les drivers sont exposés (preset « expliqué »).

function prof(over: Partial<Profile> = {}): Profile {
  return {
    activity: "freelance",
    continent: "europe",
    country: "union-europeenne",
    zone: "ue",
    users: 1,
    contentTypes: ["text"],
    volume: "lt1",
    growth: "low",
    regulations: ["rgpd"],
    sensitivity: "public",
    audit: false,
    bitemporal: false,
    techLevel: "hybrid",
    budget: "lt50",
    reqPerDay: "lt100",
    latency: "fast",
    voices: "solo",
    modules: { bisect: 0, reversal: 0, prereg: 0, mel: 0, conflict: 0 },
    ...over,
  };
}

describe("decidePreset — déclencheurs durs → HARD (S-051)", () => {
  it.each([
    ["secret", prof({ sensitivity: "secret" })],
    ["cabinet régulé", prof({ activity: "cabinet-regule" })],
    ["HIPAA", prof({ regulations: ["hipaa"] })],
    ["secret pro", prof({ regulations: ["secret-pro"] })],
    ["audit+bitemporel", prof({ audit: true, bitemporal: true })],
  ])("HARD si %s (indépendant de la charge)", (_label, p) => {
    const d = decidePreset(p);
    expect(d.preset).toBe("HARD");
    expect(d.reason.drivers.length).toBeGreaterThan(0); // le déclencheur est explicité
  });
});

describe("decidePreset — score de besoin LIGHT/MEDIUM (S-051)", () => {
  it("volume = séparateur principal : < 1 Go → LIGHT, ≥ 1–10 Go → MEDIUM (toutes choses égales)", () => {
    expect(decidePreset(prof({ volume: "lt1" })).preset).toBe("LIGHT");
    expect(decidePreset(prof({ volume: "1to10" })).preset).toBe("MEDIUM");
  });

  it("score monotone croissant avec le volume", () => {
    const tiny = decidePreset(prof({ volume: "lt1" })).score;
    const mid = decidePreset(prof({ volume: "10to100" })).score;
    const big = decidePreset(prof({ volume: "gt1000" })).score;
    expect(mid).toBeGreaterThan(tiny);
    expect(big).toBeGreaterThan(mid);
  });

  it("un usage personnel minuscule reste LIGHT même avec croissance forte", () => {
    expect(decidePreset(prof({ volume: "lt1", growth: "high" })).preset).toBe("LIGHT");
  });

  it("la sensibilité interne (organisation) pousse vers MEDIUM dès un petit corpus", () => {
    // volume 1to10 + interne : au-dessus du seuil → MEDIUM
    expect(decidePreset(prof({ sensitivity: "internal", volume: "1to10" })).preset).toBe("MEDIUM");
  });

  it("preset « expliqué » : la raison porte le gabarit, le score et le seuil (descripteurs i18n)", () => {
    const light = decidePreset(prof({ volume: "lt1" }));
    expect(light.reason.template.id).toBe("preset.reasonLight");
    expect(light.reason.template.values?.score).toBe(light.score);
    expect(light.reason.template.values?.max).toBe(3);
    const medium = decidePreset(prof({ volume: "10to100" }));
    expect(medium.reason.template.id).toBe("preset.reasonMedium");
    expect(medium.reason.template.values?.max).toBe(3);
    expect(medium.score).toBeGreaterThan(3);
  });
});

describe("decidePreset — préférence souveraineté (S-066)", () => {
  it("relève le preset d'un cran : LIGHT → MEDIUM", () => {
    expect(decidePreset(prof({ volume: "lt1" })).preset).toBe("LIGHT");
    expect(decidePreset(prof({ volume: "lt1", preferSovereign: true })).preset).toBe("MEDIUM");
  });

  it("relève le preset d'un cran : MEDIUM → HARD", () => {
    expect(decidePreset(prof({ volume: "10to100" })).preset).toBe("MEDIUM");
    expect(decidePreset(prof({ volume: "10to100", preferSovereign: true })).preset).toBe("HARD");
  });

  it("HARD reste HARD (jamais au-delà) + raison explicite", () => {
    const d = decidePreset(prof({ sensitivity: "secret", preferSovereign: true }));
    expect(d.preset).toBe("HARD");
    const bumped = decidePreset(prof({ volume: "lt1", preferSovereign: true }));
    expect(bumped.reason.suffix?.id).toBe("preset.reasonSovereignBump");
    expect(bumped.reason.suffix?.values?.bumped).toBe("MEDIUM");
  });

  it("invariant : sans préférence, le preset est inchangé", () => {
    expect(decidePreset(prof({ volume: "lt1" })).preset).toBe("LIGHT");
    expect(decidePreset(prof({ volume: "lt1", preferSovereign: false })).preset).toBe("LIGHT");
  });
});
