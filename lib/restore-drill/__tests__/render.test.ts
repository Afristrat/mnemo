import { describe, expect, it } from "vitest";
import { renderRestoreCertificateMarkdown } from "../render";
import type { RestoreVerdict } from "../certificate";

const t = (k: string, v?: Record<string, string | number>): string => (v ? `${k}:${JSON.stringify(v)}` : k);

const verdict: RestoreVerdict = {
  valid: true,
  integrityOk: true,
  allPassed: true,
  rtoMinutes: 12,
  dataset: "real",
  mode: "local",
  passedCount: 4,
  totalCount: 4,
  issues: [],
};

describe("renderRestoreCertificateMarkdown", () => {
  it("rend le verdict, le RTO, le dataset, l'intégrité et un disclaimer", () => {
    const md = renderRestoreCertificateMarkdown(verdict, "abc123", "2026-06-04T10:00:00Z", t);
    expect(md).toMatch(/abc123/);
    expect(md).toMatch(/12/);
    expect(md).toMatch(/docTitle/);
    expect(md).toMatch(/disclaimer/);
  });
});
