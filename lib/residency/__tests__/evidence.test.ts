import { describe, expect, it } from "vitest";
import { buildResidencyEvidence } from "../evidence";
import type { ResidencyContinuityReport } from "../continuity";

const report: ResidencyContinuityReport = {
  generatedAt: "2026-06-04T00:00:00.000Z",
  primaryRegion: "eu",
  components: [
    { id: "data-primary", label: { id: "x" }, region: "eu", flag: "in-zone" },
    { id: "replica-us", label: { id: "y" }, region: "us", flag: "restricted", legalBasis: "RGPD chap. V" },
    { id: "backup", label: { id: "z" }, region: null, flag: "unverified" },
  ],
  outOfZoneCount: 1,
  unverifiedCount: 1,
  disclaimer: "ingénierie, pas un avis juridique",
};
const resolve = (m: { id: string }): string => m.id;

describe("buildResidencyEvidence", () => {
  it("produit un hash stable et re-vérifiable", async () => {
    const a = await buildResidencyEvidence(report, resolve);
    const b = await buildResidencyEvidence(report, resolve);
    expect(a.integrityHash).toBe(b.integrityHash);
    expect(a.integrityHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("le markdown contient composants, drapeaux, base légale et disclaimer", async () => {
    const { markdown } = await buildResidencyEvidence(report, resolve);
    expect(markdown).toMatch(/us/);
    expect(markdown).toMatch(/RGPD chap\. V/);
    expect(markdown).toMatch(/ingénierie/);
  });
});
