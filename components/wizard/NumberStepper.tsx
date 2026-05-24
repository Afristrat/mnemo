"use client";

import type { ReactElement } from "react";
import { Button } from "@/components/ui/Button";

type NumberStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
};

/** Compteur numérique borné (ex. nombre d'utilisateurs). */
export function NumberStepper({
  value,
  onChange,
  min = 1,
  max = 100000,
  label,
}: NumberStepperProps): ReactElement {
  const clamp = (n: number): number => Math.min(max, Math.max(min, n));

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="secondary"
        size="sm"
        aria-label="Diminuer"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
      >
        −
      </Button>
      <input
        type="number"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const parsed = Number.parseInt(e.target.value, 10);
          onChange(Number.isNaN(parsed) ? min : clamp(parsed));
        }}
        className="w-24 rounded-input border border-outline-variant bg-surface-container-lowest px-3 py-2 text-center font-mono text-body-md text-on-surface focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      />
      <Button
        variant="secondary"
        size="sm"
        aria-label="Augmenter"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
      >
        +
      </Button>
    </div>
  );
}
