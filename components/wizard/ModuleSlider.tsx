"use client";

import type { ReactElement } from "react";
import type { EngineModule } from "@/lib/engine";

type ModuleSliderProps = {
  module: EngineModule;
  level: number;
  onChange: (level: number) => void;
};

/** Curseur d'intensité d'un module avancé (0 = désactivé → maxLevel). */
export function ModuleSlider({ module, level, onChange }: ModuleSliderProps): ReactElement {
  const safeLevel = Math.min(Math.max(level, 0), module.maxLevel);
  const current = module.levels[safeLevel];
  const cost = Math.round((module.costFull * safeLevel) / module.maxLevel);

  return (
    <div className="rounded-card border border-outline-variant bg-surface-container-lowest p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display font-semibold text-on-surface">{module.name}</span>
        <span className="font-mono text-body-sm text-on-surface-variant">
          {cost > 0 ? `+${cost} €/mois` : "+0 €"}
        </span>
      </div>
      <p className="mt-1 text-body-sm text-on-surface-variant">{module.why}</p>
      <input
        type="range"
        min={0}
        max={module.maxLevel}
        step={1}
        value={safeLevel}
        aria-label={`Intensité de « ${module.name} »`}
        onChange={(e) => onChange(Number.parseInt(e.target.value, 10))}
        className="mt-4 w-full accent-primary"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-label-caps uppercase text-primary">
          Niveau {safeLevel}/{module.maxLevel} — {current.label}
        </span>
      </div>
      <p className="mt-1 text-body-sm text-on-surface-variant">{current.desc}</p>
    </div>
  );
}
