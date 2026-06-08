import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "@/test/render";
import { SlaPanel } from "@/components/results/SlaPanel";
import { recommend, type Profile } from "@/lib/engine";

const PROFILE: Profile = {
  activity: "pme-startup",
  continent: "europe",
  country: "union-europeenne",
  zone: "ue",
  users: 5,
  contentTypes: ["text"],
  volume: "10to100",
  growth: "medium",
  regulations: ["rgpd"],
  sensitivity: "confidential",
  audit: false,
  bitemporal: false,
  techLevel: "hybrid",
  budget: "200to500",
  reqPerDay: "lt1k",
  latency: "acceptable",
  voices: "solo",
  modules: { bisect: 1, reversal: 1, prereg: 0, mel: 2, conflict: 1 },
};

describe("SlaPanel (vague 3 #5)", () => {
  it("souverain UE : affiche le spectre des fournisseurs sourcés (OVHcloud) avec un titre", () => {
    render(<SlaPanel profile={PROFILE} recommendation={recommend(PROFILE)} />);
    expect(screen.getByRole("heading", { level: 2 })).toBeDefined();
    expect(screen.getByText("OVHcloud")).toBeDefined();
    // au moins une traduction d'indisponibilité par mois est rendue
    expect(screen.getAllByText(/min\/mois/).length).toBeGreaterThan(0);
  });
});
