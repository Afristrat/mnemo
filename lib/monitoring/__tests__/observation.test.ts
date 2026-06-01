import { describe, it, expect } from "vitest";
import { computeHealthScore } from "@/lib/monitoring/health";
import { buildHealthMetricRow } from "@/lib/monitoring/observation";

// S-081 : builder pur de la ligne d'audit health_metrics (jumeau des builders d'observation).

describe("buildHealthMetricRow (S-081)", () => {
  it("sérialise le rapport en ligne d'insertion (snapshot)", () => {
    const report = computeHealthScore({ availability: 90, resilience: 40, budget: 70 });
    const row = buildHealthMetricRow({ report, checkedAt: "2026-06-01", circleId: null, createdBy: null });
    expect(row.score).toBe(report.score);
    expect(row.status).toBe(report.status);
    expect(row.measured).toBe(report.measured);
    expect(row.total).toBe(6);
    expect(row.checked_at).toBe("2026-06-01");
    // subscores = forme minimale sérialisable (dimension/score/status), 6 entrées.
    expect(row.subscores).toHaveLength(6);
    for (const s of row.subscores) {
      expect(typeof s.dimension).toBe("string");
      expect(s.score === null || typeof s.score === "number").toBe(true);
    }
  });

  it("circle/created par défaut null (relevé anonyme)", () => {
    const row = buildHealthMetricRow({ report: computeHealthScore({}), checkedAt: "2026-06-01" });
    expect(row.circle_id).toBeNull();
    expect(row.created_by).toBeNull();
    expect(row.score).toBeNull(); // rien mesuré
  });
});
