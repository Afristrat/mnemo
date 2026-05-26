import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Wizard } from "@/components/wizard/Wizard";
import { YesNo } from "@/components/wizard/YesNo";

describe("Wizard (4 blocs)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("affiche le premier bloc (Profil & contraintes) après hydratation", async () => {
    render(<Wizard />);
    expect(await screen.findByText("Profil & contraintes")).toBeInTheDocument();
  });

  it("expose les 4 blocs dans l'indicateur", async () => {
    render(<Wizard />);
    await screen.findByText("Profil & contraintes");
    for (const title of ["Profil & contraintes", "Infra pure", "Usage-Mémoire", "Médias"]) {
      expect(screen.getAllByText(new RegExp(title)).length).toBeGreaterThan(0);
    }
  });

  it("propose les profils-types pré-remplis", async () => {
    render(<Wizard />);
    await screen.findByText("Profil & contraintes");
    expect(screen.getByRole("button", { name: "Coach indépendant" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cabinet juridique régulé" })).toBeInTheDocument();
  });
});

describe("YesNo — accessibilité", () => {
  it("expose un groupe nommé et des boutons à bascule (aria-pressed)", () => {
    render(<YesNo ariaLabel="Audit (traçabilité signée)" value={true} onChange={() => {}} />);
    expect(screen.getByRole("group", { name: "Audit (traçabilité signée)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Oui" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Non" })).toHaveAttribute("aria-pressed", "false");
  });
});
