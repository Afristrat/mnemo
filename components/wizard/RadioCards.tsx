"use client";

import type { ReactElement } from "react";
import { cn } from "@/lib/utils/cn";
import type { Option } from "@/lib/wizard/options";

type RadioCardsProps<T extends string> = {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
};

/** Sélection unique sous forme de cartes cliquables. */
export function RadioCards<T extends string>({
  value,
  options,
  onChange,
}: RadioCardsProps<T>): ReactElement {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-card border p-4 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              selected
                ? "border-primary bg-primary/5"
                : "border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low",
            )}
          >
            <span className="block font-medium text-on-surface">{opt.label}</span>
            {opt.hint !== undefined ? (
              <span className="mt-1 block text-body-sm text-on-surface-variant">{opt.hint}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
