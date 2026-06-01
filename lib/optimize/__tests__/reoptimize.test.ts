import { describe, it, expect } from "vitest";
import { proposeReoptimization, type OptimizationCandidate } from "@/lib/optimize/reoptimize";

// S-086 (Lot 3 F15) : re-optimisation = PROPOSITION iso-contraintes, gain > seuil, validation humaine.
// DÉFCON 1 : jamais un candidat qui viole la souveraineté exigée (S-072).

const SOV: OptimizationCandidate = { label: "OVH", monthlyCost: 70, sovereign: true };
const HYPER: OptimizationCandidate = { label: "AWS", monthlyCost: 50, sovereign: false };

describe("proposeReoptimization (S-086)", () => {
  it("propose le moins cher éligible si l'économie dépasse le seuil", () => {
    const p = proposeReoptimization(100, [SOV, HYPER], { requireSovereign: false }, 10);
    expect(p).not.toBeNull();
    expect(p?.candidate.label).toBe("AWS"); // 50 < 70
    expect(p?.savingPct).toBe(50);
    expect(p?.requiresHumanValidation).toBe(true);
  });

  it("souveraineté exigée → EXCLUT l'hyperscaler même moins cher (DÉFCON 1, S-072)", () => {
    const p = proposeReoptimization(100, [SOV, HYPER], { requireSovereign: true }, 10);
    expect(p?.candidate.label).toBe("OVH"); // l'AWS moins cher est écarté
    expect(p?.savingPct).toBe(30);
  });

  it("économie sous le seuil → aucune proposition (migrer ne vaut pas le coût)", () => {
    const p = proposeReoptimization(100, [{ label: "X", monthlyCost: 95, sovereign: true }], { requireSovereign: true }, 10);
    expect(p).toBeNull();
  });

  it("aucun candidat moins cher → null", () => {
    const p = proposeReoptimization(50, [SOV], { requireSovereign: false }, 10);
    expect(p).toBeNull();
  });

  it("coût actuel ≤ 0 → null (pas de base de comparaison)", () => {
    expect(proposeReoptimization(0, [SOV], { requireSovereign: false })).toBeNull();
  });
});
