import { describe, it, expect } from "vitest";
import { computeRecalibration, type DeltaObservation } from "@/lib/network/recalibrate";

// S-083 (F13) : recalibration = PROPOSITION tracée, jamais auto-appliquée. Garde-fous DÉFCON 1 :
// pas d'adoption sous le seuil d'observations, ni si la dispersion est trop forte.

function obs(poste: string, deltas: number[]): DeltaObservation[] {
  return deltas.map((deltaPct) => ({ poste, deltaPct }));
}

describe("computeRecalibration (S-083)", () => {
  it("échantillon insuffisant (< minObservations) → non adoptable, confiance low", () => {
    const props = computeRecalibration(obs("A", [20, 25, 22]), { minObservations: 5 });
    expect(props).toHaveLength(1);
    expect(props[0].observations).toBe(3);
    expect(props[0].adopt).toBe(false);
    expect(props[0].confidence).toBe("low");
  });

  it("échantillon suffisant et cohérent → adoptable + facteur médian", () => {
    const props = computeRecalibration(obs("A", [20, 20, 20, 20, 20, 20]), { minObservations: 5 });
    expect(props[0].observations).toBe(6);
    expect(props[0].medianDeltaPct).toBe(20);
    expect(props[0].suggestedFactor).toBe(1.2);
    expect(props[0].adopt).toBe(true);
  });

  it("médiane robuste aux valeurs aberrantes (pas la moyenne)", () => {
    const props = computeRecalibration(obs("A", [10, 10, 10, 10, 1000]), { minObservations: 5, maxSpreadPct: 100 });
    expect(props[0].medianDeltaPct).toBe(10); // la médiane ignore l'aberration 1000
  });

  it("dispersion trop forte → non adoptable malgré un échantillon suffisant", () => {
    const props = computeRecalibration(obs("A", [-50, -30, 0, 40, 80, 120]), { minObservations: 5, maxSpreadPct: 40 });
    expect(props[0].observations).toBe(6);
    expect(props[0].adopt).toBe(false); // IQR trop large = pas de consensus
  });

  it("confiance par paliers (low <10, medium 10-29, high >=30)", () => {
    const big = (n: number): DeltaObservation[] => obs("A", new Array(n).fill(15));
    expect(computeRecalibration(big(9))[0].confidence).toBe("low");
    expect(computeRecalibration(big(10))[0].confidence).toBe("medium");
    expect(computeRecalibration(big(30))[0].confidence).toBe("high");
  });

  it("groupe par poste, ordre d'apparition stable", () => {
    const props = computeRecalibration([...obs("B", [10]), ...obs("A", [20])]);
    expect(props.map((p) => p.poste)).toEqual(["B", "A"]);
  });
});
