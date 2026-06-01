import { describe, it, expect } from "vitest";
import {
  computeHealthScore,
  healthStatus,
  HEALTH_DIMENSIONS,
  type HealthInput,
} from "@/lib/monitoring/health";

// S-079 (F12) : moteur Infra Health Score PUR. Vérifie la composition pondérée, l'EXCLUSION des
// dimensions non mesurées (jamais comptées 0, DÉFCON 1), les seuils de statut, la monotonie et les
// descripteurs i18n (jamais de prose).

describe("healthStatus — seuils (ADR-021)", () => {
  it.each([
    [100, "ok"],
    [80, "ok"],
    [79, "warn"],
    [50, "warn"],
    [49, "critical"],
    [0, "critical"],
    [null, "unknown"],
  ])("score %s → %s", (score, expected) => {
    expect(healthStatus(score as number | null)).toBe(expected);
  });
});

describe("computeHealthScore — composition pondérée", () => {
  it("toutes les dimensions à 100 → IHS 100, statut ok", () => {
    const input: HealthInput = { availability: 100, resilience: 100, compliance: 100, budget: 100, freshness: 100, drift: 100 };
    const r = computeHealthScore(input);
    expect(r.score).toBe(100);
    expect(r.status).toBe("ok");
    expect(r.measured).toBe(6);
    expect(r.total).toBe(6);
    expect(r.alerts).toEqual([]);
  });

  it("moyenne PONDÉRÉE (availability pèse plus que budget)", () => {
    // (3×90 + 1×50) / (3+1) = 320/4 = 80
    const r = computeHealthScore({ availability: 90, budget: 50 });
    expect(r.score).toBe(80);
    expect(r.status).toBe("ok");
    expect(r.measured).toBe(2);
  });

  it("une dimension NON mesurée est EXCLUE (jamais comptée 0)", () => {
    // Seule availability mesurée → composite = 80, PAS dilué par des zéros (DÉFCON 1).
    const r = computeHealthScore({ availability: 80 });
    expect(r.score).toBe(80);
    expect(r.measured).toBe(1);
    const unmeasured = r.subscores.filter((s) => s.score === null);
    expect(unmeasured).toHaveLength(5);
    expect(unmeasured.every((s) => s.status === "unknown")).toBe(true);
  });

  it("aucune dimension mesurée → score null, statut unknown, zéro alerte", () => {
    const r = computeHealthScore({});
    expect(r.score).toBeNull();
    expect(r.status).toBe("unknown");
    expect(r.measured).toBe(0);
    expect(r.alerts).toEqual([]);
  });

  it("monotonie : un signal mesuré qui baisse ⇒ composite ≤", () => {
    const high = computeHealthScore({ availability: 80, budget: 80 }).score ?? 0;
    const low = computeHealthScore({ availability: 80, budget: 40 }).score ?? 0;
    expect(low).toBeLessThanOrEqual(high);
  });

  it("clamp des valeurs hors bornes [0,100]", () => {
    expect(computeHealthScore({ availability: 150 }).score).toBe(100);
    expect(computeHealthScore({ availability: -20 }).score).toBe(0);
  });
});

describe("computeHealthScore — alertes + i18n", () => {
  it("alertes = dimensions mesurées en warn/critical, descripteurs Message", () => {
    const r = computeHealthScore({ availability: 100, resilience: 40, budget: 60 });
    // resilience=40 → critical ; budget=60 → warn ; availability=100 → ok (pas d'alerte).
    expect(r.alerts).toHaveLength(2);
    for (const a of r.alerts) {
      expect(a.id).toBe("monitoring.health.alert");
      expect(a.values?.status === "warn" || a.values?.status === "critical").toBe(true);
    }
    const dims = r.alerts.map((a) => a.values?.dimension).sort();
    expect(dims).toEqual(["budget", "resilience"]);
  });

  it("chaque sous-score porte un descripteur i18n de dimension (jamais de prose)", () => {
    const r = computeHealthScore({});
    expect(r.subscores.map((s) => s.dimension)).toEqual([...HEALTH_DIMENSIONS]);
    for (const s of r.subscores) {
      expect(s.label.id).toBe(`monitoring.health.dimension.${s.dimension}`);
    }
  });
});
