"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState, type ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { useEngineText } from "@/lib/i18n/engine";
import { buildDecisionRecord } from "@/lib/decision/record";
import { computeIntegrityHash } from "@/lib/decision/integrity";
import { renderDecisionRecordMarkdown } from "@/lib/decision/render";
import type { Ensemble } from "@/lib/engine/ensemble";
import type { Profile } from "@/lib/engine";

// Decision Record opposable (moat vague 2 #1) : fige la décision + les alternatives ÉCARTÉES (membres de
// l'ensemble) + les tensions, en un dossier horodaté et HACHÉ (SHA-256) → artefact vérifiable et rejouable.
// Le dossier est figé À L'INSTANT du téléchargement (horodatage + empreinte calculés au clic). DÉFCON 1 :
// pure agrégation de ce que le moteur a produit, aucune donnée fabriquée.

type DecisionRecordPanelProps = { profile: Profile; ensemble: Ensemble };

export function DecisionRecordPanel({ profile, ensemble }: DecisionRecordPanelProps): ReactElement {
  const t = useTranslations("Results.decisionRecord");
  const resolve = useEngineText();
  const [downloading, setDownloading] = useState(false);

  // Aperçu (sans figer date/hash) : ce que le moteur a considéré et pourquoi.
  const preview = useMemo(
    () => buildDecisionRecord({ profile, ensemble, generatedAt: "", resolve }),
    [profile, ensemble, resolve],
  );

  const download = async (): Promise<void> => {
    setDownloading(true);
    try {
      const record = buildDecisionRecord({ profile, ensemble, generatedAt: new Date().toISOString(), resolve });
      const hash = await computeIntegrityHash(record);
      const md = renderDecisionRecordMarkdown(record, hash, (key, values) => t(key, values));
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "dossier-de-decision.md";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card>
      <h3 className="font-display text-headline-md text-on-surface">{t("title")}</h3>
      <p className="mt-1 text-body-sm text-on-surface-variant">{t("intro")}</p>

      <p className="mt-4 text-body-sm text-on-surface">
        <span className="font-medium">{t("decisionLabel")}</span>{" "}
        {t("decisionValue", { preset: preview.decision.preset, cost: preview.decision.monthlyCost })}
      </p>

      {preview.alternatives.length > 0 ? (
        <div className="mt-3">
          <p className="text-label-caps uppercase text-on-surface-variant">{t("alternativesTitle")}</p>
          <ul className="mt-1 space-y-1 text-body-sm text-on-surface-variant">
            {preview.alternatives.map((a) => (
              <li key={a.id}>
                <span className="text-on-surface">{a.label}</span> ·{" "}
                {t("altLine", { preset: a.preset, cost: a.monthlyCost, score: a.scoreAvg })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-3 text-body-sm text-on-surface-variant">
        <span className="font-medium text-on-surface">{t("tensionsTitle")} : </span>
        {t("agreementValue", { agreement: preview.tensions.agreement })} ·{" "}
        {t("risksCount", { count: preview.tensions.risks.length })}
      </p>

      <button
        type="button"
        onClick={() => void download()}
        disabled={downloading}
        className="mt-4 rounded-full bg-primary px-5 py-2 text-body-sm font-medium text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {downloading ? t("downloading") : t("download")}
      </button>
      <p className="mt-2 text-body-sm text-on-surface-variant/80">{t("integrityNote")}</p>
    </Card>
  );
}
