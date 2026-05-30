import { useTranslations } from "next-intl";
import type { ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import type { Region, ResidencyPlan, TransferFlag } from "@/lib/engine";

type ResidencyPanelProps = {
  plan: ResidencyPlan;
};

const REGION_KEY: Record<Region, "regionEu" | "regionMaroc" | "regionUs" | "regionOther"> = {
  eu: "regionEu",
  maroc: "regionMaroc",
  us: "regionUs",
  other: "regionOther",
};

const STATUS_META: Record<TransferFlag["status"], { icon: string; labelKey: "statusOk" | "statusRestricted" | "statusForbidden"; tone: string }> = {
  ok: { icon: "✅", labelKey: "statusOk", tone: "text-primary" },
  restricted: { icon: "⚠️", labelKey: "statusRestricted", tone: "text-tertiary" },
  forbidden: { icon: "⛔", labelKey: "statusForbidden", tone: "text-error" },
};

/**
 * Panneau Résidence & transferts (S-048, spec n°2 §9) : topologie des régions, conformité des flux
 * inter-juridiction (pastilles autorisé/encadré/interdit + base légale datée), RPO/RTO régionaux et
 * alerte de conflit. Rendu uniquement si une continuité régionale est dérivée (DR ≠ none) ou si des
 * transferts sont à signaler. Disclaimer « ingénierie, pas un avis juridique » systématique.
 */
export function ResidencyPanel({ plan }: ResidencyPanelProps): ReactElement | null {
  const t = useTranslations("Results.residencyPanel");
  const hasDr = plan.drTier !== "none" || plan.activeActive;
  if (!hasDr && plan.transfers.length === 0 && !plan.conflict.hasConflict) return null;

  const continuityMode = plan.activeActive
    ? t("modeActiveActive")
    : plan.drTier === "none"
      ? t("modeNone")
      : t("modeDr", { tier: plan.drTier });

  return (
    <Card>
      <h3 className="font-display text-headline-md text-on-surface">{t("title")}</h3>
      <p className="mt-1 text-body-sm text-on-surface-variant">{t("intro")}</p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-label-caps uppercase text-on-surface-variant">{t("primaryRegion")}</dt>
          <dd className="text-body-md text-on-surface">{t(REGION_KEY[plan.primaryRegion])}</dd>
        </div>
        <div>
          <dt className="text-label-caps uppercase text-on-surface-variant">{t("continuity")}</dt>
          <dd className="text-body-md text-on-surface">
            {t("continuityValue", { mode: continuityMode, rpo: plan.rpoMinutes, rto: plan.rtoMinutes })}
          </dd>
        </div>
      </dl>

      {plan.transfers.length > 0 ? (
        <div className="mt-4">
          <p className="text-label-caps uppercase text-on-surface-variant">{t("transfersTitle")}</p>
          <ul className="mt-2 space-y-2">
            {plan.transfers.map((transfer) => {
              const meta = STATUS_META[transfer.status];
              return (
                <li key={`${transfer.from}-${transfer.to}`} className="rounded-card bg-surface-container p-3 text-body-sm">
                  <p className="flex items-center gap-2">
                    <span aria-hidden="true">{meta.icon}</span>
                    <span className="text-on-surface">
                      {t(REGION_KEY[transfer.from])} → {t(REGION_KEY[transfer.to])}
                    </span>
                    <span className={meta.tone}>· {t(meta.labelKey)}</span>
                  </p>
                  <p className="mt-1 text-on-surface-variant">
                    <span className="font-medium text-on-surface">{t("legalBasis")}</span>
                    {transfer.legalBasis}
                  </p>
                  {transfer.note !== "" ? <p className="mt-1 text-on-surface-variant/80">{transfer.note}</p> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : hasDr ? (
        <p className="mt-4 text-body-sm text-on-surface-variant">{t("noTransfers")}</p>
      ) : null}

      {plan.conflict.hasConflict ? (
        <div className="mt-4 rounded-card border border-error/40 bg-error/5 p-4 text-body-sm" role="alert">
          <p className="font-medium text-error">{t("conflictTitle")}</p>
          <p className="mt-1 text-on-surface-variant">{plan.conflict.reason}</p>
          <p className="mt-2 text-on-surface">{t("conflictLevers")}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-on-surface-variant">
            {plan.conflict.levers.map((lever) => (
              <li key={lever}>{lever}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
