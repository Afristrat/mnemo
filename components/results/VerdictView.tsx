"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import type { ReactElement, ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import type { Preset, Verdict } from "@/lib/engine";

type VerdictViewProps = {
  verdict: Verdict;
  preset: Preset;
  /** Bascule vers le détail expert (même recommandation). */
  onExpert: () => void;
  /** true si les textes (besoin/risque/gain/étape) ont été adaptés par IA (chiffres inchangés). */
  narrated?: boolean;
};

function Box({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="rounded-card bg-surface-container p-4">
      <dt className="text-label-caps uppercase text-on-surface-variant">{label}</dt>
      <dd className="mt-1 text-body-md text-on-surface">{children}</dd>
    </div>
  );
}

function CostLine({ label, value, note }: { label: string; value: string; note?: string }): ReactElement {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-body-sm text-on-surface-variant">{label}</span>
      <span className="text-right">
        <span className="block font-mono text-body-md text-on-surface">{value}</span>
        {note !== undefined ? <span className="block text-body-sm text-on-surface-variant">{note}</span> : null}
      </span>
    </div>
  );
}

/**
 * Mode « verdict » (chemin 90 s) : synthèse factuelle d'une même `Recommendation`, douleur, risque,
 * gain (mesuré, jamais inventé), prix ferme du service ([PLACEHOLDER]), coût d'infra ±30 %, mise en
 * route, prochaine étape. Neutre : présente des faits + une fourchette, pas une injonction d'achat.
 */
export function VerdictView({ verdict, preset, onExpert, narrated = false }: VerdictViewProps): ReactElement {
  const t = useTranslations("VerdictView");
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Chip tone="primary">{t("presetRetained", { preset })}</Chip>
        {narrated ? (
          <Chip tone="neutral">{t("narrated")}</Chip>
        ) : (
          <span className="text-body-sm text-on-surface-variant">{t("synthesis")}</span>
        )}
      </div>

      <h2 className="mt-4 font-display text-headline-lg text-on-surface">{t("title")}</h2>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <Box label={t("pain")}>{verdict.pain}</Box>
        <Box label={t("risk")}>{verdict.risk}</Box>
        <Box label={t("gain")}>{verdict.gain}</Box>
      </dl>

      <div className="mt-6 divide-y divide-outline-variant">
        <CostLine label={t("firmPrice")} value={verdict.firmPriceTier} note={t("firmPriceNote")} />
        <CostLine
          label={t("infraCost")}
          value={`${verdict.variableCostBand.low} – ${verdict.variableCostBand.high} €/mois`}
          note={t("infraCostNote")}
        />
        <CostLine
          label={t("setup")}
          value={`${verdict.setupCostBand.low} – ${verdict.setupCostBand.high} €`}
          note={t("setupNote")}
        />
      </div>

      <div className="mt-6 rounded-card bg-primary/5 p-4">
        <span className="text-label-caps uppercase text-primary">{t("nextStep")}</span>
        <p className="mt-1 text-body-md text-on-surface">{verdict.nextStep}</p>
      </div>

      <p className="mt-4 text-body-sm text-on-surface-variant">{t("disclaimer")}</p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/configurateur" className="text-body-sm text-secondary underline decoration-dotted">
          {t("refine")}
        </Link>
        <Button variant="secondary" onClick={onExpert}>
          {t("expert")}
        </Button>
      </div>
    </Card>
  );
}
