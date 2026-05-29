import { describe, it, expect } from "vitest";
import {
  RESIDENCY_PRICE_SEED,
  RESIDENCY_EGRESS_SEED,
  NEUTRAL_RESIDENCY_PRICES,
  INTER_SITE_SECURITY_SEED,
  getResidencyPrices,
  vectorsForClass,
  selectEgressVector,
  reconcileEgressVector,
  type HostingClass,
} from "@/lib/pricing/residency-seed";

// S-043, seed résidence (DÉFCON 1 + doctrine « tout vivant + filet ») : repli daté + baseline.
// Multi-segment (pas de référent unique) ; devises natives ; garde-fou de réconciliation vs live.

describe("seed egress résidence — multi-segment, DÉFCON 1", () => {
  it("chaque vecteur porte une source datée (URL https + checkedAt), une confiance et une devise native", () => {
    for (const v of RESIDENCY_EGRESS_SEED) {
      const e = v.interRegionEgress;
      expect(e.amount).toBeGreaterThanOrEqual(0); // 0 légitime (OVH/Outscale egress gratuit)
      expect(["EUR", "USD"]).toContain(e.currency);
      expect(["high", "medium", "low"]).toContain(e.confidence);
      expect(e.source).not.toBeNull();
      expect(e.source?.url).toMatch(/^https:\/\//);
      expect(e.source?.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("couvre le spectre des profils first-class (self-hosted + souverains UE + secnumcloud + hyperscalers)", () => {
    const classes = new Set<HostingClass>(RESIDENCY_EGRESS_SEED.map((v) => v.hostingClass));
    expect(classes.has("self-hosted")).toBe(true);
    expect(classes.has("sovereign-eu")).toBe(true);
    expect(classes.has("secnumcloud")).toBe(true);
    expect(classes.has("hyperscaler")).toBe(true);
    // Plusieurs souverains UE (pas un référent unique).
    expect(vectorsForClass(RESIDENCY_PRICE_SEED, "sovereign-eu").length).toBeGreaterThanOrEqual(3);
  });

  it("seuls les hyperscalers sont non souverains ; ils sont en devise USD", () => {
    for (const v of RESIDENCY_EGRESS_SEED) {
      if (v.hostingClass === "hyperscaler") {
        expect(v.sovereign).toBe(false);
        expect(v.interRegionEgress.currency).toBe("USD");
      } else {
        expect(v.sovereign).toBe(true);
      }
    }
  });

  it("chiffrage sécurisation inter-site (S-061) : VM passerelle sourcée EUR + alternative managée sourcée USD", () => {
    const gw = INTER_SITE_SECURITY_SEED.selfHostedGatewayPerMonth;
    const managed = INTER_SITE_SECURITY_SEED.managedPerUserPerMonth;
    // Postes chiffrables vendeur : source datée https + devise native + confiance.
    for (const e of [gw, managed]) {
      expect(e.amount).toBeGreaterThan(0);
      expect(["high", "medium", "low"]).toContain(e.confidence);
      expect(e.source).not.toBeNull();
      expect(e.source?.url).toMatch(/^https:\/\//);
      expect(e.source?.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(gw.currency).toBe("EUR"); // Hetzner CX22
    expect(managed.currency).toBe("USD"); // Tailscale/Cloudflare
    // WireGuard/mTLS = licence open-source 0 € ; supervision/durcissement = OPEX non figé (DÉFCON 1).
    expect(gw.note).toMatch(/licence 0|open-source/i);
    expect(gw.note).toMatch(/devis/i);
  });

  it("getResidencyPrices renvoie le seed", () => {
    expect(getResidencyPrices()).toBe(RESIDENCY_PRICE_SEED);
  });
});

describe("table neutre (invariant)", () => {
  it("tous les egress à 0 €, source nulle, sécurité à 0 (n'altère pas totalCost)", () => {
    for (const v of NEUTRAL_RESIDENCY_PRICES.egressVectors) {
      expect(v.interRegionEgress.amount).toBe(0);
      expect(v.interRegionEgress.source).toBeNull();
    }
    expect(NEUTRAL_RESIDENCY_PRICES.interSiteSecurity.selfHostedGatewayPerMonth.amount).toBe(0);
    expect(NEUTRAL_RESIDENCY_PRICES.interSiteSecurity.managedPerUserPerMonth.amount).toBe(0);
  });
});

describe("sélection de vecteur (pure, pour S-044)", () => {
  it("selectEgressVector rend un vecteur de la classe demandée", () => {
    expect(selectEgressVector(RESIDENCY_PRICE_SEED, "secnumcloud").hostingClass).toBe("secnumcloud");
    expect(selectEgressVector(RESIDENCY_PRICE_SEED, "self-hosted").hostingClass).toBe("self-hosted");
  });
});

describe("garde-fou de réconciliation (live vs baseline, ±60 %)", () => {
  const scaleway = RESIDENCY_EGRESS_SEED.find((v) => v.provider === "Scaleway");
  if (scaleway === undefined) throw new Error("vecteur Scaleway attendu dans le seed");

  it("valeur live plausible → promue (status live)", () => {
    const r = reconcileEgressVector(scaleway, 0.012, "2026-06-01");
    expect(r.status).toBe("live");
    expect(r.vector.interRegionEgress.amount).toBe(0.012);
    expect(r.vector.interRegionEgress.source?.checkedAt).toBe("2026-06-01");
  });

  it("valeur live aberrante → repli baseline + flag", () => {
    const r = reconcileEgressVector(scaleway, 1.0, "2026-06-01");
    expect(r.status).toBe("flagged");
    expect(r.vector.interRegionEgress.amount).toBe(0.01);
    expect(r.vector.interRegionEgress.confidence).toBe("low");
  });

  it("pas de valeur live → repli baseline (fallback)", () => {
    const r = reconcileEgressVector(scaleway, null, "2026-06-01");
    expect(r.status).toBe("fallback");
    expect(r.vector.interRegionEgress.amount).toBe(0.01);
  });
});
