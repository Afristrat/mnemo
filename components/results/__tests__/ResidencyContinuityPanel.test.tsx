import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "@/test/render";
import { ResidencyContinuityPanel } from "@/components/results/ResidencyContinuityPanel";
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
  sensitivity: "internal",
  audit: false,
  bitemporal: false,
  techLevel: "hybrid",
  budget: "200to500",
  reqPerDay: "lt1k",
  latency: "fast",
  voices: "solo",
  modules: { bisect: 1, reversal: 2, prereg: 0, mel: 3, conflict: 2 },
};

describe("ResidencyContinuityPanel", () => {
  it("liste les composants de résidence avec un en-tête et un bouton d'export", () => {
    const reco = recommend(PROFILE);
    render(<ResidencyContinuityPanel recommendation={reco} />);
    expect(screen.getByRole("heading", { level: 2 })).toBeDefined();
    expect(screen.getByRole("button")).toBeDefined();
    // au moins le composant « données primaires » est listé
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
  });
});
