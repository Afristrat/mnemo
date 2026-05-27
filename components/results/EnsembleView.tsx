import type { ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import type { Ensemble, EnsembleAgreement } from "@/lib/engine";

const AGREEMENT_TONE: Record<EnsembleAgreement, "primary" | "tertiary" | "error"> = {
  fort: "primary",
  modéré: "tertiary",
  faible: "error",
};

type EnsembleViewProps = { ensemble: Ensemble };

/**
 * Section « ensemble multi-configuration » (F5) : plusieurs membres biaisés vers
 * une priorité différente, dont la dispersion (le spread) matérialise l'incertitude.
 */
export function EnsembleView({ ensemble }: EnsembleViewProps): ReactElement {
  const { variants, spread } = ensemble;
  // Bande d'incertitude rapportée au coût le plus élevé de l'ensemble.
  const bandLeft = spread.costMax > 0 ? (spread.costMin / spread.costMax) * 100 : 0;

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-headline-md text-on-surface">Ensemble de configurations</h2>
        <Chip tone={AGREEMENT_TONE[spread.agreement]}>Accord {spread.agreement}</Chip>
      </div>
      <p className="mt-1 max-w-2xl text-body-sm text-on-surface-variant">
        Comme une prévision météo d’ensemble : plutôt qu’une seule réponse, on explore plusieurs
        priorités. La dispersion de leurs résultats est la mesure honnête de l’incertitude. Ce sont des
        scénarios « et si », <strong>pas des choix imposés</strong> — votre recommandation reste celle détaillée ci-dessus.
      </p>

      {/* Bande d'incertitude de coût */}
      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-label-caps uppercase text-on-surface-variant">Fourchette de coût</span>
          <span className="font-mono text-body-md text-on-surface">
            {spread.costMin} – {spread.costMax} €/mois
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

      {/* Membres de l'ensemble */}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {variants.map((v) => (
          <div key={v.id} className="rounded-card border border-outline-variant p-4">
            <span className="text-label-caps uppercase text-on-surface-variant/70">Scénario</span>
            <div className="mt-1 flex items-center justify-between gap-2">
              <h3 className="font-display text-body-lg text-on-surface">{v.label}</h3>
              <Chip tone="neutral">{v.recommendation.preset}</Chip>
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="font-mono text-headline-md text-primary">
                {v.recommendation.totalCost} €
              </span>
              <span className="font-mono text-body-sm text-on-surface-variant">
                score {v.recommendation.scoreAvg}/10
              </span>
            </div>
            <p className="mt-2 text-body-sm text-on-surface-variant">{v.intent}</p>
            <ul className="mt-3 space-y-1 text-body-sm text-on-surface-variant">
              {v.assumptions.map((a) => (
                <li key={a} className="flex gap-2">
                  <span aria-hidden="true" className="text-on-surface-variant">·</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-4 text-body-sm text-on-surface-variant">
        Ces membres relâchent ou durcissent volontairement certaines hypothèses : ils ne remplacent
        pas votre profil, ils en bornent les conséquences. Une IA peut se tromper, chaque coût reste
        une projection sourcée (±30 %).
      </p>
    </Card>
  );
}
