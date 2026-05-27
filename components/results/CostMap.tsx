import type { ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { StatusDot } from "@/components/ui/StatusDot";
import { costBand, type ActiveModule, type GpuTier, type Layer } from "@/lib/engine";
import { pricingForLayer } from "@/lib/pricing/sources";

/** Décomposition de l'apport multimédia (déjà inclus dans les couches C4/C5/C6), pour la transparence. */
export type MediaBreakdown = {
  gpuTier: GpuTier;
  gpuCost: number;
  storageGb: number;
  storageCost: number;
  embeddingsCost: number;
  apiLines: { label: string; cost: number }[];
};

type CostMapProps = {
  layers: Layer[];
  factorsCost: number;
  activeModules: ActiveModule[];
  totalCost: number;
  /** Coût one-time de mise en route (ingestion du backlog). Affiché en ligne séparée. */
  setupCost?: number;
  /** Décomposition multimédia (déjà comprise dans les couches), pastilles 🟢 souverain / 💳 API. */
  media?: MediaBreakdown;
};

/** Carte de coûts transparente : chaque poste avec confiance + source datée, total avec bande ±30 %. */
export function CostMap({ layers, factorsCost, activeModules, totalCost, setupCost = 0, media }: CostMapProps): ReactElement {
  const band = costBand(totalCost);
  const setupBand = costBand(setupCost);
  const hasMedia =
    media !== undefined && (media.gpuCost > 0 || media.storageCost > 0 || media.embeddingsCost > 0 || media.apiLines.length > 0);

  return (
    <Card>
      <h3 className="font-display text-headline-md text-on-surface">Carte de coûts</h3>
      <p className="mt-1 text-body-sm text-on-surface-variant">
        Coûts cloud exposés, marge à découvert. Projection ±30 %, une IA peut se tromper.
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

      {hasMedia && media !== undefined ? (
        <div className="mt-4 rounded-card bg-surface-container p-3">
          <p className="text-label-caps uppercase text-on-surface-variant">
            Apport multimédia <span className="normal-case">(déjà compris dans les couches ci-dessus)</span>
          </p>
          <ul className="mt-2 space-y-1.5">
            {media.gpuCost > 0 ? (
              <li className="flex items-center justify-between gap-3 text-body-sm">
                <span>🟢 Pool GPU souverain ({media.gpuTier}), compté une seule fois</span>
                <span className="font-mono text-on-surface">{media.gpuCost} €/mois</span>
              </li>
            ) : null}
            {media.embeddingsCost > 0 ? (
              <li className="flex items-center justify-between gap-3 text-body-sm">
                <span>🟢 Embeddings multimodaux (C4)</span>
                <span className="font-mono text-on-surface">{media.embeddingsCost} €/mois</span>
              </li>
            ) : null}
            {media.storageCost > 0 ? (
              <li className="flex items-center justify-between gap-3 text-body-sm">
                <span>🟢 Stockage médias (C5), {media.storageGb} Go</span>
                <span className="font-mono text-on-surface">{media.storageCost} €/mois</span>
              </li>
            ) : null}
            {media.apiLines.map((line) => (
              <li key={line.label} className="flex items-center justify-between gap-3 text-body-sm">
                <span>💳 {line.label}</span>
                <span className="font-mono text-on-surface">{line.cost} €/mois</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-body-sm text-on-surface-variant">
            Ces coûts varient fortement selon le volume et le fournisseur, demandez un devis avant le go.
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between border-t border-outline-variant pt-4">
        <span className="font-display font-semibold text-on-surface">Total estimé (récurrent)</span>
        <span className="text-right">
          <span className="block font-mono text-headline-md text-primary">{totalCost} €/mois</span>
          <span className="block font-mono text-body-sm text-on-surface-variant">
            fourchette {band.low} – {band.high} €
          </span>
        </span>
      </div>

      {setupCost > 0 ? (
        <div className="mt-2 flex items-center justify-between">
          <span className="text-body-sm text-on-surface-variant">Mise en route (une fois), ingestion du backlog</span>
          <span className="text-right">
            <span className="block font-mono text-body-md text-on-surface">{setupCost} €</span>
            <span className="block font-mono text-body-sm text-on-surface-variant">
              fourchette {setupBand.low} – {setupBand.high} €
            </span>
          </span>
        </div>
      ) : null}
    </Card>
  );
}
