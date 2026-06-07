import { describe, expect, it } from "vitest";
import { buildDriftEvidence } from "../evidence";
import type { DriftReport } from "../reconcile";

const report: DriftReport = {
  generatedAt: "2026-06-07T00:00:00.000Z",
  items: [
    { id: 3, label: "Base vectorielle", expected: "Qdrant", actual: "Qdrant", status: "aligned" },
    { id: 1, label: "LLM", expected: "Anthropic", actual: "OpenAI", status: "drifted" },
  ],
  alignedCount: 1,
  driftCount: 1,
  constraintViolations: ["Région « us » hors de l'ensemble signé (eu)."],
  inSync: false,
  disclaimer: "réconciliation déclarée",
};

describe("buildDriftEvidence", () => {
  it("produit un hash stable et re-vérifiable", async () => {
    const a = await buildDriftEvidence(report);
    const b = await buildDriftEvidence(report);
    expect(a.integrityHash).toBe(b.integrityHash);
    expect(a.integrityHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("le markdown contient les items, la dérive, la violation et le disclaimer", async () => {
    const { markdown } = await buildDriftEvidence(report);
    expect(markdown).toMatch(/OpenAI/);
    expect(markdown).toMatch(/Anthropic/);
    expect(markdown).toMatch(/us/);
    expect(markdown).toMatch(/réconciliation déclarée/);
  });
});
