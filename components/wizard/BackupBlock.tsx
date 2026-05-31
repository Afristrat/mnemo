"use client";

import { useTranslations } from "next-intl";
import type { ReactElement } from "react";
import { InfoBubble } from "@/components/wizard/InfoBubble";
import { RadioCards } from "@/components/wizard/RadioCards";
import { YesNo } from "@/components/wizard/YesNo";
import {
  buildBackupPlan,
  costMultimodalSizing,
  type Backup,
  type BackupCriticality,
  type BackupPriceTable,
  type BackupStorageTier,
  type ErasurePolicy,
  type MultimodalPriceTable,
  type Profile,
  type VectorBackupStrategy,
} from "@/lib/engine";
import { getBackupPrices } from "@/lib/pricing/backup-seed";
import { getMediaPricesEur } from "@/lib/pricing/media-feed";
import type { Option } from "@/lib/wizard/options";
import { cn } from "@/lib/utils/cn";

type BackupBlockProps = {
  profile: Profile;
  onChange: (backup: Backup) => void;
  /** Prix médias € (réutilisés pour le stockage chaud + le dimensionnement). Injectable (tests). */
  prices?: MultimodalPriceTable;
  /** Prix backup € (egress/archive/hors-site). Injectable (tests). */
  backupPrices?: BackupPriceTable;
};

type BackupT = ReturnType<typeof useTranslations<"Wizard.backup">>;

function criticalityOptions(t: BackupT): Option<BackupCriticality>[] {
  return [
    { value: "none", label: t("criticality.none"), hint: t("criticality.noneHint") },
    { value: "standard", label: t("criticality.standard"), hint: t("criticality.standardHint") },
    { value: "high", label: t("criticality.high"), hint: t("criticality.highHint") },
    { value: "critical", label: t("criticality.critical"), hint: t("criticality.criticalHint") },
  ];
}

function tierOptions(t: BackupT): Option<BackupStorageTier>[] {
  return [
    { value: "hot", label: t("tier.hot"), hint: t("tier.hotHint") },
    { value: "cold", label: t("tier.cold"), hint: t("tier.coldHint") },
  ];
}

function vectorOptions(t: BackupT): Option<VectorBackupStrategy>[] {
  return [
    { value: "auto", label: t("vector.auto"), hint: t("vector.autoHint") },
    { value: "backup", label: t("vector.backup") },
    { value: "reembed", label: t("vector.reembed"), hint: t("vector.reembedHint") },
  ];
}

function erasureOptions(t: BackupT): Option<ErasurePolicy>[] {
  return [
    { value: "expiration", label: t("erasure.expiration"), hint: t("erasure.expirationHint") },
    { value: "crypto-shred", label: t("erasure.cryptoShred"), hint: t("erasure.cryptoShredHint") },
  ];
}

/** Bascule Oui/Non AVEC label visible (l'`ariaLabel` seul laissait des « Oui/Non » nus, S-... fix). */
function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}): ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 text-body-sm text-on-surface-variant">
      <span>{label}</span>
      <YesNo ariaLabel={label} value={value} onChange={onChange} />
    </div>
  );
}

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
          "w-28 rounded-input bg-surface-container px-3 py-1.5 text-end font-mono text-on-surface",
          "ring-1 ring-outline/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        )}
      />
    </label>
  );
}

export function BackupBlock({
  profile,
  onChange,
  prices = getMediaPricesEur(),
  backupPrices = getBackupPrices(),
}: BackupBlockProps): ReactElement {
  const t = useTranslations("Wizard.backup");
  const b: Backup = profile.backup ?? { criticality: "none" };
  const update = (patch: Partial<Backup>): void => onChange({ ...b, ...patch });

  // Aperçu live + valeurs effectives (intègrent les défauts dérivés et la surcharge conformité).
  const sizing = costMultimodalSizing(profile, prices);
  const plan = buildBackupPlan(profile, sizing, prices.storagePerGbMonth, backupPrices);
  const monthly = Math.round(plan.monthlyCost);
  const setup = Math.round(plan.setupCost);
  const isNone = b.criticality === "none";

  return (
    <div className="space-y-4">
      <fieldset className="border-0 p-0">
        <legend className="mb-2 flex items-center gap-2 text-label-caps uppercase text-on-surface-variant">
          {t("criticalityLegend")}
          <InfoBubble label={t("criticalityLegend")} why={t("criticalityInfo.why")} consequence={t("criticalityInfo.consequence")} />
        </legend>
        <RadioCards value={b.criticality} options={criticalityOptions(t)} onChange={(criticality) => update({ criticality })} />
      </fieldset>

      {!isNone ? (
        <details className="rounded-card border border-outline-variant p-4">
          <summary className="cursor-pointer text-body-sm font-medium text-on-surface">{t("expert")}</summary>
          <div className="mt-4 space-y-4">
            <fieldset className="border-0 p-0">
              <legend className="mb-2 text-label-caps uppercase text-on-surface-variant">{t("tierLegend")}</legend>
              <RadioCards value={plan.tier} options={tierOptions(t)} onChange={(tier) => update({ tier })} />
            </fieldset>
            <fieldset className="border-0 p-0">
              <legend className="mb-2 text-label-caps uppercase text-on-surface-variant">{t("vectorLegend")}</legend>
              <RadioCards
                value={b.vectorStrategy ?? "auto"}
                options={vectorOptions(t)}
                onChange={(vectorStrategy) => update({ vectorStrategy })}
              />
              <p className="mt-1 text-body-sm text-on-surface-variant/80">{t("vectorDecision", { strategy: plan.vector.strategy })}</p>
            </fieldset>
            <fieldset className="border-0 p-0">
              <legend className="mb-2 text-label-caps uppercase text-on-surface-variant">{t("erasureLegend")}</legend>
              <RadioCards value={plan.erasurePolicy} options={erasureOptions(t)} onChange={(erasurePolicy) => update({ erasurePolicy })} />
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2">
              <NumberRow label={t("rpo")} value={plan.rpoMinutes} min={0} onChange={(rpoMinutes) => update({ rpoMinutes })} />
              <NumberRow label={t("rto")} value={plan.rtoMinutes} min={0} onChange={(rtoMinutes) => update({ rtoMinutes })} />
              <NumberRow label={t("retention")} value={plan.retentionDays} min={0} onChange={(retentionDays) => update({ retentionDays })} />
              <NumberRow label={t("copies")} value={plan.copies} min={1} onChange={(copies) => update({ copies })} />
              <NumberRow
                label={t("restoreTests")}
                value={plan.restoreTestsPerYear}
                min={0}
                onChange={(restoreTestsPerYear) => update({ restoreTestsPerYear })}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ToggleRow label={t("offsiteAria")} value={plan.offsite} onChange={(offsite) => update({ offsite })} />
              <ToggleRow label={t("airgapAria")} value={plan.airgap} onChange={(airgap) => update({ airgap })} />
              <ToggleRow label={t("immutableAria")} value={plan.immutable} onChange={(immutable) => update({ immutable })} />
              <ToggleRow label={t("byokAria")} value={plan.byok} onChange={(byok) => update({ byok })} />
            </div>
          </div>
        </details>
      ) : null}

      {/* Aperçu live, factuel (le détail des coûts est sur la page résultats). */}
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
                criticality: plan.criticality,
                copies: plan.copies,
                offsite: plan.offsite ? t("previewOffsite") : "",
                airgap: plan.airgap ? t("previewAirgap") : "",
                immutable: plan.immutable ? t("previewImmutable") : "",
                retention: plan.retentionDays,
                vector: plan.vector.strategy,
              })}
            </p>
            <p className="mt-1 text-on-surface-variant/80">{t("previewDisclaimer")}</p>
          </>
        )}
      </div>
    </div>
  );
}
