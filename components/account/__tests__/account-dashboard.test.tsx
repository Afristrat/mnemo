import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "@/test/render";
import { NetworkConsent } from "@/components/account/NetworkConsent";
import { SignOutButton } from "@/components/account/SignOutButton";

// Pièces client du tableau de bord /compte (transformation S-089). Rendu seulement (les interactions
// déclenchent une server action / signOut, hors périmètre unitaire).

describe("NetworkConsent", () => {
  it("état désactivé : propose d'activer le partage", () => {
    render(<NetworkConsent consented={false} />);
    expect(screen.getByText(/désactivé/i)).toBeDefined();
    expect(screen.getByRole("button", { name: "Activer le partage" })).toBeDefined();
  });

  it("état activé : propose de désactiver le partage", () => {
    render(<NetworkConsent consented={true} />);
    expect(screen.getByText(/activé/i)).toBeDefined();
    expect(screen.getByRole("button", { name: "Désactiver le partage" })).toBeDefined();
  });
});

describe("SignOutButton", () => {
  it("rend le bouton de déconnexion", () => {
    render(<SignOutButton />);
    expect(screen.getByRole("button", { name: "Se déconnecter" })).toBeDefined();
  });
});
