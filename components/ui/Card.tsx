import type { HTMLAttributes, ReactElement } from "react";
import { cn } from "@/lib/utils/cn";

type CardProps = HTMLAttributes<HTMLDivElement>;

/** Conteneur de données (DESIGN.md : rayon 14px, bordure 1px, élévation douce). */
export function Card({ className, ...props }: CardProps): ReactElement {
  return (
    <div
      className={cn(
        "rounded-card border border-outline-variant bg-surface-container-lowest p-6 shadow-elevation",
        className,
      )}
      {...props}
    />
  );
}
