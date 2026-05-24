import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResultsView } from "@/components/results/ResultsView";

describe("ResultsView", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("affiche le preset et la carte de coûts pour le profil par défaut", async () => {
    render(<ResultsView />);
    expect(await screen.findByText("Preset : LIGHT")).toBeInTheDocument();
    expect(screen.getByText("Carte de coûts")).toBeInTheDocument();
    expect(screen.getByText("Stack recommandée")).toBeInTheDocument();
  });
});
