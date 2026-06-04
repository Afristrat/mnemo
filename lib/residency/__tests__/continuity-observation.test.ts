import { describe, expect, it } from "vitest";
import { buildContinuityObservation } from "../continuity-observation";
import type { ResidencyContinuityReport } from "../continuity";

const report: ResidencyContinuityReport = {
  generatedAt: "2026-06-04T00:00:00.000Z",
  primaryRegion: "eu",
  components: [
    { id: "data-primary", label: { id: "x" }, region: "eu", flag: "in-zone" },
    { id: "replica-us", label: { id: "y" }, region: "us", flag: "restricted", legalBasis: "RGPD chap. V" },
  ],
  outOfZoneCount: 1,
  unverifiedCount: 1,
  disclaimer: "d",
};

describe("buildContinuityObservation", () => {
  it("mappe le rapport + le hash vers la ligne DB (circle anonyme par défaut)", () => {
    const row = buildContinuityObservation({ report, integrityHash: "h".repeat(64) });
    expect(row.primary_region).toBe("eu");
    expect(row.out_of_zone_count).toBe(1);
    expect(row.unverified_count).toBe(1);
    expect(row.integrity_hash).toBe("h".repeat(64));
    expect(row.observed_at).toBe(report.generatedAt);
    expect(row.circle_id).toBeNull();
    expect(Array.isArray(row.components)).toBe(true);
    expect(row.components[1]).toEqual({ id: "replica-us", region: "us", flag: "restricted", legalBasis: "RGPD chap. V" });
  });

  it("normalise une base légale absente en null", () => {
    const row = buildContinuityObservation({ report, integrityHash: "h".repeat(64) });
    expect(row.components[0].legalBasis).toBeNull();
  });
});
