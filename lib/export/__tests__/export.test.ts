import { describe, it, expect } from "vitest";
import { buildEnsemble, recommend, type Profile } from "@/lib/engine";
import { buildDeliverable, DISCLAIMER } from "@/lib/export/model";
import { renderMarkdown } from "@/lib/export/markdown";
import { renderPdf } from "@/lib/export/pdf";

const PROFILE: Profile = {
  activity: "pme-startup",
  zone: "ue",
  users: 5,
  contentTypes: ["text", "audio"],
  volume: "10to100",
  growth: "high",
  regulations: ["rgpd", "aiact"],
  sensitivity: "confidential",
  audit: true,
  bitemporal: true,
  techLevel: "devops",
  budget: "200to500",
  reqPerDay: "lt1k",
  latency: "fast",
  voices: "multi",
  modules: { bisect: 2, reversal: 3, prereg: 1, mel: 2, conflict: 3 },
};

function deliverable() {
  const reco = recommend(PROFILE);
  return buildDeliverable(PROFILE, reco, buildEnsemble(PROFILE), new Date("2026-05-25T08:00:00Z"));
}

describe("buildDeliverable", () => {
  it("structure toutes les sections clés et date le livrable", () => {
    const d = deliverable();
    expect(d.generatedAt).toBe("2026-05-25");
    const headings = d.sections.map((s) => s.heading);
    expect(headings).toEqual(
      expect.arrayContaining([
        "Profil",
        "Stack recommandée (7 couches)",
        "Scores (8 dimensions)",
        "Carte de coûts",
        "Ensemble de configurations (incertitude)",
      ]),
    );
    expect(d.meta.some((m) => m.left === "Preset")).toBe(true);
    expect(d.disclaimer).toBe(DISCLAIMER);
  });

  it("collecte des sources cliquables dédupliquées (URL http)", () => {
    const d = deliverable();
    expect(d.sources.length).toBeGreaterThan(0);
    expect(d.sources.every((s) => s.url.startsWith("http"))).toBe(true);
    expect(new Set(d.sources.map((s) => s.url)).size).toBe(d.sources.length);
  });
});

describe("renderMarkdown", () => {
  it("rend titres, sources en lien markdown et disclaimer", () => {
    const md = renderMarkdown(deliverable());
    expect(md).toContain("# Mnémo — Plan d'infrastructure mémorielle");
    expect(md).toContain("## Stack recommandée (7 couches)");
    expect(md).toMatch(/\]\(https?:\/\//); // lien cliquable [label](http…)
    expect(md).toContain(DISCLAIMER);
  });
});

describe("renderPdf", () => {
  it("génère un PDF non vide sans lever sur le contenu français (é « » € —)", () => {
    const bytes = renderPdf(deliverable()).output("arraybuffer");
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
});
