import { describe, expect, it } from "vitest";
import { CHECKLIST_IDS, type RestoreCertificate, verifyCertificate, sealCertificate } from "../certificate";
import { computeIntegrityHash } from "@/lib/decision/integrity";

async function stamp(cert: Omit<RestoreCertificate, "integrityHash">): Promise<RestoreCertificate> {
  const integrityHash = await computeIntegrityHash(cert);
  return { ...cert, integrityHash };
}

function baseCert(): Omit<RestoreCertificate, "integrityHash"> {
  return {
    version: 1,
    generatedAt: "2026-06-04T10:00:00.000Z",
    mode: "local",
    dataset: "real",
    checklist: CHECKLIST_IDS.map((id) => ({ id, passed: true })),
    rtoMinutes: 12,
  };
}

describe("verifyCertificate", () => {
  it("valide un certificat intègre, toutes étapes passées", async () => {
    const cert = await stamp(baseCert());
    const v = await verifyCertificate(cert);
    expect(v.valid).toBe(true);
    expect(v.integrityOk).toBe(true);
    expect(v.allPassed).toBe(true);
    expect(v.rtoMinutes).toBe(12);
    expect(v.dataset).toBe("real");
    expect(v.issues).toEqual([]);
  });

  it("détecte une altération du contenu (hash divergent)", async () => {
    const cert = await stamp(baseCert());
    const tampered = { ...cert, rtoMinutes: 1 };
    const v = await verifyCertificate(tampered);
    expect(v.integrityOk).toBe(false);
    expect(v.valid).toBe(false);
  });

  it("signale une checklist incomplète", async () => {
    const partial = baseCert();
    partial.checklist[0].passed = false;
    const v = await verifyCertificate(await stamp(partial));
    expect(v.integrityOk).toBe(true);
    expect(v.allPassed).toBe(false);
    expect(v.valid).toBe(false);
  });

  it("rejette proprement un JSON malformé / injection (garde de type, jamais throw)", async () => {
    for (const bad of [null, 42, "x", {}, { version: 1 }, { ...baseCert(), checklist: "oops" }]) {
      const v = await verifyCertificate(bad);
      expect(v.valid).toBe(false);
      expect(v.issues.length).toBeGreaterThan(0);
    }
  });

  it("marque le dataset synthétique (répétition à blanc) comme tel", async () => {
    const v = await verifyCertificate(await stamp({ ...baseCert(), mode: "ci", dataset: "synthetic" }));
    expect(v.dataset).toBe("synthetic");
    expect(v.valid).toBe(true);
  });

  it("signale « non scellé » (≠ altéré) un certificat de drill sans empreinte", async () => {
    const v = await verifyCertificate(baseCert()); // pas d'integrityHash
    expect(v.integrityOk).toBe(false);
    expect(v.valid).toBe(false);
    expect(v.issues.some((i) => /non scell/i.test(i))).toBe(true);
  });
});

describe("sealCertificate", () => {
  it("scelle un certificat de drill non scellé → JSON scellé re-vérifiable + valide", async () => {
    const { sealedJson, verdict } = await sealCertificate(baseCert());
    expect(sealedJson).not.toBeNull();
    expect(verdict.valid).toBe(true);
    expect(verdict.integrityOk).toBe(true);
    // le certificat scellé re-passe la vérification (empreinte cohérente)
    const reparsed: unknown = JSON.parse(sealedJson ?? "{}");
    const v = await verifyCertificate(reparsed);
    expect(v.valid).toBe(true);
    expect(v.integrityOk).toBe(true);
  });

  it("ne scelle pas un JSON invalide", async () => {
    const { sealedJson, verdict } = await sealCertificate({ nope: 1 });
    expect(sealedJson).toBeNull();
    expect(verdict.valid).toBe(false);
  });
});
