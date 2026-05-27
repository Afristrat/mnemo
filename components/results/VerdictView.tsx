"use client";

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
export function VerdictView({ verdict, preset, onExpert }: VerdictViewProps): ReactElement {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Chip tone="primary">Preset retenu : {preset}</Chip>
        <span className="text-body-sm text-on-surface-variant">Synthèse, le détail complet est sous « Voir le détail ».</span>
      </div>

      <h2 className="mt-4 font-display text-headline-lg text-on-surface">Votre verdict</h2>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <Box label="Le besoin">{verdict.pain}</Box>
        <Box label="Le risque sans rien faire">{verdict.risk}</Box>
        <Box label="Le gain">{verdict.gain}</Box>
      </dl>

      <div className="mt-6 divide-y divide-outline-variant">
        <CostLine label="Service Strate (prix ferme)" value={verdict.firmPriceTier} note="prix de vente, sondage en cours" />
        <CostLine
          label="Coût d'infrastructure (payé aux fournisseurs)"
          value={`${verdict.variableCostBand.low} – ${verdict.variableCostBand.high} €/mois`}
          note="±30 %, transparent, sourcé"
        />
        <CostLine
          label="Mise en route (une fois)"
          value={`${verdict.setupCostBand.low} – ${verdict.setupCostBand.high} €`}
          note="ingestion du backlog existant"
        />
      </div>

      <div className="mt-6 rounded-card bg-primary/5 p-4">
        <span className="text-label-caps uppercase text-primary">Prochaine étape</span>
        <p className="mt-1 text-body-md text-on-surface">{verdict.nextStep}</p>
      </div>

      <p className="mt-4 text-body-sm text-on-surface-variant">
        Coûts variables ±30 % selon volume et fournisseur, demandez un devis avant le go. Une IA peut se tromper :
        chaque coût est sourcé et daté dans le détail.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/configurateur" className="text-body-sm text-secondary underline decoration-dotted">
          Affiner mon profil (configurateur)
        </Link>
        <Button variant="secondary" onClick={onExpert}>
          Voir le détail (expert)
        </Button>
      </div>
    </Card>
  );
}
