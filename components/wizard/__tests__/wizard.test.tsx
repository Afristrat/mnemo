import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Wizard } from "@/components/wizard/Wizard";

describe("Wizard", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("affiche la première étape après hydratation", async () => {
    render(<Wizard />);
    expect(await screen.findByText("Activité & échelle")).toBeInTheDocument();
  });

  it("propose les profils-types pré-remplis", async () => {
    render(<Wizard />);
    await screen.findByText("Activité & échelle");
    expect(screen.getByRole("button", { name: "Coach indépendant" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cabinet juridique régulé" })).toBeInTheDocument();
  });
});
