"use client";

import { useTranslations } from "next-intl";
import { useMemo, type ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { computeExitCost } from "@/lib/exit-cost/meter";
import { getResidencyPrices } from "@/lib/pricing/residency-seed";
import type { Profile, Recommendation } from "@/lib/engine";

// Lock-in / Exit-Cost Meter (moat « chaîne de preuve », vague 2 #4) : chiffre le COÛT DE SORTIE à côté du
// coût mensuel. DÉFCON 1 : egress chiffré depuis une source datée ; frais d'API + engagement « à confirmer »,
// jamais fabriqués. Rend visible l'asymétrie de sortie que les plateformes masquent (moat défensif).

type ExitCostPanelProps = { profile: Profile; recommendation: Recommendation };

export function ExitCostPanel({ profile, recommendation }: ExitCostPanelProps): ReactElement {
  const t = useTranslations("Results.exitCost");
  const cost = useMemo(
    () => computeExitCost(recommendation, profile, getResidencyPrices()),
    [recommendation, profile],
  );

  return (
    <Card>
      <h2 className="font-display text-headline-md text-on-surface">{t("title")}</h2>
      <p className="mt-1 max-w-2xl text-body-sm text-on-surface-variant">{t("intro")}</p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-card bg-surface-container p-4">
          <dt className="text-label-caps uppercase text-on-surface-variant">{t("egressTitle")}</dt>
          <dd className="mt-1 font-mono text-headline-sm text-on-surface">
            {cost.egressSourced ? t("egressValue", { cost: cost.exitEgressCost, gb: cost.storageGb }) : t("egressUnsourced")}
          </dd>
          {cost.monthsEquivalent !== null ? (
            <dd className="mt-1 text-body-sm text-on-surface-variant">{t("monthsEquivalent", { months: cost.monthsEquivalent })}</dd>
          ) : null}
        </div>
        <div className="rounded-card bg-surface-container p-4">
          <dt className="text-label-caps uppercase text-on-surface-variant">{t("toConfirmTitle")}</dt>
          <dd className="mt-1 text-body-sm text-on-surface">· {t("apiFees")}</dd>
          <dd className="text-body-sm text-on-surface">· {t("minCommitment")}</dd>
        </div>
      </dl>

      {cost.egressSource !== null ? (
        <p className="mt-3 text-body-sm text-on-surface-variant/80">
          {t("source")}{" "}
          <a href={cost.egressSource.url} target="_blank" rel="noreferrer" className="text-secondary underline decoration-dotted">
            {cost.egressSource.label}
          </a>{" "}
          <span className="font-mono">({cost.egressSource.checkedAt})</span>
        </p>
      ) : null}
      <p className="mt-2 text-body-sm text-on-surface-variant/80">{t("disclaimer")}</p>
    </Card>
  );
}
