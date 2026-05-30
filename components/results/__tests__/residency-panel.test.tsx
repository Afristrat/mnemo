import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/render";
import { ResidencyPanel } from "@/components/results/ResidencyPanel";
import type { ResidencyPlan } from "@/lib/engine";

function plan(overrides: Partial<ResidencyPlan> = {}): ResidencyPlan {
  return {
    primaryRegion: "eu",
    regions: [{ region: "eu", role: "primary", monthlyCost: 0 }],
    drTier: "none",
    activeActive: false,
    rpoMinutes: 1440,
    rtoMinutes: 480,
    transfers: [],
    conflict: { hasConflict: false, reason: { id: "residency.conflict.none" }, levers: [] },
    monthlyCost: 0,
    setupCost: 0,
    geoSovScore: 8,
    costSources: [],
    ...overrides,
  };
}

describe("ResidencyPanel", () => {
  it("plan neutre (DR none, aucun transfert, aucun conflit) → rien à afficher", () => {
    const { container } = render(<ResidencyPanel plan={plan()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("transfert UE → US encadré : pastille + base légale affichées", () => {
    render(
      <ResidencyPanel
        plan={plan({
          drTier: "warm",
          regions: [
            { region: "eu", role: "primary", monthlyCost: 0 },
            { region: "us", role: "standby", monthlyCost: 30 },
          ],
          monthlyCost: 30,
          transfers: [
            {
              from: "eu",
              to: "us",
              legalBasis: "RGPD chap. V — Data Privacy Framework",
              status: "restricted",
              note: "Statut évolutif (vérifié 2026-05-29). Orientation d’ingénierie, pas un avis juridique.",
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(/Transferts inter-juridiction/)).toBeInTheDocument();
    expect(screen.getByText(/RGPD chap. V — Data Privacy Framework/)).toBeInTheDocument();
    expect(screen.getByText(/Encadré/)).toBeInTheDocument();
  });

  it("conflit résidence × DR : alerte + leviers", () => {
    render(
      <ResidencyPanel
        plan={plan({
          primaryRegion: "maroc",
          drTier: "hot",
          monthlyCost: 50,
          regions: [
            { region: "maroc", role: "primary", monthlyCost: 0 },
            { region: "maroc", role: "standby", monthlyCost: 50 },
          ],
          conflict: {
            hasConflict: true,
            reason: { id: "residency.conflict.reason", values: { region: "maroc", dr: "hot" } },
            levers: [{ id: "residency.conflict.lever1" }, { id: "residency.conflict.lever2" }],
          },
        })}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/Tension résidence × continuité régionale/);
    expect(screen.getByText(/Région UE secondaire conforme/)).toBeInTheDocument();
  });
});
