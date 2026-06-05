import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "@/test/render";
import { ExitCostPanel } from "@/components/results/ExitCostPanel";
import { recommend, type Profile } from "@/lib/engine";

const PROFILE: Profile = {
  activity: "pme-startup",
  continent: "europe",
  country: "union-europeenne",
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
  modules: { bisect: 1, reversal: 2, prereg: 0, mel: 3, conflict: 2 },
};

describe("ExitCostPanel", () => {
  it("affiche le coût de sortie + les éléments « à confirmer »", () => {
    const reco = recommend(PROFILE);
    render(<ExitCostPanel profile={PROFILE} recommendation={reco} />);
    expect(screen.getByRole("heading", { level: 2 })).toBeDefined();
    // les frais d'API ET l'engagement sont présentés « à confirmer » (deux lignes distinctes)
    expect(screen.getAllByText(/API|engagement|commitment/i).length).toBeGreaterThanOrEqual(2);
  });
});
