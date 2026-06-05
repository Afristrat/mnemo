import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { render } from "@/test/render";
import { MbomPanel } from "@/components/results/MbomPanel";
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

describe("MbomPanel", () => {
  it("rend le panneau et calcule l'empreinte (résumé async)", async () => {
    const reco = recommend(PROFILE);
    render(<MbomPanel profile={PROFILE} recommendation={reco} />);
    expect(screen.getByRole("heading", { level: 2 })).toBeDefined();
    // le résumé async finit par afficher l'empreinte sha256
    await waitFor(() => expect(screen.getByText(/sha256:/)).toBeDefined());
  });
});
