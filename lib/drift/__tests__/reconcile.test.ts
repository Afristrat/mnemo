import { describe, expect, it } from "vitest";
import { reconcileDrift } from "../reconcile";
import { buildExitBundle } from "@/lib/exit/bundle";
import { recommend, type Profile } from "@/lib/engine";

const NOW = "2026-06-07T00:00:00.000Z";

const PROFILE: Profile = {
  activity: "pme-startup",
  continent: "europe",
  country: "union-europeenne",
  zone: "ue",
  users: 5,
  contentTypes: ["text"],
  volume: "10to100",
  growth: "high",
  regulations: ["rgpd"],
  sensitivity: "confidential",
  audit: true,
  bitemporal: true,
  techLevel: "devops",
  budget: "200to500",
  reqPerDay: "lt1k",
  latency: "fast",
  voices: "multi",
  modules: { bisect: 1, reversal: 2, prereg: 0, mel: 3, conflict: 2 },
};

function manifest() {
  return buildExitBundle(PROFILE, recommend(PROFILE)).manifest;
}

describe("reconcileDrift", () => {
  it("tout aligné quand le live reflète exactement le manifeste", () => {
    const m = manifest();
    const live = { layers: m.layers.map((l) => ({ id: l.id, choice: l.choice })) };
    const r = reconcileDrift(m, live, NOW);
    expect(r.driftCount).toBe(0);
    expect(r.constraintViolations).toEqual([]);
    expect(r.inSync).toBe(true);
    expect(r.alignedCount).toBe(m.layers.length);
    expect(r.generatedAt).toBe(NOW);
  });

  it("flague une couche au choix divergent (drifted, expected/actual portés)", () => {
    const m = manifest();
    const live = { layers: m.layers.map((l, i) => ({ id: l.id, choice: i === 0 ? "AUTRE-CHOIX" : l.choice })) };
    const r = reconcileDrift(m, live, NOW);
    const d = r.items.find((x) => x.status === "drifted");
    expect(d).toBeDefined();
    expect(d?.actual).toBe("AUTRE-CHOIX");
    expect(d?.expected).toBe(m.layers[0].choice);
    expect(r.inSync).toBe(false);
  });

  it("live vide → toutes les couches signées sont missing", () => {
    const m = manifest();
    const r = reconcileDrift(m, { layers: [] }, NOW);
    expect(r.items.every((i) => i.status === "missing")).toBe(true);
    expect(r.driftCount).toBe(m.layers.length);
  });

  it("couche vivante inconnue → unexpected", () => {
    const m = manifest();
    const live = { layers: [...m.layers.map((l) => ({ id: l.id, choice: l.choice })), { id: 99, choice: "INTRUS" }] };
    const r = reconcileDrift(m, live, NOW);
    expect(r.items.find((i) => i.status === "unexpected")?.actual).toBe("INTRUS");
  });

  it("région vivante hors ensemble signé → violation iso-contrainte", () => {
    const m = manifest();
    const live = { layers: m.layers.map((l) => ({ id: l.id, choice: l.choice })), regions: ["us", m.residency.primaryRegion] };
    const r = reconcileDrift(m, live, NOW);
    expect(r.constraintViolations.length).toBe(1);
    expect(r.constraintViolations[0]).toMatch(/us/);
    expect(r.inSync).toBe(false);
  });

  it("rejette proprement un JSON malformé / injection (jamais throw)", () => {
    const m = manifest();
    for (const bad of [null, 42, "x", { layers: "oops" }, { layers: [{ id: "nan", choice: 5 }] }]) {
      const r = reconcileDrift(m, bad, NOW);
      // entrée non exploitable → tout missing, jamais d'exception
      expect(r.items.every((i) => i.status === "missing")).toBe(true);
    }
  });

  it("est pure et déterministe", () => {
    const m = manifest();
    const live = { layers: m.layers.map((l) => ({ id: l.id, choice: l.choice })) };
    expect(reconcileDrift(m, live, NOW)).toEqual(reconcileDrift(m, live, NOW));
  });
});
