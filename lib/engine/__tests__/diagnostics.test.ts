import { describe, it, expect } from "vitest";
import { computeCompliance, type Profile, type Regulation } from "@/lib/engine";

// S-077 (T5) : régimes phares hors-UE modélisés dans computeCompliance avec actions de conformité
// sourcées (LGPD/Brésil — articles ANPD/Planalto ; APPI/Japon — obligations PPC). Le moteur reste pur :
// computeCompliance renvoie des descripteurs `Message` (clés `diagnostics.compliance.*`), jamais de prose.

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
    regulations: ["none"],
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

function ids(regulations: Regulation[]): string[] {
  return computeCompliance(prof({ regulations })).map((m) => m.id);
}

describe("computeCompliance — régimes modélisés (S-077, T5)", () => {
  it("LGPD (Brésil) déclenche les 6 actions sourcées", () => {
    expect(ids(["lgpd"])).toEqual([
      "diagnostics.compliance.lgpdDpo",
      "diagnostics.compliance.lgpdRights",
      "diagnostics.compliance.lgpdRecords",
      "diagnostics.compliance.lgpdRipd",
      "diagnostics.compliance.lgpdTransfer",
      "diagnostics.compliance.lgpdIncident",
    ]);
  });

  it("APPI (Japon) déclenche les 6 obligations sourcées", () => {
    expect(ids(["appi"])).toEqual([
      "diagnostics.compliance.appiPurpose",
      "diagnostics.compliance.appiSecurity",
      "diagnostics.compliance.appiThirdParty",
      "diagnostics.compliance.appiRights",
      "diagnostics.compliance.appiIncident",
      "diagnostics.compliance.appiCrossBorder",
    ]);
  });

  it("cumule les régimes cochés (RGPD + LGPD)", () => {
    const got = ids(["rgpd", "lgpd"]);
    expect(got).toContain("diagnostics.compliance.rgpdAipd");
    expect(got).toContain("diagnostics.compliance.lgpdDpo");
  });

  it("« Aucun » ne déclenche aucune action de conformité", () => {
    expect(ids(["none"])).toEqual([]);
  });

  it("ne renvoie que des descripteurs Message (jamais de prose)", () => {
    for (const m of computeCompliance(prof({ regulations: ["lgpd", "appi"] }))) {
      expect(m.id.startsWith("diagnostics.compliance.")).toBe(true);
    }
  });
});
