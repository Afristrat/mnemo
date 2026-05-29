import { describe, it, expect } from "vitest";
import { lookupTransferBasis } from "@/lib/legal/transfers";
import { reconcileTransferBasis, type LiveTransferSignal } from "@/lib/legal/reconcile";

// S-062, garde-fou DÉFCON 1 de la veille juridique. Un statut juridique n'est JAMAIS remplacé en
// silence : concordant → confirmé (daté), divergent → flaggé « à revérifier », indispo → repli seed.

const SEED = lookupTransferBasis("eu", "us"); // restricted, volatile (DPF)
const LIVE_SRC = { label: "Commission UE", url: "https://commission.europa.eu/x", checkedAt: "2026-08-01" };

describe("reconcileTransferBasis (S-062)", () => {
  it("veille indisponible (null) → repli seed inchangé, provenance seed, daté + disclaimer", () => {
    const r = reconcileTransferBasis(SEED, null, "2026-08-01");
    expect(r.provenance).toBe("seed");
    expect(r.status).toBe(SEED.status);
    expect(r.checkedAt).toBe(SEED.checkedAt);
    expect(r.disclaimer).toMatch(/avis juridique/i);
  });

  it("signal concordant → statut confirmé : provenance live, fraîcheur rafraîchie, source live, note", () => {
    const live: LiveTransferSignal = { status: "restricted", source: LIVE_SRC };
    const r = reconcileTransferBasis(SEED, live, "2026-08-01");
    expect(r.provenance).toBe("live");
    expect(r.status).toBe("restricted");
    expect(r.checkedAt).toBe("2026-08-01");
    expect(r.source?.url).toBe(LIVE_SRC.url);
    expect(r.note).toMatch(/confirmé/i);
    expect(r.disclaimer).toMatch(/avis juridique/i);
    expect(r.volatile).toBe(true); // reste juridiquement révisable même confirmé
  });

  it("signal divergent → NON adopté : statut seed conservé, confiance basse, volatile, flag à revérifier", () => {
    const live: LiveTransferSignal = { status: "ok", source: LIVE_SRC };
    const r = reconcileTransferBasis(SEED, live, "2026-08-01");
    expect(r.provenance).toBe("flagged");
    expect(r.status).toBe(SEED.status); // on n'adopte PAS le « ok » live
    expect(r.confidence).toBe("low");
    expect(r.volatile).toBe(true);
    expect(r.note).toMatch(/divergent/i);
    expect(r.note).toMatch(/revérifier/i);
    expect(r.note).toContain(LIVE_SRC.url); // l'URL du signal divergent est citée pour la revérification
    expect(r.disclaimer).toMatch(/avis juridique/i);
  });
});
