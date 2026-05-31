import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@/test/render";
import { RedundancyPanel } from "@/components/results/RedundancyPanel";
import type { Profile } from "@/lib/engine";

function prof(over: Partial<Profile> = {}): Profile {
  return {
    activity: "pme-startup",
    continent: "europe",
    country: "union-europeenne",
    zone: "ue",
    users: 5,
    contentTypes: ["text"],
    volume: "10to100",
    growth: "medium",
    regulations: ["rgpd"],
    sensitivity: "internal",
    audit: false,
    bitemporal: false,
    techLevel: "hybrid",
    budget: "200to500",
    reqPerDay: "lt1k",
    latency: "fast",
    voices: "solo",
    modules: { bisect: 0, reversal: 0, prereg: 0, mel: 0, conflict: 0 },
    ...over,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RedundancyPanel (S-073 T4)", () => {
  it("affiche le titre, la note de contrainte absolue et l'invite initiale", () => {
    render(<RedundancyPanel profile={prof()} />);
    expect(screen.getByText(/Redondance multi-continent/)).toBeInTheDocument();
    expect(screen.getByText(/contrainte absolue/)).toBeInTheDocument();
    expect(screen.getByText(/Choisissez un continent/)).toBeInTheDocument();
  });

  it("pré-remplit le pays cible depuis le profil quand c'est un pays concret (S-076 → S-073)", () => {
    render(<RedundancyPanel profile={prof({ continent: "africa", country: "maroc" })} />);
    expect(screen.getByPlaceholderText(/Kenya, Japon/)).toHaveValue("Maroc");
  });

  it("ne pré-remplit pas pour un bloc/Autre (UE) : champ vide", () => {
    render(<RedundancyPanel profile={prof({ continent: "europe", country: "union-europeenne" })} />);
    expect(screen.getByPlaceholderText(/Kenya, Japon/)).toHaveValue("");
  });

  it("recherche → liste sourcée, sélection → topologie redondante résumée", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        country: "Kenya",
        continent: "africa",
        source: "mixed",
        discoveredAt: "2026-05-31",
        providers: [
          {
            name: "iXAfrica",
            continent: "africa",
            country: "Kenya",
            sovereignty: "sovereign",
            note: "cloud souverain",
            source: { label: "x", url: "https://ix.example", checkedAt: "2026-05-31" },
            provenance: "live",
          },
          {
            name: "UniCloud Africa",
            continent: "africa",
            country: "Nigeria",
            sovereignty: "sovereign",
            note: "",
            source: { label: "y", url: "https://uni.example", checkedAt: "2026-05-31" },
            provenance: "seed",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<RedundancyPanel profile={prof()} />);
    fireEvent.change(screen.getByPlaceholderText(/Kenya, Japon/), { target: { value: "Kenya" } });
    fireEvent.click(screen.getByText(/Trouver des fournisseurs/));

    expect(await screen.findByText("iXAfrica")).toBeInTheDocument();
    expect(screen.getByText("UniCloud Africa")).toBeInTheDocument();

    // POST avec le profil + le pays + le continent (la contrainte voyage avec le profil).
    expect(fetchMock).toHaveBeenCalledWith("/api/residency/providers", expect.objectContaining({ method: "POST" }));

    // Sélection de 2 fournisseurs → message de redondance multi-fournisseur.
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    await waitFor(() => expect(screen.getByText(/Redondance multi-fournisseur/)).toBeInTheDocument());
    // T5 : 2 juridictions distinctes (Kenya, Nigeria) → caveat légal conservateur + caveat coûts=devis.
    expect(screen.getByText(/à valider avant décision/)).toBeInTheDocument();
    expect(screen.getByText(/sur devis par fournisseur/)).toBeInTheDocument();
  });

  it("erreur réseau → message d'échec", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("net")));
    render(<RedundancyPanel profile={prof()} />);
    fireEvent.change(screen.getByPlaceholderText(/Kenya, Japon/), { target: { value: "Kenya" } });
    fireEvent.click(screen.getByText(/Trouver des fournisseurs/));
    expect(await screen.findByText(/La recherche a échoué/)).toBeInTheDocument();
  });
});
