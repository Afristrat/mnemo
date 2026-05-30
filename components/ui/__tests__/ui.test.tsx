import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/render";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { StatusDot } from "@/components/ui/StatusDot";

describe("Button", () => {
  it("rend le libellé, le variant primary et type=button par défaut", () => {
    render(<Button>Configurer</Button>);
    const btn = screen.getByRole("button", { name: "Configurer" });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveClass("bg-primary");
    expect(btn).toHaveClass("rounded-full");
    expect(btn).toHaveAttribute("type", "button");
  });

  it("applique le variant secondary", () => {
    render(<Button variant="secondary">Annuler</Button>);
    expect(screen.getByRole("button", { name: "Annuler" })).toHaveClass("border-outline-variant");
  });
});

describe("Chip", () => {
  it("applique la tonalité demandée", () => {
    render(<Chip tone="primary">Souverain</Chip>);
    expect(screen.getByText("Souverain")).toHaveClass("text-primary");
  });
});

describe("StatusDot", () => {
  it("expose toujours un libellé de confiance accessible", () => {
    render(<StatusDot confidence="high" />);
    expect(screen.getByText("Vérifié sur la doc vendor")).toBeInTheDocument();
  });

  it("affiche le libellé visible quand showLabel est vrai", () => {
    render(<StatusDot confidence="low" showLabel />);
    expect(screen.getByText("Estimation à challenger")).toBeVisible();
  });
});
