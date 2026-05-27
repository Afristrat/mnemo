"use client";

import type { ReactElement } from "react";
import { ContinuousSlider } from "@/components/wizard/ContinuousSlider";
import {
  computeSetupCost,
  costMultimodalSizing,
  type MediaNeed,
  type MMMode,
  type MMTier,
  type Modality,
  type MultimodalPriceTable,
  type Profile,
} from "@/lib/engine";
import { getMediaPricesEur } from "@/lib/pricing/media-feed";
import type { Option } from "@/lib/wizard/options";
import { cn } from "@/lib/utils/cn";

type MediaNeedsBlockProps = {
  profile: Profile;
  onChange: (mediaNeeds: MediaNeed[]) => void;
  /** Table de prix € (défaut : seed normalisé). Injectable pour les tests. */
  prices?: MultimodalPriceTable;
};

const TIER_OPTIONS: Option<MMTier>[] = [
  { value: "none", label: "Aucun" },
  { value: "light", label: "Léger" },
  { value: "medium", label: "Modéré" },
  { value: "intensive", label: "Intensif" },
];

const MODALITIES: { id: Modality; label: string; backlogUnit: string }[] = [
  { id: "audio", label: "Audio", backlogUnit: "min" },
  { id: "video", label: "Vidéo", backlogUnit: "min" },
  { id: "images", label: "Images", backlogUnit: "images" },
];

function emptyNeed(modality: Modality): MediaNeed {
  return { modality, mode: "sovereign", ingest: { tier: "none" }, generate: { tier: "none" }, backlog: 0 };
}

function ModeToggle({ mode, onChange }: { mode: MMMode; onChange: (m: MMMode) => void }): ReactElement {
  const opts: { v: MMMode; label: string }[] = [
    { v: "sovereign", label: "🟢 Souverain" },
    { v: "api", label: "💳 API" },
  ];
  return (
    <div role="group" aria-label="Mode d'exécution" className="inline-flex rounded-full bg-surface-container p-1">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={mode === o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            "rounded-full px-3 py-1 text-body-sm transition-colors",
            mode === o.v ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function MediaNeedsBlock({ profile, onChange, prices = getMediaPricesEur() }: MediaNeedsBlockProps): ReactElement {
  const needs = profile.mediaNeeds ?? [];
  const getNeed = (modality: Modality): MediaNeed => needs.find((n) => n.modality === modality) ?? emptyNeed(modality);

  const upsert = (next: MediaNeed): void => {
    onChange([...needs.filter((n) => n.modality !== next.modality), next]);
  };

  // Aperçu live du dimensionnement (sur le profil courant + besoins édités).
  const sizing = costMultimodalSizing(profile, prices);
  const setupCost = computeSetupCost(profile, prices);
  const apiMonthly = sizing.workloads.reduce((sum, w) => sum + w.monthlyCost, 0);
  const storageMonthly = Math.round(sizing.storageGb * prices.storagePerGbMonth.amount);
  const mediaMonthly = sizing.gpu.monthlyCost + apiMonthly + storageMonthly;

  return (
    <div className="space-y-6">
      {MODALITIES.map((m) => {
        const need = getNeed(m.id);
        return (
          <fieldset key={m.id} className="rounded-card border border-outline-variant p-4">
            <legend className="flex items-center gap-3 px-1">
              <span className="font-display text-body-lg text-on-surface">{m.label}</span>
              <ModeToggle mode={need.mode} onChange={(mode) => upsert({ ...need, mode })} />
            </legend>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <ContinuousSlider
                label="À mémoriser"
                options={TIER_OPTIONS}
                value={need.ingest.tier}
                onChange={(tier) => upsert({ ...need, ingest: { tier } })}
              />
              <ContinuousSlider
                label="À créer / générer"
                options={TIER_OPTIONS}
                value={need.generate.tier}
                onChange={(tier) => upsert({ ...need, generate: { tier } })}
              />
            </div>
            <label className="mt-3 flex items-center justify-between gap-3 text-body-sm text-on-surface-variant">
              <span>Backlog existant à ingérer une fois ({m.backlogUnit})</span>
              <input
                type="number"
                min={0}
                value={need.backlog ?? 0}
                onChange={(e) => upsert({ ...need, backlog: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                className={cn(
                  "w-28 rounded-input bg-surface-container px-3 py-1.5 text-right font-mono text-on-surface",
                  "ring-1 ring-outline/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                )}
              />
            </label>
          </fieldset>
        );
      })}

      {/* Aperçu live du dimensionnement (factuel ; le détail des coûts est sur la page résultats). */}
      <div className="rounded-card bg-surface-container p-4 text-body-sm text-on-surface-variant" aria-live="polite">
        {mediaMonthly > 0 || setupCost > 0 ? (
          <>
            <p className="text-on-surface">
              Ces besoins ajoutent ≈ <strong className="font-mono">{mediaMonthly} €/mois</strong> d’infra
              {sizing.gpu.monthlyCost > 0 ? (
                <>
                  , dont <strong className="font-mono">{sizing.gpu.monthlyCost} €</strong> de GPU souverain (palier{" "}
                  {sizing.gpu.tier})
                </>
              ) : null}
              .
            </p>
            <p className="mt-1">
              Stockage médias ≈ {sizing.storageGb} Go ({storageMonthly} €/mois)
              {apiMonthly > 0 ? <> · usage API ≈ {apiMonthly} €/mois</> : null}
              {setupCost > 0 ? <> · mise en route ≈ {setupCost} € (une fois)</> : null}.
            </p>
            <p className="mt-1 text-on-surface-variant/80">
              Coûts variables ±30 %, un devis est recommandé avant le go (cf. page résultats, sources datées).
            </p>
          </>
        ) : (
          <p>Aucun besoin multimédia déclaré : aucun surcoût d’infra à ce titre.</p>
        )}
      </div>
    </div>
  );
}
