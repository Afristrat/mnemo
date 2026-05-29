import { describe, it, expect } from "vitest";
import { buildEnsemble, decidePreset, recommend, type Profile } from "@/lib/engine";
import { seedCatalog } from "@/lib/catalog";
import { buildDeliverable, DISCLAIMER } from "@/lib/export/model";
import { renderMarkdown } from "@/lib/export/markdown";
import { renderPdf, toWinAnsi } from "@/lib/export/pdf";

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
  return buildDeliverable(PROFILE, reco, buildEnsemble(PROFILE), (m) => m.id, (k) => k, new Date("2026-05-25T08:00:00Z"));
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
        "Scores (10 dimensions)",
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

describe("buildDeliverable avec catalogue figé (S-037)", () => {
  it("ajoute la section provenance (7 couches) + les sources du catalogue", () => {
    const reco = recommend(PROFILE);
    const catalog = seedCatalog(decidePreset(PROFILE).preset, PROFILE);
    const d = buildDeliverable(PROFILE, reco, buildEnsemble(PROFILE), (m) => m.id, (k) => k, new Date("2026-05-25T08:00:00Z"), catalog);
    const section = d.sections.find((s) => s.heading.startsWith("Catalogue retenu"));
    expect(section).toBeDefined();
    expect(section?.rows).toHaveLength(7);
    expect(section?.rows[0].left).toContain(catalog.slots.c0.recommended.name);
    // La source du catalogue est jointe aux sources cliquables (rejouable).
    expect(d.sources.some((s) => s.url === catalog.slots.c0.recommended.source.url)).toBe(true);
  });

  it("sans catalogue : aucune section catalogue (rétro-compat)", () => {
    expect(deliverable().sections.find((s) => s.heading.startsWith("Catalogue retenu"))).toBeUndefined();
  });
});

describe("renderMarkdown", () => {
  it("rend titres, sources en lien markdown et disclaimer", () => {
    const md = renderMarkdown(deliverable());
    expect(md).toContain("# Strate, Plan d'infrastructure mémorielle");
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

describe("toWinAnsi (assainissement PDF)", () => {
  it("retire les émojis hors WinAnsi (qui sortaient en « Ø=ÜÄ ») et compacte l'espace", () => {
    // Exactement le cas remonté : actions de conformité préfixées d'émojis.
    expect(toWinAnsi("📄 Rédiger une AIPD")).toBe("Rédiger une AIPD");
    expect(toWinAnsi("🇲🇦 Déclaration CNDP")).toBe("Déclaration CNDP");
    expect(toWinAnsi("✅ Si déployeur Art. 26-29")).toBe("Si déployeur Art. 26-29");
    // Drapeaux (deux code points régionaux), variation selectors, ZWJ : tout disparaît.
    expect(toWinAnsi("a 🚀🔁 b")).toBe("a b");
  });

  it("préserve intégralement la typographie française (é è à ç, ’ « » —, €, espace insécable)", () => {
    expect(toWinAnsi("é è à ç ê ô î ù û É À È Ç")).toBe("é è à ç ê ô î ù û É À È Ç");
    expect(toWinAnsi("« coût » — 50 €, l’IA…")).toBe("« coût » — 50 €, l’IA…");
    expect(toWinAnsi("RPO : 24 h")).toBe("RPO : 24 h"); // espace insécable conservée
  });

  it("ne contient plus aucun code point hors plage CP1252 après assainissement", () => {
    const cleaned = toWinAnsi("📚 Tenir le registre Art. 30 RGPD à jour (traitements + finalités)");
    for (const ch of cleaned) {
      const cp = ch.codePointAt(0) ?? 0;
      expect(cp).toBeLessThanOrEqual(0x2122); // ™, le plus haut des spéciaux CP1252
    }
    expect(cleaned).toBe("Tenir le registre Art. 30 RGPD à jour (traitements + finalités)");
  });
});
