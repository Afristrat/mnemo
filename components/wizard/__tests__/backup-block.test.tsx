import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BackupBlock } from "@/components/wizard/BackupBlock";
import { BudgetMeter } from "@/components/wizard/BudgetMeter";
import { BACKUP_PRICE_SEED } from "@/lib/pricing/backup-seed";
import { getMediaPricesEur } from "@/lib/pricing/media-feed";
import type { Profile, Sizing } from "@/lib/engine";

function baseProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    activity: "pme-startup",
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
    latency: "fast",
    voices: "solo",
    modules: { bisect: 0, reversal: 0, prereg: 0, mel: 0, conflict: 0 },
    ...overrides,
  };
}

const PRICES = getMediaPricesEur();

describe("BackupBlock", () => {
  it("criticité « aucune » : signale l'absence de sauvegarde, sans affinage expert", () => {
    render(
      <BackupBlock profile={baseProfile()} prices={PRICES} backupPrices={BACKUP_PRICE_SEED} onChange={() => {}} />,
    );
    expect(screen.getByText(/Aucune sauvegarde gérée/)).toBeInTheDocument();
    expect(screen.queryByText("Affinage expert")).not.toBeInTheDocument();
  });

  it("changer la criticité propage { criticality }", () => {
    const onChange = vi.fn();
    render(
      <BackupBlock profile={baseProfile()} prices={PRICES} backupPrices={BACKUP_PRICE_SEED} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Critique/ }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ criticality: "critical" }));
  });

  it("criticité « critique » : affiche l'affinage expert + l'aperçu live du plan", () => {
    render(
      <BackupBlock
        profile={baseProfile({ backup: { criticality: "critical" } })}
        prices={PRICES}
        backupPrices={BACKUP_PRICE_SEED}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("Affinage expert")).toBeInTheDocument();
    expect(screen.getByText(/Plan « critical »/)).toBeInTheDocument();
    expect(screen.getByText(/ajoute ≈/)).toBeInTheDocument();
  });
});

describe("BudgetMeter — intégration backup (S-030)", () => {
  function sizing0(): Sizing {
    return { gpu: { tier: "none", monthlyCost: 0 }, storageGb: 0, embeddingsMultimodal: false, workloads: [] };
  }

  it("la sauvegarde devient la cause dominante quand elle pèse le plus", () => {
    render(<BudgetMeter totalCost={300} budget="50to200" sizing={sizing0()} backupMonthlyCost={150} />);
    expect(screen.getByText("Au-dessus du budget")).toBeInTheDocument();
    expect(screen.getByText(/sauvegarde & résilience/i)).toBeInTheDocument();
  });
});
