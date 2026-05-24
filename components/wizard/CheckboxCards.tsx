"use client";

import type { ReactElement } from "react";
import { cn } from "@/lib/utils/cn";
import type { Option } from "@/lib/wizard/options";

type CheckboxCardsProps<T extends string> = {
  values: readonly T[];
  options: Option<T>[];
  onToggle: (value: T) => void;
};

/** Sélection multiple sous forme de cartes cliquables. */
export function CheckboxCards<T extends string>({
  values,
  options,
  onToggle,
}: CheckboxCardsProps<T>): ReactElement {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((opt) => {
        const selected = values.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            role="checkbox"
            aria-checked={selected}
            onClick={() => onToggle(opt.value)}
            className={cn(
              "flex items-start gap-3 rounded-card border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              selected
                ? "border-primary bg-primary/5"
                : "border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs",
                selected ? "border-primary bg-primary text-on-primary" : "border-outline",
              )}
            >
              {selected ? "✓" : ""}
            </span>
            <span>
              <span className="block font-medium text-on-surface">{opt.label}</span>
              {opt.hint !== undefined ? (
                <span className="mt-1 block text-body-sm text-on-surface-variant">{opt.hint}</span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
