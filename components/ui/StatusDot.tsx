import { useTranslations } from "next-intl";
import type { ReactElement } from "react";
import { cn } from "@/lib/utils/cn";

/** Niveau de confiance d'une donnée chiffrée (cf. calibration ±30 % : 🟢🟡🟠). */
export type Confidence = "high" | "medium" | "low";

// La couleur de pastille est de la donnée (pas de prose) ; les libellés sont i18n (namespace `StatusDot`).
const CONFIDENCE_DOT: Record<Confidence, string> = {
  high: "bg-primary-container",
  medium: "bg-tertiary-container",
  low: "bg-error",
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
  const t = useTranslations("StatusDot");
  const label = t(confidence);
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={cn("h-2.5 w-2.5 rounded-full", CONFIDENCE_DOT[confidence])} aria-hidden="true" title={t("title", { label })} />
      {showLabel ? (
        <span className="text-body-sm text-on-surface-variant">{label}</span>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </span>
  );
}
