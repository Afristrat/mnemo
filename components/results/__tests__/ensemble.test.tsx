import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@/test/render";
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
  audit: false,
  bitemporal: false,
  techLevel: "hybrid",
  budget: "50to200",
  reqPerDay: "lt100",
  latency: "fast",
  voices: "solo",
  modules: { bisect: 0, reversal: 0, prereg: 0, mel: 0, conflict: 0 },
};

describe("EnsembleView", () => {
  it("affiche la référence + les 3 scénarios et le libellé d'incertitude", () => {
    const ensemble = buildEnsemble(PROFILE);
    render(<EnsembleView ensemble={ensemble} activeId={null} onSelect={() => {}} />);

    expect(screen.getByText("Votre recommandation")).toBeInTheDocument();
    expect(screen.getByText("Souveraineté maximale")).toBeInTheDocument();
    expect(screen.getByText("Coût minimal")).toBeInTheDocument();
    expect(screen.getByText("Time-to-V1 minimal")).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Accord ${ensemble.spread.agreement}`))).toBeInTheDocument();
    // Le libellé d'incertitude (descripteur i18n) est résolu en fr par le provider de test.
    expect(screen.getByText(/Accord de l'ensemble/)).toBeInTheDocument();
  });

  it("cliquer un scénario appelle onSelect avec son id", () => {
    const onSelect = vi.fn();
    const ensemble = buildEnsemble(PROFILE);
    render(<EnsembleView ensemble={ensemble} activeId={null} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: /Coût minimal/ }));
    expect(onSelect).toHaveBeenCalledWith("cost");
  });

  it("la solution active porte aria-pressed et un badge « Affichée »", () => {
    const ensemble = buildEnsemble(PROFILE);
    render(<EnsembleView ensemble={ensemble} activeId="sovereignty" onSelect={() => {}} />);

    const active = screen.getByRole("button", { name: /Souveraineté maximale/ });
    expect(active).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Affichée")).toBeInTheDocument();
    // La référence n'est pas active.
    expect(screen.getByRole("button", { name: /Votre recommandation/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
