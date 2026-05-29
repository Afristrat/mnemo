import { describe, it, expect } from "vitest";
import { lookupTransferBasis, type TransferBasis } from "@/lib/legal/transfers";
import { buildTransferObservations } from "@/lib/legal/observation";

// S-062, audit trail pur des révisions de statut juridique. Une ligne par flux ; chaque ligne porte
// la provenance, la confiance, le caractère révisable et la source datée (DÉFCON 1).

const BASES: TransferBasis[] = [
  { ...lookupTransferBasis("eu", "us"), provenance: "live" }, // restricted, source présente
  lookupTransferBasis("eu", "us", { noTransfer: true }), // forbidden, source null (résidence stricte)
];

describe("buildTransferObservations (audit trail pur, S-062)", () => {
  it("produit une ligne par flux, avec statut/provenance/volatile/date reportés", () => {
    const rows = buildTransferObservations({ bases: BASES });
    expect(rows).toHaveLength(2);
    expect(rows[0]?.from_region).toBe("eu");
    expect(rows[0]?.to_region).toBe("us");
    expect(rows[0]?.status).toBe("restricted");
    expect(rows[0]?.provenance).toBe("live");
    expect(rows[0]?.checked_at.length).toBeGreaterThan(0);
    expect(typeof rows[0]?.volatile).toBe("boolean");
  });

  it("source nulle (résidence stricte) → source_url null, ligne valide (DÉFCON 1 : source nullable légitime)", () => {
    const rows = buildTransferObservations({ bases: BASES });
    const strict = rows[1];
    expect(strict?.status).toBe("forbidden");
    expect(strict?.source_url).toBeNull();
    expect(strict?.provenance).toBe("seed"); // pas de provenance posée → défaut seed
  });

  it("veille anonyme → circle_id et created_by nuls (collecte minimale)", () => {
    const rows = buildTransferObservations({ bases: BASES });
    for (const r of rows) {
      expect(r.circle_id).toBeNull();
      expect(r.created_by).toBeNull();
    }
  });

  it("rattache au cercle + auteur quand fournis", () => {
    const rows = buildTransferObservations({ bases: BASES, circleId: "circle-1", createdBy: "user-1" });
    expect(rows.every((r) => r.circle_id === "circle-1" && r.created_by === "user-1")).toBe(true);
  });
});
