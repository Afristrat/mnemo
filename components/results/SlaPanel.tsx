"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { computeSlaAssessment, type ProviderSla } from "@/lib/sla/compose";
import { renderSlaMarkdown } from "@/lib/sla/render";
import type { ProviderStatus } from "@/lib/sla/status-feed";
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

  // Disponibilité OBSERVÉE : statut live des pages publiques des fournisseurs (incidents réels datés).
  // Non bloquant : un échec laisse la section vide, le SLA publié reste affiché.
  const [observed, setObserved] = useState<ProviderStatus[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/sla/status?class=${encodeURIComponent(a.hostingClass)}`);
        if (!res.ok) return;
        const data: { statuses?: ProviderStatus[] } = await res.json();
        if (!cancelled && Array.isArray(data.statuses)) setObserved(data.statuses);
      } catch {
        /* repli silencieux : la section observée reste masquée */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [a.hostingClass]);

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

      {observed !== null && observed.length > 0 ? (
        <div className="mt-6 border-t border-outline-variant pt-4">
          <h3 className="font-display text-title-md text-on-surface">{t("observedTitle")}</h3>
          <p className="mt-1 max-w-2xl text-body-sm text-on-surface-variant">{t("observedIntro")}</p>
          <ul className="mt-3 space-y-3">
            {observed.map((s) => (
              <li key={s.providerId} className="rounded-card bg-surface-container p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-on-surface">{s.providerName}</span>
                  <span
                    className={`text-label-caps uppercase ${
                      s.operational === false
                        ? "text-error"
                        : s.operational === true
                          ? "text-tertiary"
                          : "text-on-surface-variant"
                    }`}
                  >
                    {s.operational === false
                      ? t("statusIncident")
                      : s.operational === true
                        ? t("statusOk")
                        : t("statusUnknown")}
                  </span>
                  <span className="text-body-sm text-on-surface-variant/80">
                    · {t(s.provenance === "live" ? "provLive" : "provSeed")}
                  </span>
                </div>
                <p className="mt-1 text-body-sm text-on-surface-variant">
                  {s.recentIncidents.length === 0
                    ? t("noneLast90")
                    : t("incidentsLast90", { count: s.recentIncidents.length })}
                </p>
                {s.recentIncidents.length > 0 ? (
                  <p className="mt-1 text-body-sm text-on-surface">
                    {t("latestIncident", {
                      title: s.recentIncidents[0].title,
                      date: s.recentIncidents[0].startedAt.slice(0, 10),
                    })}
                  </p>
                ) : null}
                <a
                  href={s.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-body-sm text-secondary underline decoration-dotted"
                >
                  {t("observedSource")} <span className="font-mono text-on-surface-variant/80">({s.checkedAt})</span>
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-body-sm text-on-surface-variant/80">{t("observedDisclaimer")}</p>
        </div>
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
