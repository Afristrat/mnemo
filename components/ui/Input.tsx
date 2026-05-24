import type { InputHTMLAttributes, ReactElement } from "react";
import { cn } from "@/lib/utils/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

/** Champ de saisie (DESIGN.md : rayon 10px ; focus → bordure primary + halo). */
export function Input({ className, ...props }: InputProps): ReactElement {
  return (
    <input
      className={cn(
        "w-full rounded-input border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md text-on-surface transition-colors placeholder:text-on-surface-variant focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        className,
      )}
      {...props}
    />
  );
}
