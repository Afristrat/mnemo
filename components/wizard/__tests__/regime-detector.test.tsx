import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@/test/render";
import { RegimeDetector } from "@/components/wizard/RegimeDetector";
import type { Option } from "@/lib/wizard/options";

// S-077 tranche 4 : la détection pré-coche les régimes MAPPABLES (callback) et liste les régimes sourcés.

const RESIDENCE: Option<string>[] = [
  { value: "bresil", label: "Brésil" },
  { value: "japon", label: "Japon" },
];

function mockFetchRegimes(): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      source: "mixed",
      regimes: [
        { code: "cndp", name: "Loi 09-08 (CNDP)", scope: "data-protection", country: "maroc", confidence: "high", provenance: "seed", source: { label: "CNDP", url: "https://www.cndp.ma/", checkedAt: "2026-06-01" } },
        { code: null, name: "LGPD", scope: "data-protection", country: "bresil", confidence: "low", provenance: "live", source: { label: "ANPD", url: "https://www.gov.br/anpd/", checkedAt: "2026-06-01" } },
      ],
    }),
  });
}

afterEach(() => vi.restoreAllMocks());

describe("RegimeDetector (S-077)", () => {
  it("rend le multi-input résidence + le bouton « Détecter pour {pays} »", () => {
    render(
      <RegimeDetector
        targetCountry="maroc"
        targetCountryLabel="Maroc"
        clientResidence={[]}
        residenceOptions={RESIDENCE}
        onToggleResidence={() => {}}
        onDetected={() => {}}
      />,
    );
    expect(screen.getByText("Brésil")).toBeInTheDocument();
    expect(screen.getByText("Japon")).toBeInTheDocument();
    expect(screen.getByText(/Détecter pour Maroc/)).toBeInTheDocument();
  });

  it("au clic : pré-coche les régimes mappables (cndp) et liste les régimes sourcés", async () => {
    vi.stubGlobal("fetch", mockFetchRegimes());
    const onDetected = vi.fn();
    render(
      <RegimeDetector
        targetCountry="maroc"
        targetCountryLabel="Maroc"
        clientResidence={["bresil"]}
        residenceOptions={RESIDENCE}
        onToggleResidence={() => {}}
        onDetected={onDetected}
      />,
    );
    fireEvent.click(screen.getByText(/Détecter pour Maroc/));
    // Pré-cochage : seul le régime mappable (code cndp) est remonté au wizard.
    await waitFor(() => expect(onDetected).toHaveBeenCalledWith(["cndp"]));
    // La requête porte le pays cible ET la résidence des clients.
    expect(fetch).toHaveBeenCalledWith(
      "/api/legal/regimes",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ country: "maroc", residences: ["bresil"] }) }),
    );
    // Les deux régimes sourcés sont affichés (mappable + libre).
    expect(await screen.findByText("Loi 09-08 (CNDP)")).toBeInTheDocument();
    expect(screen.getByText("LGPD")).toBeInTheDocument();
  });

  it("pré-coche les régimes phares hors-UE modélisés (lgpd + appi), S-077 T5", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          source: "mixed",
          regimes: [
            { code: "lgpd", name: "LGPD (Lei 13.709/2018)", scope: "data-protection", country: "bresil", confidence: "high", provenance: "seed", source: { label: "ANPD", url: "https://www.gov.br/anpd/pt-br", checkedAt: "2026-06-01" } },
            { code: "appi", name: "APPI", scope: "data-protection", country: "japon", confidence: "high", provenance: "seed", source: { label: "PPC", url: "https://www.ppc.go.jp/en/", checkedAt: "2026-06-01" } },
            { code: null, name: "POPIA", scope: "data-protection", country: "afrique-sud", confidence: "low", provenance: "live", source: { label: "Info Regulator", url: "https://inforegulator.org.za/", checkedAt: "2026-06-01" } },
          ],
        }),
      }),
    );
    const onDetected = vi.fn();
    render(
      <RegimeDetector
        targetCountry="bresil"
        targetCountryLabel="Brésil"
        clientResidence={["japon", "afrique-sud"]}
        residenceOptions={RESIDENCE}
        onToggleResidence={() => {}}
        onDetected={onDetected}
      />,
    );
    fireEvent.click(screen.getByText(/Détecter pour Brésil/));
    // Seuls les régimes mappables (lgpd, appi) sont pré-cochés ; POPIA (libre) reste affichage-seul.
    await waitFor(() => expect(onDetected).toHaveBeenCalledWith(["lgpd", "appi"]));
    expect(await screen.findByText("POPIA")).toBeInTheDocument();
  });

  it("erreur réseau → message de repli (saisie manuelle), pas de pré-cochage", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("réseau")));
    const onDetected = vi.fn();
    render(
      <RegimeDetector
        targetCountry="maroc"
        targetCountryLabel="Maroc"
        clientResidence={[]}
        residenceOptions={RESIDENCE}
        onToggleResidence={() => {}}
        onDetected={onDetected}
      />,
    );
    fireEvent.click(screen.getByText(/Détecter pour Maroc/));
    expect(await screen.findByText(/Détection indisponible/)).toBeInTheDocument();
    expect(onDetected).not.toHaveBeenCalled();
  });
});
