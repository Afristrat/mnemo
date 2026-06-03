import { describe, it, expect } from "vitest";
import { buildEnsemble } from "@/lib/engine/ensemble";
import { DEFAULT_PROFILE } from "@/lib/wizard/defaultProfile";
import { buildDecisionRecord, DECISION_RECORD_VERSION } from "@/lib/decision/record";
import { canonicalJson, sha256Hex, computeIntegrityHash } from "@/lib/decision/integrity";
import { renderDecisionRecordMarkdown } from "@/lib/decision/render";
import type { Message } from "@/lib/engine/message";

const RESOLVE = (m: Message): string => m.id; // stub déterministe : la prose = l'id du descripteur
const ENSEMBLE = buildEnsemble(DEFAULT_PROFILE);

describe("buildDecisionRecord (S-084 vague 2 #1)", () => {
  const rec = buildDecisionRecord({
    profile: DEFAULT_PROFILE,
    ensemble: ENSEMBLE,
    generatedAt: "2026-06-04T00:00:00.000Z",
    resolve: RESOLVE,
  });

  it("fige la décision retenue depuis la baseline de l'ensemble", () => {
    expect(rec.version).toBe(DECISION_RECORD_VERSION);
    expect(rec.decision.preset).toBe(ENSEMBLE.baseline.preset);
    expect(rec.decision.scoreAvg).toBe(ENSEMBLE.baseline.scoreAvg);
    expect(rec.generatedAt).toBe("2026-06-04T00:00:00.000Z");
  });

  it("encadre le coût par la fourchette ±30 %", () => {
    expect(rec.decision.costLow).toBeLessThanOrEqual(rec.decision.monthlyCost);
    expect(rec.decision.costHigh).toBeGreaterThanOrEqual(rec.decision.monthlyCost);
  });

  it("liste les alternatives écartées (les membres de l'ensemble)", () => {
    expect(rec.alternatives).toHaveLength(ENSEMBLE.variants.length);
    expect(rec.alternatives.map((a) => a.id)).toEqual(ENSEMBLE.variants.map((v) => v.id));
  });

  it("expose les tensions et un profil rejouable", () => {
    expect(rec.tensions.agreement).toBe(ENSEMBLE.spread.agreement);
    expect(rec.profileEncoded.length).toBeGreaterThan(0);
  });
});

describe("intégrité du Decision Record", () => {
  it("canonicalJson trie les clés (déterministe, ordre-indépendant)", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalJson({ a: 2, b: 1 })).toBe(canonicalJson({ b: 1, a: 2 }));
  });

  it("sha256Hex : 64 hex stables", async () => {
    const h = await sha256Hex("strate");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await sha256Hex("strate")).toBe(h);
  });

  it("le hash change avec le contenu mais ignore l'ordre des clés", async () => {
    expect(await computeIntegrityHash({ a: 1 })).not.toBe(await computeIntegrityHash({ a: 2 }));
    expect(await computeIntegrityHash({ a: 1, b: 2 })).toBe(await computeIntegrityHash({ b: 2, a: 1 }));
  });
});

describe("renderDecisionRecordMarkdown", () => {
  it("rend les sections, l'empreinte et le profil rejouable", () => {
    const rec = buildDecisionRecord({
      profile: DEFAULT_PROFILE,
      ensemble: ENSEMBLE,
      generatedAt: "2026-06-04T00:00:00.000Z",
      resolve: RESOLVE,
    });
    const md = renderDecisionRecordMarkdown(rec, "deadbeef", (k) => k); // t = identité (clé brute)
    expect(md).toContain("# docTitle");
    expect(md).toContain("sha256:deadbeef");
    expect(md).toContain("## alternativesTitle");
    expect(md).toContain(rec.profileEncoded);
  });
});
