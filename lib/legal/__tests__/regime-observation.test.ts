import { describe, it, expect } from "vitest";
import { buildRegimeObservations } from "@/lib/legal/regime-observation";
import type { RegimeSuggestion } from "@/lib/legal/regime-seed";

// S-077 tranche 3 : builder PUR des lignes d'audit `regime_observations` (une par régime sourcé).

function regime(over: Partial<RegimeSuggestion> = {}): RegimeSuggestion {
  return {
    code: "rgpd",
    name: "RGPD",
    scope: "data-protection",
    country: "union-europeenne",
    confidence: "high",
    provenance: "live",
    source: { label: "EUR-Lex", url: "https://eur-lex.europa.eu/eli/reg/2016/679/oj", checkedAt: "2026-06-01" },
    ...over,
  };
}

describe("buildRegimeObservations", () => {
  it("mappe chaque régime sur une ligne d'audit (code, pays, source datée)", () => {
    const rows = buildRegimeObservations({ regimes: [regime()], circleId: "c1", createdBy: "u1" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      circle_id: "c1",
      created_by: "u1",
      country: "union-europeenne",
      regime_code: "rgpd",
      regime_name: "RGPD",
      scope: "data-protection",
      provenance: "live",
      confidence: "high",
      source_url: "https://eur-lex.europa.eu/eli/reg/2016/679/oj",
      checked_at: "2026-06-01",
    });
  });

  it("régime libre (code null) → regime_code null ; anonyme → circle/createdBy null", () => {
    const rows = buildRegimeObservations({ regimes: [regime({ code: null, name: "LGPD", country: "bresil" })] });
    expect(rows[0].regime_code).toBeNull();
    expect(rows[0].circle_id).toBeNull();
    expect(rows[0].created_by).toBeNull();
  });
});
