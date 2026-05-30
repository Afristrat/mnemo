"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactElement } from "react";
import { Button } from "@/components/ui/Button";
import type { Catalog } from "@/lib/catalog";
import type { Ensemble, Profile, Recommendation } from "@/lib/engine";
import { useEngineText } from "@/lib/i18n/engine";
import { buildDeliverable } from "@/lib/export/model";
import { renderMarkdown } from "@/lib/export/markdown";

type ExportButtonsProps = {
  profile: Profile;
  recommendation: Recommendation;
  ensemble: Ensemble;
  /** Catalogue retenu, figé dans le livrable (provenance + sources + assembledAt) — S-037. */
  catalog?: Catalog;
};

function triggerDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function ExportButtons({ profile, recommendation, ensemble, catalog }: ExportButtonsProps): ReactElement {
  const [busy, setBusy] = useState(false);
  const resolveEngine = useEngineText();
  const tOptions = useTranslations("Options");
  const t = useTranslations("Results.exportButtons");

  const exportMarkdown = (): void => {
    const deliverable = buildDeliverable(profile, recommendation, ensemble, resolveEngine, tOptions, undefined, catalog);
    const blob = new Blob([renderMarkdown(deliverable)], { type: "text/markdown;charset=utf-8" });
    triggerDownload(`mnemo-plan-${deliverable.generatedAt}.md`, blob);
  };

  const exportPdf = async (): Promise<void> => {
    setBusy(true);
    try {
      // Import dynamique : jsPDF (~135 ko) reste hors du bundle initial de /resultats.
      const { pdfBlob } = await import("@/lib/export/pdf");
      const deliverable = buildDeliverable(profile, recommendation, ensemble, resolveEngine, tOptions, undefined, catalog);
      triggerDownload(`mnemo-plan-${deliverable.generatedAt}.pdf`, pdfBlob(deliverable));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="primary" onClick={exportMarkdown}>
        {t("markdown")}
      </Button>
      <Button variant="secondary" onClick={() => void exportPdf()} disabled={busy}>
        {busy ? t("generating") : t("pdf")}
      </Button>
    </div>
  );
}
