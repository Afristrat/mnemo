import { describe, it, expect } from "vitest";
import { computeHealthScore, type HealthInput } from "@/lib/monitoring/health";
import { deriveDeviationGuide } from "@/lib/monitoring/mel";

// S-080 (F12) : Dispatch Deviation Guide (MEL). Vérifie que seules les dimensions DÉGRADÉES produisent
// un item, le verdict de dispatch (no-go sur availability/resilience/compliance critiques, sinon go-if),
// et les descripteurs i18n (jamais de prose).

function guide(input: HealthInput): ReturnType<typeof deriveDeviationGuide> {
  return deriveDeviationGuide(computeHealthScore(input));
}

describe("deriveDeviationGuide (MEL, S-080)", () => {
  it("aucune dimension dégradée → guide vide", () => {
    expect(guide({ availability: 100, resilience: 100 })).toEqual([]);
  });

  it("ne produit aucun item pour une dimension NON mesurée", () => {
    // budget seul mesuré et ok → rien ; les autres non mesurées ne génèrent pas de conduite.
    expect(guide({ budget: 95 })).toEqual([]);
  });

  it("availability critique → no-go ; budget warn → go-if", () => {
    const g = guide({ availability: 30, budget: 60 });
    const byDim = Object.fromEntries(g.map((i) => [i.dimension, i]));
    expect(byDim.availability.status).toBe("critical");
    expect(byDim.availability.dispatch).toBe("no-go");
    expect(byDim.budget.status).toBe("warn");
    expect(byDim.budget.dispatch).toBe("go-if");
  });

  it("resilience & compliance critiques → no-go (perte de données / non-conformité)", () => {
    const g = guide({ resilience: 10, compliance: 20 });
    expect(g.every((i) => i.dispatch === "no-go")).toBe(true);
    expect(g.map((i) => i.dimension).sort()).toEqual(["compliance", "resilience"]);
  });

  it("budget/freshness/drift critiques restent go-if (qualité, pas vital)", () => {
    const g = guide({ budget: 10, freshness: 10, drift: 10 });
    expect(g.every((i) => i.status === "critical" && i.dispatch === "go-if")).toBe(true);
  });

  it("warn n'est jamais no-go (même sur une dimension vitale)", () => {
    const g = guide({ availability: 60 }); // 60 → warn
    expect(g[0].dispatch).toBe("go-if");
  });

  it("chaque item porte des descripteurs i18n (guidance/corrective/dispatch), jamais de prose", () => {
    const g = guide({ resilience: 40 });
    const item = g[0];
    expect(item.guidance.id).toBe("monitoring.mel.guidance.resilience");
    expect(item.corrective.id).toBe("monitoring.mel.corrective.resilience");
    expect(item.dispatchLabel.id).toBe("monitoring.mel.dispatch");
    expect(item.dispatchLabel.values?.dispatch).toBe("no-go");
  });
});
