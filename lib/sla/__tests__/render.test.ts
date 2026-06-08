import { describe, it, expect } from "vitest";
import { renderSlaMarkdown } from "@/lib/sla/render";
import type { SlaAssessment } from "@/lib/sla/compose";

const t = (k: string, v?: Record<string, string | number>): string => (v ? `${k}:${JSON.stringify(v)}` : k);

const assessment: SlaAssessment = {
  hostingClass: "sovereign-eu",
  selfHosted: false,
  mode: "single",
  providers: [
    {
      id: "ovh-pci",
      name: "OVHcloud",
      service: "Public Cloud — Instance",
      pct: 99.99,
      mode: "single",
      downtimeMinutes: 4.3,
      sourceUrl: "https://us.ovhcloud.com/legal/sla/public-cloud/",
      asOf: "2026-06-08",
      confidence: "high",
      note: null,
    },
  ],
  reference: [],
  range: { minPct: 99.99, maxPct: 99.99 },
  coLocatedLayers: ["Base vectorielle", "Stockage polyglotte"],
};

describe("renderSlaMarkdown", () => {
  it("rend les fournisseurs, la disponibilité, la source datée et un disclaimer", () => {
    const md = renderSlaMarkdown(assessment, t, "Souverain UE");
    expect(md).toMatch(/OVHcloud/);
    expect(md).toMatch(/99\.99 %/);
    expect(md).toMatch(/us\.ovhcloud\.com/);
    expect(md).toMatch(/2026-06-08/);
    expect(md).toMatch(/docTitle/);
    expect(md).toMatch(/disclaimer/);
    expect(md).toMatch(/Base vectorielle/);
  });

  it("auto-hébergé : note dédiée + table de RÉFÉRENCE", () => {
    const selfHosted: SlaAssessment = {
      ...assessment,
      hostingClass: "self-hosted",
      selfHosted: true,
      providers: [],
      reference: assessment.providers,
    };
    const md = renderSlaMarkdown(selfHosted, t, "Auto-hébergé");
    expect(md).toMatch(/selfHostedNote/);
    expect(md).toMatch(/referenceTitle/);
    expect(md).toMatch(/OVHcloud/);
  });
});
