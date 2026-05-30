import { useTranslations } from "next-intl";
import type { ReactElement } from "react";
import { Chip } from "@/components/ui/Chip";
import { cn } from "@/lib/utils/cn";
import type { Ensemble, EnsembleAgreement, EnsembleVariantId } from "@/lib/engine";

type EnsembleT = ReturnType<typeof useTranslations<"Results.ensemble">>;

const AGREEMENT_TONE: Record<EnsembleAgreement, "primary" | "tertiary" | "error"> = {
  fort: "primary",
  modéré: "tertiary",
  faible: "error",
};

/** Une solution sélectionnable : la recommandation de référence (id null) ou un scénario. */
type SolutionCard = {
  id: EnsembleVariantId | null;
  kind: string;
  label: string;
  intent: string;
  assumptions: string[];
  preset: string;
  totalCost: number;
  scoreAvg: number;
};

type EnsembleViewProps = {
  ensemble: Ensemble;
  /** Solution affichée par toute la page : null = la recommandation de référence. */
  activeId: EnsembleVariantId | null;
  /** Bascule la page entière sur la solution choisie (recalcul). */
  onSelect: (id: EnsembleVariantId | null) => void;
};

function buildCards(ensemble: Ensemble, t: EnsembleT): SolutionCard[] {
  const baseline: SolutionCard = {
    id: null,
    kind: t("kindReco"),
    label: t("baselineLabel"),
    intent: t("baselineIntent"),
    assumptions: [],
    preset: ensemble.baseline.preset,
    totalCost: ensemble.baseline.totalCost,
    scoreAvg: ensemble.baseline.scoreAvg,
  };
  const variants = ensemble.variants.map<SolutionCard>((v) => ({
    id: v.id,
    kind: t("kindScenario"),
    label: v.label,
    intent: v.intent,
    assumptions: v.assumptions,
    preset: v.recommendation.preset,
    totalCost: v.recommendation.totalCost,
    scoreAvg: v.recommendation.scoreAvg,
  }));
  return [baseline, ...variants];
}

/**
 * Section « ensemble multi-configuration » (F5) : plusieurs solutions biaisées vers
 * une priorité différente, dont la dispersion (le spread) matérialise l'incertitude.
 * Chaque carte est sélectionnable : la choisir recalcule TOUTE la page sur elle
 * (couches, radar, coûts, export, Exit Escrow), sans jamais modifier le profil saisi.
 */
export function EnsembleView({ ensemble, activeId, onSelect }: EnsembleViewProps): ReactElement {
  const t = useTranslations("Results.ensemble");
  const { spread } = ensemble;
  // Bande d'incertitude rapportée au coût le plus élevé de l'ensemble.
  const bandLeft = spread.costMax > 0 ? (spread.costMin / spread.costMax) * 100 : 0;
  const cards = buildCards(ensemble, t);

  return (
    <section
      aria-label={t("aria")}
      className="rounded-card border border-outline-variant bg-surface-container-lowest p-6 shadow-elevation"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-headline-md text-on-surface">{t("title")}</h2>
        <Chip tone={AGREEMENT_TONE[spread.agreement]}>{t("agreement", { agreement: spread.agreement })}</Chip>
      </div>
      <p className="mt-1 max-w-2xl text-body-sm text-on-surface-variant">
        {t.rich("intro", { strong: (chunks) => <strong>{chunks}</strong> })}
      </p>

      {/* Bande d'incertitude de coût */}
      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-label-caps uppercase text-on-surface-variant">{t("costRange")}</span>
          <span className="font-mono text-body-md text-on-surface">
            {t("costRangeValue", { min: spread.costMin, max: spread.costMax })}
          </span>
        </div>
        <div className="mt-2 h-2 w-full rounded-full bg-surface-container">
          <div
            className="h-2 rounded-full bg-primary/70"
            style={{ marginLeft: `${bandLeft}%`, width: `${100 - bandLeft}%` }}
          />
        </div>
        <p className="mt-3 text-body-sm text-on-surface-variant">{spread.uncertaintyLabel}</p>
      </div>

      {/* Solutions sélectionnables : référence + scénarios */}
      <div
        role="group"
        aria-label={t("groupAria")}
        className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {cards.map((card) => {
          const isActive = card.id === activeId;
          return (
            <button
              key={card.id ?? "baseline"}
              type="button"
              onClick={() => onSelect(card.id)}
              aria-pressed={isActive}
              className={cn(
                "flex flex-col rounded-card border p-4 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                isActive
                  ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                  : "border-outline-variant hover:border-primary/60 hover:bg-surface-container/50",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-label-caps uppercase text-on-surface-variant/70">{card.kind}</span>
                {isActive ? (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-label-caps uppercase text-on-primary">
                    {t("displayed")}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <h3 className="font-display text-body-lg text-on-surface">{card.label}</h3>
                <Chip tone="neutral">{card.preset}</Chip>
              </div>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="font-mono text-headline-md text-primary">{card.totalCost} €</span>
                <span className="font-mono text-body-sm text-on-surface-variant">
                  {t("scoreLine", { score: card.scoreAvg })}
                </span>
              </div>
              <p className="mt-2 text-body-sm text-on-surface-variant">{card.intent}</p>
              {card.assumptions.length > 0 ? (
                <ul className="mt-3 space-y-1 text-body-sm text-on-surface-variant">
                  {card.assumptions.map((a) => (
                    <li key={a} className="flex gap-2">
                      <span aria-hidden="true" className="text-on-surface-variant">·</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-body-sm text-on-surface-variant">{t("footer")}</p>
    </section>
  );
}
