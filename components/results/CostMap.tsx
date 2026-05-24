import type { ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { StatusDot } from "@/components/ui/StatusDot";
import { costBand, type ActiveModule, type Layer } from "@/lib/engine";
import { pricingForLayer } from "@/lib/pricing/sources";

type CostMapProps = {
  layers: Layer[];
  factorsCost: number;
  activeModules: ActiveModule[];
  totalCost: number;
};

/** Carte de coûts transparente : chaque poste avec confiance + source datée, total avec bande ±30 %. */
export function CostMap({ layers, factorsCost, activeModules, totalCost }: CostMapProps): ReactElement {
  const band = costBand(totalCost);

  return (
    <Card>
      <h3 className="font-display text-headline-md text-on-surface">Carte de coûts</h3>
      <p className="mt-1 text-body-sm text-on-surface-variant">
        Coûts cloud exposés, marge à découvert. Projection ±30 % — une IA peut se tromper.
      </p>

      <ul className="mt-4 divide-y divide-outline-variant">
        {layers
          .filter((l) => l.cost > 0)
          .map((layer) => {
            const pricing = pricingForLayer(layer.id);
            return (
              <li key={layer.id} className="flex items-center justify-between gap-4 py-2">
                <span className="flex items-center gap-2">
                  <StatusDot confidence={pricing.confidence} />
                  <span className="text-body-sm text-on-surface">{layer.name}</span>
                  {pricing.source !== null ? (
                    <a
                      href={pricing.source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-body-sm text-secondary underline decoration-dotted"
                    >
                      {pricing.source.label} ({pricing.source.checkedAt})
                    </a>
                  ) : null}
                </span>
                <span className="shrink-0 font-mono text-body-sm text-on-surface">{layer.cost} €</span>
              </li>
            );
          })}

        {factorsCost > 0 ? (
          <li className="flex items-center justify-between gap-4 py-2">
            <span className="flex items-center gap-2">
              <StatusDot confidence="medium" />
              <span className="text-body-sm text-on-surface">Volume / requêtes / utilisateurs</span>
            </span>
            <span className="shrink-0 font-mono text-body-sm text-on-surface">{factorsCost} €</span>
          </li>
        ) : null}

        {activeModules.map((mod) => (
          <li key={mod.id} className="flex items-center justify-between gap-4 py-2">
            <span className="flex items-center gap-2">
              <StatusDot confidence="medium" />
              <span className="text-body-sm text-on-surface">
                {mod.name} <span className="text-on-surface-variant">· niv. {mod.level}/{mod.maxLevel}</span>
              </span>
            </span>
            <span className="shrink-0 font-mono text-body-sm text-on-surface">{mod.cost} €</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center justify-between border-t border-outline-variant pt-4">
        <span className="font-display font-semibold text-on-surface">Total estimé</span>
        <span className="text-right">
          <span className="block font-mono text-headline-md text-primary">{totalCost} €/mois</span>
          <span className="block font-mono text-body-sm text-on-surface-variant">
            fourchette {band.low} – {band.high} €
          </span>
        </span>
      </div>
    </Card>
  );
}
