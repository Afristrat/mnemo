"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type ReactElement } from "react";
import { cn } from "@/lib/utils/cn";

type InfoBubbleProps = {
  /** Pourquoi ce paramètre compte (factuel, non orienté). */
  why: string;
  /** Conséquence concrète du choix (factuelle, non orientée). */
  consequence: string;
  /** Libellé accessible du déclencheur (ex. le nom du champ). */
  label: string;
  className?: string;
};

/**
 * Divulgation accessible « pourquoi + conséquence » à côté d'un champ. Présente une information
 * FACTUELLE et NON ORIENTÉE (l'utilisateur tranche), jamais une recommandation. Bouton « ? »
 * qui révèle/masque le contenu (disclosure pattern, aria-expanded + région reliée).
 */
export function InfoBubble({ why, consequence, label, className }: InfoBubbleProps): ReactElement {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const t = useTranslations("Wizard.infoBubble");

  return (
    <span className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t("trigger", { label })}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-5 w-5 items-center justify-center rounded-full text-label-caps",
          "bg-surface-container text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        )}
      >
        ?
      </button>
      {open ? (
        <span
          id={panelId}
          role="note"
          className={cn(
            "absolute left-0 top-7 z-10 w-72 rounded-card bg-surface p-3 shadow-elevation",
            "text-body-sm text-on-surface-variant ring-1 ring-outline/20",
          )}
        >
          <span className="block">
            <strong className="font-medium text-on-surface">{t("why")}</strong>
            {why}
          </span>
          <span className="mt-1 block">
            <strong className="font-medium text-on-surface">{t("consequence")}</strong>
            {consequence}
          </span>
        </span>
      ) : null}
    </span>
  );
}
