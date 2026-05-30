import { describe, it, expect } from "vitest";
import type { Sizing, WorkloadLine } from "@/lib/engine";
import { evaluateBudget } from "@/lib/wizard/budget";

function sizing(gpu: number, apiCosts: number[], storageGb = 0): Sizing {
  const workloads: WorkloadLine[] = apiCosts.map((c) => ({
    source: "generate",
    modality: "video",
    mode: "api",
    estimate: { id: "test" },
    monthlyCost: c,
    contributesTo: ["C5", "C6"],
  }));
  return {
    gpu: { tier: gpu > 0 ? "dedicated-large" : "none", monthlyCost: gpu },
    storageGb,
    embeddingsMultimodal: gpu > 0 || apiCosts.length > 0,
    workloads,
  };
}

describe("evaluateBudget", () => {
  it("vert quand le coût est ≤ 80 % du plafond", () => {
    expect(evaluateBudget(100, "500to2k", sizing(0, [])).status).toBe("ok");
  });

  it("jaune entre 80 % et 100 % du plafond", () => {
    expect(evaluateBudget(180, "50to200", sizing(0, [])).status).toBe("warn"); // 180/200 = 0,9
  });

  it("rouge au-delà du plafond", () => {
    expect(evaluateBudget(2100, "500to2k", sizing(1993, [30])).status).toBe("over");
  });

  it("dépassement piloté par le GPU → cause GPU + levier API", () => {
    const e = evaluateBudget(2100, "500to2k", sizing(1993, [30]));
    expect(e.cause).toMatch(/GPU/);
    expect(e.lever).toMatch(/API/);
  });

  it("dépassement piloté par les API médias → cause API", () => {
    const e = evaluateBudget(900, "200to500", sizing(0, [500]));
    expect(e.cause).toMatch(/API/);
  });

  it("sans média, la cause est la stack de base", () => {
    const e = evaluateBudget(300, "50to200", sizing(0, []));
    expect(e.cause).toMatch(/stack de base/);
  });

  it("gt2k n'a pas de plafond pratique (toujours vert)", () => {
    expect(evaluateBudget(5000, "gt2k", sizing(3000, [100])).status).toBe("ok");
  });
});
