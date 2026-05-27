"use client";

import type { ReactElement } from "react";
import type { RecapGroup } from "@/lib/wizard/recap";
import { cn } from "@/lib/utils/cn";

/** Récap des choix sous le budget-mètre (S-050) : valeurs effectives + marqueur d'impact coût. */
export function ChoiceRecap({ groups, className }: { groups: RecapGroup[]; className?: string }): ReactElement {
  return (
    <section
      className={cn("rounded-card bg-surface p-4 ring-1 ring-outline-variant/40", className)}
      aria-label="Récapitulatif de vos choix"
    >
      <h2 className="text-label-caps uppercase text-on-surface-variant">Vos choix</h2>
      <div className="mt-3 space-y-3">
        {groups.map((group) => (
          <div key={group.heading}>
            <h3 className="text-body-sm font-medium text-on-surface">{group.heading}</h3>
            <dl className="mt-1 space-y-1">
              {group.items.map((item) => (
                <div key={item.label} className="flex items-baseline justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
                    <span aria-hidden className={item.impactsCost ? "text-primary" : "text-on-surface-variant/50"}>
                      {item.impactsCost ? "●" : "○"}
                    </span>
                    {item.label}
                  </dt>
                  <dd className="text-right font-mono text-body-sm text-on-surface">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        <p className="text-body-sm text-on-surface-variant">
          <span aria-hidden className="text-primary">
            ●
          </span>{" "}
          influe sur le coût mensuel ·{" "}
          <span aria-hidden className="text-on-surface-variant/50">
            ○
          </span>{" "}
          oriente la stack, les scores ou la conformité (pas une ligne de coût directe).
        </p>
      </div>
    </section>
  );
}
