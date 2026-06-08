"use client";

import { useTranslations } from "next-intl";
import { useMemo, type ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { computeSlaAssessment, type ProviderSla } from "@/lib/sla/compose";
import { renderSlaMarkdown } from "@/lib/sla/render";
import type { Profile, Recommendation } from "@/lib/engine";

// SLA paramétrique (moat « chaîne de preuve », vague 3 — #5). Strate ne PROMET pas une disponibilité : il
// RAPPORTE les SLA PUBLIÉS des fournisseurs de la classe d'hébergement retenue (spectre, sourcé, daté) et
// les traduit en indisponibilité/mois. Modèle honnête « plancher = IaaS » (couches co-localisées). DÉFCON :
// auto-hébergé = aucun SLA tiers → on l'affiche clairement et on expose les IaaS managés en référence.

type SlaPanelProps = { profile: Profile; recommendation: Recommendation };

export function SlaPanel({ profile, recommendation }: SlaPanelProps): ReactElement {
  const t = useTranslations("Results.sla");
  const a = useMemo(() => computeSlaAssessment(profile, recommendation), [profile, recommendation]);
  const list = a.selfHosted ? a.reference : a.providers;
  const classLabel = t(`hostingClass.${a.hostingClass}`);

  const download = (): void => {
    const content = renderSlaMarkdown(a, (k, v) => t(k, v), classLabel);
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sla-parametrique.md";
    link.click();
    URL.revokeObjectURL(url);
  };

  const cell = (p: ProviderSla): ReactElement => (
    <tr key={p.id} className="border-t border-outline-variant">
      <td className="py-2 pr-3 text-on-surface">{p.name}</td>
      <td className="py-2 pr-3 text-on-surface-variant">{p.service}</td>
      <td className="py-2 pr-3 font-mono text-on-surface">{p.pct === null ? t("notPublished") : `${p.pct} %`}</td>
      <td className="py-2 pr-3 text-on-surface-variant">{t(p.mode === "ha" ? "modeHa" : "modeSingle")}</td>
      <td className="py-2 pr-3 font-mono text-on-surface-variant">
        {p.downtimeMinutes === null ? "—" : t("downtimePerMonth", { minutes: p.downtimeMinutes })}
      </td>
      <td className="py-2 text-body-sm">
        <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="text-secondary underline decoration-dotted">
          {t("sourceLink")}
        </a>{" "}
        <span className="font-mono text-on-surface-variant/80">({p.asOf})</span>
        {p.confidence === "medium" ? <span className="ml-1 text-tertiary">· {t("confMedium")}</span> : null}
      </td>
    </tr>
  );

  return (
    <Card>
      <h2 className="font-display text-headline-md text-on-surface">{t("title")}</h2>
      <p className="mt-1 max-w-2xl text-body-sm text-on-surface-variant">{t("intro")}</p>

      <p className="mt-3 text-body-sm text-on-surface">
        {t("hostingClassLine", { class: classLabel })}
        {a.range !== null ? ` ${t("rangeLine", { min: a.range.minPct, max: a.range.maxPct })}` : ""}
      </p>

      {a.selfHosted ? (
        <p className="mt-2 rounded-card bg-surface-container p-3 text-body-sm text-on-surface">{t("selfHostedNote")}</p>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-body-sm">
          <thead>
            <tr className="text-left text-label-caps uppercase text-on-surface-variant">
              <th className="pb-2 pr-3 font-medium">{t("colProvider")}</th>
              <th className="pb-2 pr-3 font-medium">{t("colService")}</th>
              <th className="pb-2 pr-3 font-medium">{t("colSla")}</th>
              <th className="pb-2 pr-3 font-medium">{t("colMode")}</th>
              <th className="pb-2 pr-3 font-medium">{t("colDowntime")}</th>
              <th className="pb-2 font-medium">{t("colSource")}</th>
            </tr>
          </thead>
          <tbody>{list.map(cell)}</tbody>
        </table>
      </div>
      {a.selfHosted ? <p className="mt-2 text-body-sm text-on-surface-variant/80">{t("referenceNote")}</p> : null}

      {a.coLocatedLayers.length > 0 ? (
        <p className="mt-4 text-body-sm text-on-surface-variant">{t("coLocatedNote")}</p>
      ) : null}

      <div className="mt-4">
        <Button variant="secondary" onClick={download}>
          {t("download")}
        </Button>
      </div>
      <p className="mt-3 text-body-sm text-on-surface-variant/80">{t("disclaimer")}</p>
    </Card>
  );
}
