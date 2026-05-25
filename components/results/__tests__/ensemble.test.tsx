import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EnsembleView } from "@/components/results/EnsembleView";
import { buildEnsemble, type Profile } from "@/lib/engine";

const PROFILE: Profile = {
  activity: "freelance",
  zone: "ue",
  users: 1,
  contentTypes: ["text"],
  volume: "1to10",
  growth: "medium",
  regulations: ["rgpd"],
  sensitivity: "internal",
  audit: "desired",
  bitemporal: "desired",
  techLevel: "hybrid",
  budget: "50to200",
  reqPerDay: "lt100",
  latency: "fast",
  voices: "solo",
  modules: { bisect: 0, reversal: 0, prereg: 0, mel: 0, conflict: 0 },
};

describe("EnsembleView", () => {
  it("affiche les 3 membres et le libellé d'incertitude", () => {
    const ensemble = buildEnsemble(PROFILE);
    render(<EnsembleView ensemble={ensemble} />);

    expect(screen.getByText("Souveraineté maximale")).toBeInTheDocument();
    expect(screen.getByText("Coût minimal")).toBeInTheDocument();
    expect(screen.getByText("Time-to-V1 minimal")).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Accord ${ensemble.spread.agreement}`))).toBeInTheDocument();
    expect(screen.getByText(ensemble.spread.uncertaintyLabel)).toBeInTheDocument();
  });
});
