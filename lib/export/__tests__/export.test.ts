import { describe, it, expect } from "vitest";
import { buildEnsemble, decidePreset, recommend, type Profile } from "@/lib/engine";
import { seedCatalog } from "@/lib/catalog";
import { buildDeliverable } from "@/lib/export/model";
import { renderMarkdown } from "@/lib/export/markdown";
import { renderPdf, toWinAnsi } from "@/lib/export/pdf";

// Stubs de résolution (S-058/S-059) : engine → id du Message ; options & chrome livrable → la clé.
// Les assertions portent alors sur les CLÉS i18n (la localisation réelle est vérifiée côté messages/e2e).
const tEngine = (m: { id: string }): string => m.id;
const tKey = (k: string): string => k;

const PROFILE: Profile = {
  activity: "pme-startup",
  continent: "europe",
  country: "union-europeenne",
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
  return buildDeliverable(PROFILE, reco, buildEnsemble(PROFILE), tEngine, tKey, tKey, tKey, new Date("2026-05-25T08:00:00Z"));
}

describe("buildDeliverable", () => {
  it("structure toutes les sections clés (clés i18n) et date le livrable", () => {
    const d = deliverable();
    expect(d.generatedAt).toBe("2026-05-25");
    const headings = d.sections.map((s) => s.heading);
    expect(headings).toEqual(
      expect.arrayContaining([
        "section.profile",
        "section.stack",
        "section.scores",
        "section.costMap",
        "section.ensemble",
      ]),
    );
    expect(d.meta.some((m) => m.left === "meta.preset")).toBe(true);
    expect(d.disclaimer).toBe("disclaimer");
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
    const d = buildDeliverable(PROFILE, reco, buildEnsemble(PROFILE), tEngine, tKey, tKey, tKey, new Date("2026-05-25T08:00:00Z"), catalog);
    const section = d.sections.find((s) => s.heading === "section.catalog");
    expect(section).toBeDefined();
    expect(section?.rows).toHaveLength(7);
    expect(section?.rows[0].left).toContain(catalog.slots.c0.recommended.name);
    // La source du catalogue est jointe aux sources cliquables (rejouable).
    expect(d.sources.some((s) => s.url === catalog.slots.c0.recommended.source.url)).toBe(true);
  });

  it("sans catalogue : aucune section catalogue (rétro-compat)", () => {
    expect(deliverable().sections.find((s) => s.heading === "section.catalog")).toBeUndefined();
  });
});

describe("renderMarkdown", () => {
  it("rend titres, sources en lien markdown et disclaimer", () => {
    const md = renderMarkdown(deliverable());
    expect(md).toContain("# title");
    expect(md).toContain("## section.stack");
    expect(md).toMatch(/\]\(https?:\/\//); // lien cliquable [label](http…)
    expect(md).toContain("disclaimer");
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
