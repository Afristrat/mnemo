"use client";

import { useTranslations } from "next-intl";
import type { ReactElement } from "react";
import type { Budget, Sizing } from "@/lib/engine";
import { evaluateBudget, type BudgetStatus } from "@/lib/wizard/budget";
import { cn } from "@/lib/utils/cn";

type BudgetMeterProps = {
  /** Coût mensuel d'infra (variable, ±30 %), jamais le prix de vente du service. */
  totalCost: number;
  budget: Budget;
  sizing: Sizing;
  /** Coût récurrent de sauvegarde (€/mois), pour la cause dominante du budget-mètre (S-030). */
  backupMonthlyCost?: number;
  className?: string;
};

const STATUS_META: Record<BudgetStatus, { labelKey: "statusOk" | "statusWarn" | "statusOver"; bar: string; ring: string; text: string }> = {
  ok: { labelKey: "statusOk", bar: "bg-primary", ring: "ring-primary/30", text: "text-on-surface" },
  warn: { labelKey: "statusWarn", bar: "bg-tertiary-container", ring: "ring-tertiary-container/50", text: "text-on-surface" },
  over: { labelKey: "statusOver", bar: "bg-error", ring: "ring-error/40", text: "text-error" },
};

/** Jauge vert/jaune/rouge comparant le coût d'infra au budget ; en tension : cause + levier (spec §8). */
export function BudgetMeter({ totalCost, budget, sizing, backupMonthlyCost = 0, className }: BudgetMeterProps): ReactElement {
  const t = useTranslations("Wizard.budgetMeter");
  const { status, ceiling, ratio, cause, lever } = evaluateBudget(totalCost, budget, sizing, backupMonthlyCost);
  const meta = STATUS_META[status];
  const unbounded = ceiling === Number.POSITIVE_INFINITY;
  const pct = unbounded ? 0 : Math.min(100, Math.round(ratio * 100));
  const ceilingLabel = unbounded ? t("noCeiling") : t("ceilingValue", { cost: ceiling });

  return (
    <div className={cn("rounded-card bg-surface p-4 ring-1", meta.ring, className)} role="status" aria-live="polite">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-label-caps uppercase text-on-surface-variant">{t("title")}</span>
        <span className="font-mono text-body-sm text-on-surface">
          {t("summary", { cost: totalCost, ceiling: ceilingLabel })}
        </span>
      </div>
      {!unbounded ? (
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-container">
          <div className={cn("h-full rounded-full transition-all", meta.bar)} style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      <p className={cn("mt-2 text-body-sm font-medium", meta.text)}>{t(meta.labelKey)}</p>
      {status === "over" && !unbounded ? (
        <p className="text-body-sm text-error">
          {t("over", { over: totalCost - ceiling, ceiling })}
        </p>
      ) : null}
      {status !== "ok" ? (
        <div className="mt-1 space-y-1 text-body-sm text-on-surface-variant">
          <p>
            <strong className="font-medium text-on-surface">{t("cause")}</strong>
            {cause}
          </p>
          <p>
            <strong className="font-medium text-on-surface">{t("lever")}</strong>
            {lever}
          </p>
        </div>
      ) : null}
    </div>
  );
}
