import { describe, it, expect } from "vitest";
import { buildVendorAlertInserts, filterUnpersistedAlerts } from "@/lib/network/vendor-alerts-observation";
import { buildVendorAlerts } from "@/lib/network/alerts";

const CHANGE = {
  vendor: "Scaleway",
  item: "GPU H100 dédié (Scaleway)",
  oldPrice: 100,
  newPrice: 140,
  currency: "EUR",
  sourceUrl: "https://www.scaleway.com/en/h100/",
  checkedAt: "2026-06-01",
} as const;

describe("buildVendorAlertInserts (S-084)", () => {
  it("mappe une alerte vers une ligne d'audit (broadcast global, circle_id null par défaut)", () => {
    const alerts = buildVendorAlerts([CHANGE]);
    const rows = buildVendorAlertInserts({ alerts });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      circle_id: null,
      created_by: null,
      vendor: "Scaleway",
      item: "GPU H100 dédié (Scaleway)",
      old_price: 100,
      new_price: 140,
      currency: "EUR",
      delta_pct: 40,
      direction: "increase",
      severity: "major",
      source_url: "https://www.scaleway.com/en/h100/",
      checked_at: "2026-06-01",
    });
  });

  it("propage circleId/createdBy quand fournis (alerte de cercle)", () => {
    const alerts = buildVendorAlerts([CHANGE]);
    const rows = buildVendorAlertInserts({ alerts, circleId: "c-1", createdBy: "u-1" });
    expect(rows[0]?.circle_id).toBe("c-1");
    expect(rows[0]?.created_by).toBe("u-1");
  });

  it("liste vide → aucune ligne", () => {
    expect(buildVendorAlertInserts({ alerts: [] })).toEqual([]);
  });
});

describe("filterUnpersistedAlerts (dédup d'audit, S-084)", () => {
  const rows = buildVendorAlertInserts({ alerts: buildVendorAlerts([CHANGE]) });

  it("garde une alerte absente de la base", () => {
    expect(filterUnpersistedAlerts(rows, [])).toHaveLength(1);
  });

  it("filtre une alerte déjà loguée le même jour (même cercle/vendor/poste/date)", () => {
    const existing = [{ circle_id: null, vendor: "Scaleway", item: "GPU H100 dédié (Scaleway)", checked_at: "2026-06-01" }];
    expect(filterUnpersistedAlerts(rows, existing)).toHaveLength(0);
  });

  it("garde l'alerte si la date diffère (nouveau relevé = nouvel événement d'audit)", () => {
    const existing = [{ circle_id: null, vendor: "Scaleway", item: "GPU H100 dédié (Scaleway)", checked_at: "2026-05-31" }];
    expect(filterUnpersistedAlerts(rows, existing)).toHaveLength(1);
  });

  it("distingue les cercles (une alerte globale ≠ la même alerte d'un cercle)", () => {
    const existing = [{ circle_id: "c-1", vendor: "Scaleway", item: "GPU H100 dédié (Scaleway)", checked_at: "2026-06-01" }];
    expect(filterUnpersistedAlerts(rows, existing)).toHaveLength(1); // rows sont circle_id null
  });
});
