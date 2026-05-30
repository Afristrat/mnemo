import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@/test/render";
import { BudgetMeter } from "@/components/wizard/BudgetMeter";
import { MediaNeedsBlock } from "@/components/wizard/MediaNeedsBlock";
import { getMediaPricesEur } from "@/lib/pricing/media-feed";
import type { MediaNeed, Profile, Sizing, WorkloadLine } from "@/lib/engine";

function baseProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    activity: "pme-startup",
    zone: "ue",
    users: 1,
    contentTypes: ["text"],
    volume: "1to10",
    growth: "medium",
    regulations: ["rgpd"],
    sensitivity: "internal",
    audit: false,
    bitemporal: false,
    techLevel: "hybrid",
    budget: "50to200",
    reqPerDay: "lt100",
    latency: "fast",
    voices: "solo",
    modules: { bisect: 0, reversal: 0, prereg: 0, mel: 0, conflict: 0 },
    ...overrides,
  };
}

describe("MediaNeedsBlock", () => {
  it("sans besoin média, indique l'absence de surcoût", () => {
    render(<MediaNeedsBlock profile={baseProfile()} onChange={() => {}} />);
    expect(screen.getByText(/Aucun besoin multimédia déclaré/)).toBeInTheDocument();
  });

  it("aperçu live : la génération vidéo souveraine fait apparaître un coût GPU", () => {
    const video: MediaNeed = { modality: "video", mode: "sovereign", ingest: { tier: "none" }, generate: { tier: "intensive" } };
    render(<MediaNeedsBlock profile={baseProfile({ mediaNeeds: [video] })} onChange={() => {}} />);
    expect(screen.getByText(/GPU souverain/)).toBeInTheDocument();
  });

  it("change le palier « à créer » → propage les mediaNeeds mis à jour", () => {
    const onChange = vi.fn();
    render(<MediaNeedsBlock profile={baseProfile()} onChange={onChange} />);
    // Les sliders « À créer / générer » (un par modalité) : on déplace le premier (audio).
    const createSliders = screen.getAllByRole("slider", { name: "À créer / générer" });
    fireEvent.change(createSliders[0], { target: { value: "2" } }); // index 2 = "medium"
    expect(onChange).toHaveBeenCalled();
    const arg = onChange.mock.calls[0][0] as MediaNeed[];
    const audio = arg.find((n) => n.modality === "audio");
    expect(audio?.generate.tier).toBe("medium");
  });
});

describe("BudgetMeter", () => {
  function sizing(gpu: number): Sizing {
    const workloads: WorkloadLine[] = [];
    return { gpu: { tier: gpu > 0 ? "dedicated-large" : "none", monthlyCost: gpu }, storageGb: 0, embeddingsMultimodal: gpu > 0, workloads };
  }

  it("vert dans le budget, sans cause/levier", () => {
    render(<BudgetMeter totalCost={80} budget="500to2k" sizing={sizing(0)} />);
    expect(screen.getByText("Dans le budget")).toBeInTheDocument();
    expect(screen.queryByText(/Levier/)).not.toBeInTheDocument();
  });

  it("rouge au-dessus du budget, avec cause GPU et levier", () => {
    render(<BudgetMeter totalCost={2100} budget="500to2k" sizing={sizing(1993)} />);
    expect(screen.getByText("Au-dessus du budget")).toBeInTheDocument();
    expect(screen.getByText(/GPU/)).toBeInTheDocument();
    expect(screen.getByText(/Levier/)).toBeInTheDocument();
  });
});

describe("getMediaPricesEur (intégration UI)", () => {
  it("fournit une table € exploitable par l'aperçu", () => {
    const t = getMediaPricesEur();
    expect(t.gpuMonthly["dedicated-large"].currency).toBe("EUR");
    expect(t.gpuMonthly["dedicated-large"].amount).toBeGreaterThan(0);
  });
});
