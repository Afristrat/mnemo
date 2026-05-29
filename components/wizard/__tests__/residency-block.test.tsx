import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResidencyBlock } from "@/components/wizard/ResidencyBlock";
import { getComputePrices } from "@/lib/pricing/compute-seed";
import { getResidencyPrices } from "@/lib/pricing/residency-seed";
import type { Profile } from "@/lib/engine";

function baseProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    activity: "pme-startup",
    zone: "ue",
    users: 5,
    contentTypes: ["text"],
    volume: "100to1000",
    growth: "medium",
    regulations: ["rgpd"],
    sensitivity: "confidential",
    audit: false,
    bitemporal: false,
    techLevel: "hybrid",
    budget: "200to500",
    reqPerDay: "lt1k",
    latency: "fast",
    voices: "solo",
    modules: { bisect: 0, reversal: 0, prereg: 0, mel: 0, conflict: 0 },
    ...overrides,
  };
}

const RESIDENCY = getResidencyPrices();
const COMPUTE = getComputePrices();

describe("ResidencyBlock", () => {
  it("DR « aucune » : signale la reprise par restauration, sans affinage expert", () => {
    render(
      <ResidencyBlock profile={baseProfile()} residencyPrices={RESIDENCY} computePrices={COMPUTE} onChange={() => {}} />,
    );
    expect(screen.getByText(/Aucune continuité régionale gérée/)).toBeInTheDocument();
    expect(screen.queryByText("Affinage expert")).not.toBeInTheDocument();
  });

  it("changer le palier DR propage { drTier }", () => {
    const onChange = vi.fn();
    render(
      <ResidencyBlock profile={baseProfile()} residencyPrices={RESIDENCY} computePrices={COMPUTE} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Chaude/ }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ drTier: "hot" }));
  });

  it("DR « chaude » : affiche l'affinage expert + l'aperçu live du coût régional", () => {
    render(
      <ResidencyBlock
        profile={baseProfile({ residency: { drTier: "hot" } })}
        residencyPrices={RESIDENCY}
        computePrices={COMPUTE}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("Affinage expert")).toBeInTheDocument();
    expect(screen.getByText(/ajoute ≈/)).toBeInTheDocument();
    expect(screen.getByText(/région.* en attente/)).toBeInTheDocument();
  });

  it("conflit résidence stricte × DR en juridiction mono-région : alerte + leviers (jamais résolu en douce)", () => {
    render(
      <ResidencyBlock
        profile={baseProfile({ zone: "maroc", sensitivity: "secret", residency: { drTier: "hot" } })}
        residencyPrices={RESIDENCY}
        computePrices={COMPUTE}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/Tension résidence × continuité régionale/);
    expect(screen.getByText(/Leviers possibles/)).toBeInTheDocument();
  });
});
