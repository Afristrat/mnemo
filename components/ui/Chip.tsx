import type { HTMLAttributes, ReactElement } from "react";
import { cn } from "@/lib/utils/cn";

type ChipTone = "primary" | "secondary" | "tertiary" | "error" | "neutral";

type ChipProps = HTMLAttributes<HTMLSpanElement> & { tone?: ChipTone };

const TONE_CLASSES: Record<ChipTone, string> = {
  primary: "bg-primary/10 text-primary",
  secondary: "bg-secondary/10 text-secondary",
  tertiary: "bg-tertiary/10 text-tertiary",
  error: "bg-error/10 text-error",
  neutral: "bg-surface-container-high text-on-surface-variant",
};

/** Puce de statut : version basse-opacité d'une couleur + texte contrasté. */
export function Chip({ tone = "neutral", className, ...props }: ChipProps): ReactElement {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-label-caps uppercase",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
}
