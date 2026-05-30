"use client";

import { useTranslations } from "next-intl";
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

type MediaT = ReturnType<typeof useTranslations<"Wizard.media">>;

function tierOptions(t: MediaT): Option<MMTier>[] {
  return [
    { value: "none", label: t("tier.none") },
    { value: "light", label: t("tier.light") },
    { value: "medium", label: t("tier.medium") },
    { value: "intensive", label: t("tier.intensive") },
  ];
}

function modalities(t: MediaT): { id: Modality; label: string; backlogUnit: string }[] {
  return [
    { id: "audio", label: t("modalityAudio"), backlogUnit: t("unitMin") },
    { id: "video", label: t("modalityVideo"), backlogUnit: t("unitMin") },
    { id: "images", label: t("modalityImages"), backlogUnit: t("unitImages") },
  ];
}

function emptyNeed(modality: Modality): MediaNeed {
  return { modality, mode: "sovereign", ingest: { tier: "none" }, generate: { tier: "none" }, backlog: 0 };
}

function ModeToggle({ mode, onChange }: { mode: MMMode; onChange: (m: MMMode) => void }): ReactElement {
  const t = useTranslations("Wizard.media");
  const opts: { v: MMMode; label: string }[] = [
    { v: "sovereign", label: t("modeSovereign") },
    { v: "api", label: t("modeApi") },
  ];
  return (
    <div role="group" aria-label={t("modeAria")} className="inline-flex rounded-full bg-surface-container p-1">
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
  const t = useTranslations("Wizard.media");
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
      {modalities(t).map((m) => {
        const need = getNeed(m.id);
        return (
          <fieldset key={m.id} className="rounded-card border border-outline-variant p-4">
            <legend className="flex items-center gap-3 px-1">
              <span className="font-display text-body-lg text-on-surface">{m.label}</span>
              <ModeToggle mode={need.mode} onChange={(mode) => upsert({ ...need, mode })} />
            </legend>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <ContinuousSlider
                label={t("ingest")}
                options={tierOptions(t)}
                value={need.ingest.tier}
                onChange={(tier) => upsert({ ...need, ingest: { tier } })}
              />
              <ContinuousSlider
                label={t("generate")}
                options={tierOptions(t)}
                value={need.generate.tier}
                onChange={(tier) => upsert({ ...need, generate: { tier } })}
              />
            </div>
            <label className="mt-3 flex items-center justify-between gap-3 text-body-sm text-on-surface-variant">
              <span>{t("backlog", { unit: m.backlogUnit })}</span>
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
              {t("previewAdds")}<strong className="font-mono">{t("previewPerMonth", { cost: mediaMonthly })}</strong>{t("previewInfra")}
              {sizing.gpu.monthlyCost > 0 ? t("previewGpu", { cost: sizing.gpu.monthlyCost, tier: sizing.gpu.tier }) : null}
              .
            </p>
            <p className="mt-1">
              {t("previewStorage", { gb: sizing.storageGb, cost: storageMonthly })}
              {apiMonthly > 0 ? t("previewApi", { cost: apiMonthly }) : null}
              {setupCost > 0 ? t("previewSetup", { cost: setupCost }) : null}.
            </p>
            <p className="mt-1 text-on-surface-variant/80">{t("previewDisclaimer")}</p>
          </>
        ) : (
          <p>{t("noneNote")}</p>
        )}
      </div>
    </div>
  );
}
