import type { ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import type { Layer } from "@/lib/engine";
import { useEngineText } from "@/lib/i18n/engine";

type LayerStackProps = { layers: Layer[] };

/** Affiche la stack recommandée, une carte par couche C0→C6. */
export function LayerStack({ layers }: LayerStackProps): ReactElement {
  const resolveEngine = useEngineText();
  return (
    <div className="space-y-3">
      {layers.map((layer) => (
        <Card key={layer.id}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs text-white"
                style={{ backgroundColor: layer.color }}
              >
                C{layer.id}
              </span>
              <div>
                <h3 className="font-display text-headline-md text-on-surface">{resolveEngine(layer.name)}</h3>
                <p className="mt-1 font-mono text-code-md text-secondary">{layer.choice}</p>
              </div>
            </div>
            <span className="shrink-0 font-mono text-body-sm text-on-surface-variant">
              {layer.cost > 0 ? `${layer.cost} €/mois` : "inclus"}
            </span>
          </div>
          <p className="mt-3 text-body-sm text-on-surface-variant">{layer.note}</p>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            <span className="text-on-surface-variant/70">Alternatives :</span> {layer.alternatives}
          </p>
        </Card>
      ))}
    </div>
  );
}
