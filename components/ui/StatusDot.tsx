import type { ReactElement } from "react";
import { cn } from "@/lib/utils/cn";

/** Niveau de confiance d'une donnée chiffrée (cf. calibration ±30 % : 🟢🟡🟠). */
export type Confidence = "high" | "medium" | "low";

const CONFIDENCE_META: Record<Confidence, { dot: string; label: string }> = {
  high: { dot: "bg-primary-container", label: "Vérifié sur la doc vendor" },
  medium: { dot: "bg-tertiary-container", label: "Estimation (à confirmer)" },
  low: { dot: "bg-error", label: "Estimation à challenger" },
};

type StatusDotProps = {
  confidence: Confidence;
  showLabel?: boolean;
  className?: string;
};

/** Pastille de confiance + libellé accessible (toujours présent pour les lecteurs d'écran). */
export function StatusDot({
  confidence,
  showLabel = false,
  className,
}: StatusDotProps): ReactElement {
  const meta = CONFIDENCE_META[confidence];
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={cn("h-2.5 w-2.5 rounded-full", meta.dot)} aria-hidden="true" title={`Confiance : ${meta.label}`} />
      {showLabel ? (
        <span className="text-body-sm text-on-surface-variant">{meta.label}</span>
      ) : (
        <span className="sr-only">{meta.label}</span>
      )}
    </span>
  );
}
