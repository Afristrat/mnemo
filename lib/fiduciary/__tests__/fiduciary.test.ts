import { describe, it, expect } from "vitest";
import { buildEnsemble, recommend, type Profile } from "@/lib/engine";
import { FIDUCIARY_CHARTER } from "@/lib/fiduciary/charter";
import { buildDeliverable } from "@/lib/export/model";

const PROFILE: Profile = {
  activity: "agence",
  zone: "maroc",
  users: 8,
  contentTypes: ["text"],
  volume: "10to100",
  growth: "medium",
  regulations: ["cndp"],
  sensitivity: "confidential",
  audit: false,
  bitemporal: false,
  techLevel: "hybrid",
  budget: "200to500",
  reqPerDay: "lt1k",
  latency: "fast",
  voices: "multi",
  modules: { bisect: 1, reversal: 1, prereg: 1, mel: 1, conflict: 1 },
};

const COMMISSION_RE = /commission|affiliation|affiliate|kickback|rétrocommission|apport d'affaires/i;

describe("Charte fiduciaire", () => {
  it("engage explicitement le zéro commission cachée", () => {
    const text = [
      FIDUCIARY_CHARTER.intro,
      FIDUCIARY_CHARTER.revenueModel,
      ...FIDUCIARY_CHARTER.commitments.flatMap((c) => [c.title, c.detail]),
    ].join(" ");
    expect(text).toMatch(/commission/i);
    expect(text).toMatch(/conseil|déploiement/i);
    expect(FIDUCIARY_CHARTER.commitments.length).toBeGreaterThanOrEqual(4);
  });

  it("est intégrée au livrable exporté", () => {
    const d = buildDeliverable(PROFILE, recommend(PROFILE), buildEnsemble(PROFILE), (m) => m.id, (k) => k, (k) => k);
    const charter = d.sections.find((s) => s.heading === "section.fiduciary");
    expect(charter).toBeDefined();
    expect(charter?.bullets.join(" ")).toMatch(/commission/i);
  });
});

describe("Invariant fiduciaire, aucune reco conditionnée à une commission", () => {
  it("le profil d'entrée ne porte aucune notion de commission", () => {
    expect(Object.keys(PROFILE).some((k) => COMMISSION_RE.test(k))).toBe(false);
  });

  it("la sortie du moteur (couches, modules) ne porte aucune notion de commission", () => {
    const reco = recommend(PROFILE);
    const keys = [
      ...reco.layers.flatMap((l) => Object.keys(l)),
      ...reco.activeModules.flatMap((m) => Object.keys(m)),
    ];
    expect(keys.some((k) => COMMISSION_RE.test(k))).toBe(false);
    // Les libellés de choix ne mentionnent pas davantage de rémunération vendor.
    expect(reco.layers.some((l) => COMMISSION_RE.test(l.choice))).toBe(false);
  });

  it("la reco est une pure fonction du profil (aucune entrée cachée)", () => {
    expect(recommend(PROFILE)).toEqual(recommend({ ...PROFILE }));
  });
});
