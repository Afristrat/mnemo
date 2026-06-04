import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "@/test/render";
import { RestoreDrillPanel } from "@/components/results/RestoreDrillPanel";
import { recommend, type Profile } from "@/lib/engine";

const PROFILE: Profile = {
  activity: "pme-startup",
  continent: "europe",
  country: "union-europeenne",
  zone: "ue",
  users: 5,
  contentTypes: ["text"],
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

describe("RestoreDrillPanel", () => {
  it("présente les deux modes et la zone de vérification", () => {
    const reco = recommend(PROFILE);
    render(<RestoreDrillPanel profile={PROFILE} recommendation={reco} />);
    expect(screen.getByRole("heading", { level: 2 })).toBeDefined();
    expect(screen.getByRole("textbox")).toBeDefined();
  });
});
