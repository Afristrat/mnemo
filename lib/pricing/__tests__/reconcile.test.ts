import { describe, it, expect } from "vitest";
import { reconcilePrice, DEFAULT_TOLERANCE } from "@/lib/pricing/reconcile";

// S-025 — garde-fou DÉFCON 1 : une valeur live n'est promue que si plausible vs la baseline sourcée.

describe("reconcilePrice", () => {
  it("promeut une valeur live dans la bande (confiance haute)", () => {
    const r = reconcilePrice(2.8, 2.73, "high");
    expect(r.status).toBe("live");
    expect(r.amount).toBe(2.8);
    expect(r.confidence).toBe("high");
  });

  it("rejette une valeur live à 0 € (cas H100=0 observé en réel) → baseline conservée, à revérifier", () => {
    const r = reconcilePrice(0, 2.73, "high");
    expect(r.status).toBe("flagged");
    expect(r.amount).toBe(2.73);
    expect(r.confidence).toBe("low");
    expect(r.note).toBeTruthy();
  });

  it("rejette une valeur ×10 (erreur d'unité probable)", () => {
    const r = reconcilePrice(27.3, 2.73, "high");
    expect(r.status).toBe("flagged");
    expect(r.amount).toBe(2.73);
  });

  it("repli sur la baseline quand l'extraction est indisponible (null)", () => {
    const r = reconcilePrice(null, 0.0146, "high");
    expect(r.status).toBe("fallback");
    expect(r.amount).toBe(0.0146);
    expect(r.confidence).toBe("high");
  });

  it("repli sur valeur non finie (NaN / Infinity)", () => {
    expect(reconcilePrice(Number.NaN, 1, "medium").status).toBe("fallback");
    expect(reconcilePrice(Number.POSITIVE_INFINITY, 1, "medium").status).toBe("fallback");
  });

  it("poste gratuit par conception : live 0 concorde, live > 0 est flaggé", () => {
    expect(reconcilePrice(0, 0, "high").status).toBe("live");
    expect(reconcilePrice(5, 0, "high").status).toBe("flagged");
  });

  it("accepte la borne haute de la bande, rejette juste au-delà", () => {
    const base = 100;
    expect(reconcilePrice(base * (1 + DEFAULT_TOLERANCE), base, "high").status).toBe("live");
    expect(reconcilePrice(base * (1 + DEFAULT_TOLERANCE) + 0.01, base, "high").status).toBe("flagged");
  });
});
