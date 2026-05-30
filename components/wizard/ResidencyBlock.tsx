"use client";

import { useTranslations } from "next-intl";
import type { ReactElement } from "react";
import { CheckboxCards } from "@/components/wizard/CheckboxCards";
import { InfoBubble } from "@/components/wizard/InfoBubble";
import { RadioCards } from "@/components/wizard/RadioCards";
import { YesNo } from "@/components/wizard/YesNo";
import { useEngineText } from "@/lib/i18n/engine";
import {
  decidePreset,
  deriveResidencyPlan,
  deriveResidencyTopology,
  hostingClassForProfile,
  type ComputePriceTable,
  type DrTier,
  type Profile,
  type Region,
  type Residency,
  type ResidencyPriceTable,
} from "@/lib/engine";
import { getComputePrices } from "@/lib/pricing/compute-seed";
import { getResidencyPrices } from "@/lib/pricing/residency-seed";
import { useOptions } from "@/lib/wizard/useOptions";
import { cn } from "@/lib/utils/cn";

type ResidencyBlockProps = {
  profile: Profile;
  onChange: (residency: Residency) => void;
  /** Prix résidence (egress inter-région) injectables (tests / aperçu live). */
  residencyPrices?: ResidencyPriceTable;
  /** Prix compute (régions en attente) injectables (tests / aperçu live). */
  computePrices?: ComputePriceTable;
};

function NumberRow({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (v: number) => void;
}): ReactElement {
  return (
    <label className="flex items-center justify-between gap-3 text-body-sm text-on-surface-variant">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.round(Number(e.target.value) || min)))}
        className={cn(
          "w-28 rounded-input bg-surface-container px-3 py-1.5 text-right font-mono text-on-surface",
          "ring-1 ring-outline/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        )}
      />
    </label>
  );
}

/**
 * Section « Résidence & continuité » du Bloc ② (spec n°2 §9, S-048). Criticité DR (none/warm/hot) +
 * affinage expert (région primaire, régions autorisées multi-continent, résidence stricte, actif-actif,
 * RPO/RTO). Aperçu live du coût + alerte de conflit résidence × DR (jamais résolu en douce). Le moteur
 * reste pur : la dérivation + le coût viennent de `deriveResidencyPlan` (prix injectés).
 */
export function ResidencyBlock({
  profile,
  onChange,
  residencyPrices = getResidencyPrices(),
  computePrices = getComputePrices(),
}: ResidencyBlockProps): ReactElement {
  const t = useTranslations("Wizard.residency");
  const resolveEngine = useEngineText();
  const opts = useOptions();
  const r: Residency = profile.residency ?? {};
  const update = (patch: Partial<Residency>): void => onChange({ ...r, ...patch });

  const preset = decidePreset(profile).preset;
  const plan = deriveResidencyPlan(profile, residencyPrices, computePrices, preset, hostingClassForProfile(profile));
  const noTransfer = deriveResidencyTopology(profile).noTransfer;
  const monthly = Math.round(plan.monthlyCost);
  const setup = Math.round(plan.setupCost);
  const isNone = plan.drTier === "none" && !plan.activeActive;
  const allowed: Region[] = r.allowedRegions ?? [];
  const replicaCount = plan.regions.filter((reg) => reg.role !== "primary").length;

  const toggleRegion = (value: Region): void =>
    update({
      allowedRegions: allowed.includes(value) ? allowed.filter((v) => v !== value) : [...allowed, value],
    });

  return (
    <div className="space-y-4">
      <fieldset className="border-0 p-0">
        <legend className="mb-2 flex items-center gap-2 text-label-caps uppercase text-on-surface-variant">
          {t("drLegend")}
          <InfoBubble label={t("drLegend")} why={t("drInfo.why")} consequence={t("drInfo.consequence")} />
        </legend>
        <RadioCards
          value={plan.drTier}
          options={opts.drTier}
          onChange={(drTier: DrTier) => update({ drTier })}
        />
      </fieldset>

      {!isNone ? (
        <details className="rounded-card border border-outline-variant p-4">
          <summary className="cursor-pointer text-body-sm font-medium text-on-surface">{t("expert")}</summary>
          <div className="mt-4 space-y-4">
            <fieldset className="border-0 p-0">
              <legend className="mb-2 text-label-caps uppercase text-on-surface-variant">{t("primaryLegend")}</legend>
              <RadioCards
                value={plan.primaryRegion}
                options={opts.region}
                onChange={(primaryRegion: Region) => update({ primaryRegion })}
              />
            </fieldset>
            <fieldset className="border-0 p-0">
              <legend className="mb-2 flex items-center gap-2 text-label-caps uppercase text-on-surface-variant">
                {t("regionsLegend")}
                <InfoBubble label={t("regionsLabel")} why={t("regionsInfo.why")} consequence={t("regionsInfo.consequence")} />
              </legend>
              <CheckboxCards values={allowed} options={opts.region} onToggle={toggleRegion} />
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 flex items-center gap-2 text-label-caps uppercase text-on-surface-variant">
                  {t("strictLabel")}
                  <InfoBubble label={t("strictLabel")} why={t("strictInfo.why")} consequence={t("strictInfo.consequence")} />
                </p>
                <YesNo
                  ariaLabel={t("strictAria")}
                  value={noTransfer}
                  onChange={(noTransferOutsideJurisdiction) => update({ noTransferOutsideJurisdiction })}
                />
              </div>
              <div>
                <p className="mb-1 text-label-caps uppercase text-on-surface-variant">{t("activeActiveLabel")}</p>
                <YesNo
                  ariaLabel={t("activeActiveAria")}
                  value={plan.activeActive}
                  onChange={(activeActive) => update({ activeActive })}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <NumberRow label={t("drRpo")} value={plan.rpoMinutes} min={0} onChange={(drRpoMinutes) => update({ drRpoMinutes })} />
              <NumberRow label={t("drRto")} value={plan.rtoMinutes} min={0} onChange={(drRtoMinutes) => update({ drRtoMinutes })} />
            </div>
          </div>
        </details>
      ) : null}

      {/* Alerte de conflit résidence × DR — exposée, JAMAIS résolue en douce (décision Amine #6). */}
      {plan.conflict.hasConflict ? (
        <div className="rounded-card border border-error/40 bg-error/5 p-4 text-body-sm" role="alert">
          <p className="font-medium text-error">{t("conflictTitle")}</p>
          <p className="mt-1 text-on-surface-variant">{resolveEngine(plan.conflict.reason)}</p>
          <p className="mt-2 text-on-surface">{t("conflictLevers")}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-on-surface-variant">
            {plan.conflict.levers.map((lever) => (
              <li key={lever.id}>{resolveEngine(lever)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Aperçu live, factuel (le détail des coûts + la conformité des transferts sont sur la page résultats). */}
      <div className="rounded-card bg-surface-container p-4 text-body-sm text-on-surface-variant" aria-live="polite">
        {isNone ? (
          <p>{t("noneNote")}</p>
        ) : (
          <>
            <p className="text-on-surface">
              {t("previewAdds")}<strong className="font-mono">{t("previewPerMonth", { cost: monthly })}</strong>
              {setup > 0 ? (
                <>
                  {" "}
                  <strong className="font-mono">{t("previewSetup", { cost: setup })}</strong>
                </>
              ) : null}
              .
            </p>
            <p className="mt-1">
              {t("previewPlan", {
                region: plan.primaryRegion,
                dr: plan.activeActive ? t("activeActiveValue") : plan.drTier,
                count: replicaCount,
                rto: plan.rtoMinutes,
              })}
            </p>
            <p className="mt-1 text-on-surface-variant/80">{t("previewDisclaimer")}</p>
          </>
        )}
      </div>
    </div>
  );
}
