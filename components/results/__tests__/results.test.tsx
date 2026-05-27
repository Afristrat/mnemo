import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResultsView } from "@/components/results/ResultsView";
import { VerdictView } from "@/components/results/VerdictView";
import type { Verdict } from "@/lib/engine";

describe("ResultsView", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("vue expert par défaut : preset + carte de coûts + stack", async () => {
    render(<ResultsView />);
    expect(await screen.findByText("Preset : LIGHT")).toBeInTheDocument();
    expect(screen.getByText("Carte de coûts")).toBeInTheDocument();
    expect(screen.getByText("Stack recommandée")).toBeInTheDocument();
  });

  it("?mode=verdict : affiche la vue verdict (chemin 90 s)", async () => {
    window.history.replaceState({}, "", "/resultats?mode=verdict");
    render(<ResultsView />);
    expect(await screen.findByText("Votre verdict")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voir le détail (expert)" })).toBeInTheDocument();
  });
});

describe("VerdictView", () => {
  const verdict: Verdict = {
    pain: "Douleur test",
    risk: "Risque test",
    gain: "Gain test",
    firmPriceTier: "[PLACEHOLDER] — prix de vente",
    variableCostBand: { low: 70, high: 130 },
    setupCostBand: { low: 0, high: 0 },
    nextStep: "Étape test",
  };

  it("présente douleur/risque/gain + prix ferme placeholder + bande ±30 %", () => {
    render(<VerdictView verdict={verdict} preset="MEDIUM" onExpert={() => {}} />);
    expect(screen.getByText("Douleur test")).toBeInTheDocument();
    expect(screen.getByText("Risque test")).toBeInTheDocument();
    expect(screen.getByText(/\[PLACEHOLDER\]/)).toBeInTheDocument();
    expect(screen.getByText(/70.*130/)).toBeInTheDocument();
  });
});
