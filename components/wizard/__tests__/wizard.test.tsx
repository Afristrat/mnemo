import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@/test/render";
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

  it("expose la note libre intégrable par bloc (S-052)", async () => {
    render(<Wizard />);
    await screen.findByText("Profil & contraintes");
    expect(screen.getByRole("button", { name: "Intégrer cette note" })).toBeInTheDocument();
  });

  describe("géographie continent → pays (S-076)", () => {
    it("expose les 6 continents (pas seulement l'Europe)", async () => {
      render(<Wizard />);
      await screen.findByText("Profil & contraintes");
      for (const c of ["Europe", "Amérique du Nord", "Amérique latine", "Afrique", "Moyen-Orient", "Asie-Pacifique"]) {
        expect(screen.getAllByText(new RegExp(c)).length).toBeGreaterThan(0);
      }
    });

    it("changer de continent révèle ses pays (Afrique → Maroc ; Amérique du Nord → États-Unis)", async () => {
      render(<Wizard />);
      await screen.findByText("Profil & contraintes");
      fireEvent.click(screen.getByRole("button", { name: "Afrique" }));
      expect(screen.getByRole("button", { name: "Maroc" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Amérique du Nord" }));
      expect(screen.getByRole("button", { name: "États-Unis" })).toBeInTheDocument();
    });
  });

  describe("saisie « Autre » (S-064)", () => {
    it("n'affiche aucune saisie « Autre » par défaut (activité freelance)", async () => {
      render(<Wizard />);
      await screen.findByText("Profil & contraintes");
      expect(screen.queryByLabelText("Précisez votre activité")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Précisez la zone d'hébergement")).not.toBeInTheDocument();
    });

    it("affiche la saisie inline dès que l'activité est réglée sur « Autre »", async () => {
      render(<Wizard />);
      await screen.findByText("Profil & contraintes");
      // La 1ʳᵉ carte « Autre » est celle de l'activité (avant le champ Zone).
      const autres = screen.getAllByRole("button", { name: "Autre" });
      fireEvent.click(autres[0]);
      expect(screen.getByLabelText("Précisez votre activité")).toBeInTheDocument();
    });

    it("affiche la saisie inline dès que le pays est réglé sur « Autre (Europe) » (S-076)", async () => {
      render(<Wizard />);
      await screen.findByText("Profil & contraintes");
      // Continent par défaut = Europe → le pays « Autre (Europe) » déclenche la précision libre.
      fireEvent.click(screen.getByRole("button", { name: "Autre (Europe)" }));
      expect(screen.getByLabelText("Précisez la zone d'hébergement")).toBeInTheDocument();
    });

    it("persiste la saisie « Autre » (relue dans le champ après ressaisie)", async () => {
      render(<Wizard />);
      await screen.findByText("Profil & contraintes");
      fireEvent.click(screen.getAllByRole("button", { name: "Autre" })[0]);
      const input = screen.getByLabelText("Précisez votre activité");
      fireEvent.change(input, { target: { value: "Coopérative agricole" } });
      expect(screen.getByLabelText("Précisez votre activité")).toHaveValue("Coopérative agricole");
    });
  });
});

describe("YesNo, accessibilité", () => {
  it("expose un groupe nommé et des boutons à bascule (aria-pressed)", () => {
    render(<YesNo ariaLabel="Audit (traçabilité signée)" value={true} onChange={() => {}} />);
    expect(screen.getByRole("group", { name: "Audit (traçabilité signée)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Oui" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Non" })).toHaveAttribute("aria-pressed", "false");
  });
});
