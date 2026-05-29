import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@/test/render";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

import { IntakeField } from "@/components/intake/IntakeField";
import { STORAGE_KEY } from "@/lib/wizard/defaultProfile";

describe("IntakeField", () => {
  beforeEach(() => {
    pushMock.mockReset();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("le bouton est désactivé tant que la description est vide", () => {
    render(<IntakeField />);
    expect(screen.getByRole("button", { name: /Analyser et pré-remplir/ })).toBeDisabled();
  });

  it("analyse la description → persiste le profil validé puis ouvre le configurateur", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ profile: { sensitivity: "secret", users: 9 }, applied: ["sensitivity", "users"], rejected: [] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    render(<IntakeField />);
    fireEvent.change(screen.getByLabelText(/décrivez votre besoin/i), {
      target: { value: "cabinet, 9 personnes, dossiers secrets" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Analyser et pré-remplir/ }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/configurateur"));
    expect(localStorage.getItem(STORAGE_KEY)).toContain("secret");
  });

  it("erreur réseau → message de repli (saisie manuelle), pas de navigation", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("réseau KO"));
    render(<IntakeField />);
    fireEvent.change(screen.getByLabelText(/décrivez votre besoin/i), { target: { value: "test" } });
    fireEvent.click(screen.getByRole("button", { name: /Analyser et pré-remplir/ }));

    await waitFor(() => expect(screen.getByText(/Analyse indisponible/)).toBeInTheDocument());
    expect(pushMock).not.toHaveBeenCalled();
  });
});
