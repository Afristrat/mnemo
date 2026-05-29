import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@/test/render";
import { QuickProfileForm } from "@/components/quick-profile/QuickProfileForm";
import { STORAGE_KEY } from "@/lib/wizard/defaultProfile";
import type { Profile } from "@/lib/engine";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function storedProfile(): Profile | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === null ? null : (JSON.parse(raw) as Profile);
}

describe("QuickProfileForm (chemin 90 s)", () => {
  beforeEach(() => {
    localStorage.clear();
    push.mockClear();
  });

  it("affiche les 4 questions", () => {
    render(<QuickProfileForm />);
    expect(screen.getByText("Vous êtes…")).toBeInTheDocument();
    expect(screen.getByText("Vos données sont surtout…")).toBeInTheDocument();
    expect(screen.getByText("Votre priorité")).toBeInTheDocument();
    expect(screen.getByText("Au-delà du texte ?")).toBeInTheDocument();
  });

  it("« Voir mon verdict » persiste le profil et navigue vers /resultats en mode verdict", () => {
    render(<QuickProfileForm />);
    fireEvent.click(screen.getByRole("button", { name: "Voir mon verdict" }));
    expect(storedProfile()?.activity).toBe("freelance"); // défaut « solo »
    expect(push).toHaveBeenCalledWith("/resultats?mode=verdict");
  });

  it("répercute les réponses choisies dans le profil persisté", () => {
    render(<QuickProfileForm />);
    fireEvent.click(screen.getByRole("button", { name: /Équipe \/ PME/ }));
    fireEvent.click(screen.getByRole("button", { name: /audio \/ vidéo \/ images/ }));
    fireEvent.click(screen.getByRole("button", { name: "Voir mon verdict" }));
    const p = storedProfile();
    expect(p?.activity).toBe("pme-startup");
    expect(p?.contentTypes).toContain("video");
  });
});
