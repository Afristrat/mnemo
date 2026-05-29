import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@/test/render";
import { LeadGate } from "@/components/results/LeadGate";

// Lead gate (S-068) : la recette experte (children) ne se déverrouille qu'après nom + e-mail valides.
// Le formulaire utilise next-intl → on rend via le provider de test (@/test/render).

const CHILD = "RECETTE-EXPERTE";

describe("LeadGate", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("masque la recette experte tant que le lead n'est pas fourni", () => {
    render(
      <LeadGate>
        <p>{CHILD}</p>
      </LeadGate>,
    );
    expect(screen.queryByText(CHILD)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /recette complète/i })).toBeInTheDocument();
  });

  it("valide nom + e-mail, persiste le lead et débloque la recette", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <LeadGate preset="HARD">
        <p>{CHILD}</p>
      </LeadGate>,
    );

    fireEvent.change(screen.getByLabelText(/Nom/i), { target: { value: "Amine" } });
    fireEvent.change(screen.getByLabelText(/E-mail/i), { target: { value: "amine@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /détail/i }));

    await waitFor(() => expect(screen.getByText(CHILD)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/lead", expect.objectContaining({ method: "POST" }));
    expect(localStorage.getItem("strate.leadUnlocked.v1")).toBe("1");
  });

  it("repli gracieux : panne réseau → débloque quand même côté client", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    render(
      <LeadGate>
        <p>{CHILD}</p>
      </LeadGate>,
    );
    fireEvent.change(screen.getByLabelText(/Nom/i), { target: { value: "Amine" } });
    fireEvent.change(screen.getByLabelText(/E-mail/i), { target: { value: "amine@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /détail/i }));

    await waitFor(() => expect(screen.getByText(CHILD)).toBeInTheDocument());
  });

  it("ne redemande jamais : lead déjà débloqué en localStorage → recette directement visible", () => {
    localStorage.setItem("strate.leadUnlocked.v1", "1");
    render(
      <LeadGate>
        <p>{CHILD}</p>
      </LeadGate>,
    );
    expect(screen.getByText(CHILD)).toBeInTheDocument();
  });

  it("e-mail invalide → ne débloque pas, message d'erreur affiché", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <LeadGate>
        <p>{CHILD}</p>
      </LeadGate>,
    );
    fireEvent.change(screen.getByLabelText(/Nom/i), { target: { value: "Amine" } });
    fireEvent.change(screen.getByLabelText(/E-mail/i), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: /détail/i }));
    expect(screen.queryByText(CHILD)).not.toBeInTheDocument();
    expect(screen.getByText(/adresse e-mail valide/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
