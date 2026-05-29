import { describe, it, expect } from "vitest";
import {
  lookupTransferBasis,
  TRANSFER_REGIONS,
  TRANSFER_DISCLAIMER,
  type TransferRegion,
} from "@/lib/legal/transfers";

// S-043, bases légales de transfert (DÉFCON 1 + « tout vivant + filet ») : états DATÉS + RÉVISABLES.
// Orientation d'ingénierie, PAS un avis juridique. Le lookup est pur et total.

describe("lookupTransferBasis — statuts datés et révisables", () => {
  it("UE → UE : ok, non volatile, cite la libre circulation (art. 1(3))", () => {
    const b = lookupTransferBasis("eu", "eu");
    expect(b.status).toBe("ok");
    expect(b.volatile).toBe(false);
    expect(b.citation).toMatch(/free movement/i);
  });

  it("UE → US : restricted + volatile (DPF sous appel) + source officielle", () => {
    const b = lookupTransferBasis("eu", "us");
    expect(b.status).toBe("restricted");
    expect(b.volatile).toBe(true);
    expect(b.legalBasis).toMatch(/Data Privacy Framework|SCC/);
    expect(b.source?.url).toMatch(/^https:\/\//);
  });

  it("UE → Maroc : restricted + volatile (pas d'adéquation, peut évoluer)", () => {
    const b = lookupTransferBasis("eu", "maroc");
    expect(b.status).toBe("restricted");
    expect(b.volatile).toBe(true);
    expect(b.legalBasis).toMatch(/adéquation/i);
  });

  it("UE → autre pays tiers : restricted, chap. V (stable)", () => {
    const b = lookupTransferBasis("eu", "other");
    expect(b.status).toBe("restricted");
    expect(b.volatile).toBe(false);
    expect(b.legalBasis).toMatch(/chap\. V|art\. 44/);
  });

  it("Maroc → hors Maroc : restricted, loi 09-08 (CNDP)", () => {
    const b = lookupTransferBasis("maroc", "us");
    expect(b.status).toBe("restricted");
    expect(b.legalBasis).toMatch(/09-08/);
  });

  it("résidence stricte (noTransfer) + flux transfrontière → forbidden", () => {
    expect(lookupTransferBasis("eu", "us", { noTransfer: true }).status).toBe("forbidden");
    // mais intra-juridiction reste ok malgré noTransfer
    expect(lookupTransferBasis("eu", "eu", { noTransfer: true }).status).toBe("ok");
  });

  it("données régulées → US : flag Cloud Act ; pas de flag en intra-UE", () => {
    expect(lookupTransferBasis("eu", "us", { regulatedData: true }).cloudAct).toBe(true);
    expect(lookupTransferBasis("eu", "eu", { regulatedData: true }).cloudAct).toBe(false);
  });

  it("chaque résultat porte TOUJOURS un disclaimer « ingénierie, pas juridique » + une date de relevé", () => {
    for (const from of TRANSFER_REGIONS) {
      for (const to of TRANSFER_REGIONS) {
        const b = lookupTransferBasis(from, to);
        expect(b.disclaimer).toBe(TRANSFER_DISCLAIMER);
        expect(b.disclaimer).toMatch(/pas un avis juridique/i);
        expect(b.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(["ok", "restricted", "forbidden"]).toContain(b.status);
      }
    }
  });

  it("est total : toute combinaison from × to retourne un statut sans exception", () => {
    const all: TransferRegion[] = [...TRANSFER_REGIONS];
    expect(() => {
      for (const from of all) for (const to of all) lookupTransferBasis(from, to, { noTransfer: true, regulatedData: true });
    }).not.toThrow();
  });
});
