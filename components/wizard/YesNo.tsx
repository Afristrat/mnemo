"use client";

import type { ReactElement } from "react";
import { cn } from "@/lib/utils/cn";

type YesNoProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  yesLabel?: string;
  noLabel?: string;
};

/** Choix binaire Oui / Non sous forme de cartes cliquables (remplace l'ancien Requirement à 3 états). */
export function YesNo({
  value,
  onChange,
  yesLabel = "Oui",
  noLabel = "Non",
}: YesNoProps): ReactElement {
  const options: { v: boolean; label: string }[] = [
    { v: true, label: yesLabel },
    { v: false, label: noLabel },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((opt) => {
        const selected = opt.v === value;
        return (
          <button
            key={opt.label}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(opt.v)}
            className={cn(
              "rounded-card border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              selected
                ? "border-primary bg-primary/5"
                : "border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low",
            )}
          >
            <span className="block font-medium text-on-surface">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
