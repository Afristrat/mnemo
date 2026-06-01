import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@/test/render";
import { MonitoringPanel } from "@/components/monitoring/MonitoringPanel";
import { recommend, type Profile } from "@/lib/engine";

// S-081 : le dashboard rend l'IHS, la couverture et les sous-scores (santé dérivée de la reco).

function prof(over: Partial<Profile> = {}): Profile {
  return {
    activity: "freelance",
    continent: "europe",
    country: "union-europeenne",
    zone: "ue",
    users: 1,
    contentTypes: ["text"],
    volume: "lt1",
    growth: "low",
    regulations: ["rgpd"],
    sensitivity: "public",
    audit: false,
    bitemporal: false,
    techLevel: "hybrid",
    budget: "gt2k",
    reqPerDay: "lt100",
    latency: "fast",
    voices: "solo",
    modules: { bisect: 0, reversal: 0, prereg: 0, mel: 0, conflict: 0 },
    ...over,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("MonitoringPanel (S-081)", () => {
  it("rend le titre, la couverture et un sous-score localisé", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, persisted: 0 }) }));
    const profile = prof();
    render(<MonitoringPanel result={recommend(profile)} profile={profile} />);
    expect(screen.getByText("Santé de l’infra")).toBeInTheDocument();
    expect(screen.getByText("Conformité")).toBeInTheDocument();
    // 3 dimensions dérivables (resilience, compliance, budget) sur 6.
    expect(screen.getByText(/\/6 dimensions mesurées/)).toBeInTheDocument();
  });
});
