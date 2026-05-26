"use client";

import { useId, type ReactElement } from "react";
import type { Option } from "@/lib/wizard/options";
import { cn } from "@/lib/utils/cn";

type ContinuousSliderProps<T extends string> = {
  label: string;
  /** Paliers ordonnés du plus petit au plus grand. */
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

/**
 * Curseur « continu » qui glisse sur des paliers discrets ordonnés (volume, débit…). Accessible :
 * `aria-valuetext` annonce le palier courant en clair, et le libellé est relié via `aria-labelledby`.
 */
export function ContinuousSlider<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: ContinuousSliderProps<T>): ReactElement {
  const labelId = useId();
  const max = options.length - 1;
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const current = options[index];

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span id={labelId} className="text-label-caps uppercase text-on-surface-variant">
          {label}
        </span>
        <span className="font-mono text-body-sm text-on-surface">
          {current?.label}
          {current?.hint !== undefined ? <span className="text-on-surface-variant"> · {current.hint}</span> : null}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={index}
        aria-labelledby={labelId}
        aria-valuetext={current?.label}
        onChange={(e) => {
          const next = options[Number(e.target.value)];
          if (next !== undefined) onChange(next.value);
        }}
        className="w-full accent-primary"
      />
      <div className="flex justify-between text-body-sm text-on-surface-variant">
        <span>{options[0]?.label}</span>
        <span>{options[max]?.label}</span>
      </div>
    </div>
  );
}
