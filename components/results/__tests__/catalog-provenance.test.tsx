import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CatalogProvenance } from "@/components/results/CatalogProvenance";
import { seedCatalog } from "@/lib/catalog";
import { decidePreset, type Profile } from "@/lib/engine";

const PROFILE: Profile = {
  activity: "pme-startup",
  zone: "ue",
  users: 5,
  contentTypes: ["text", "audio"],
  volume: "10to100",
  growth: "high",
  regulations: ["rgpd"],
  sensitivity: "confidential",
  audit: true,
  bitemporal: true,
  techLevel: "devops",
  budget: "200to500",
  reqPerDay: "lt1k",
  latency: "fast",
  voices: "multi",
  modules: { bisect: 0, reversal: 0, prereg: 0, mel: 0, conflict: 0 },
};

function seed() {
  return seedCatalog(decidePreset(PROFILE).preset, PROFILE);
}

describe("CatalogProvenance", () => {
  it("rend la provenance par couche (seed → calibration datée) sur les 7 couches", () => {
    render(<CatalogProvenance catalog={seed()} pending={false} />);
    expect(screen.getByText("Provenance des choix techniques")).toBeInTheDocument();
    // Le seed → chaque couche est marquée « Calibration datée » (provenance seed).
    expect(screen.getAllByText("Calibration datée")).toHaveLength(7);
  });

  it("pending : affiche la note « veille en direct en cours » (le seed est le repli immédiat)", () => {
    render(<CatalogProvenance catalog={seed()} pending={true} />);
    expect(screen.getByText(/Veille en direct en cours/)).toBeInTheDocument();
  });
});
