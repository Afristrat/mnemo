"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, type ReactElement } from "react";
import type { Profile, Recommendation } from "@/lib/engine";
import { computeHealthScore, type HealthStatus } from "@/lib/monitoring/health";
import { deriveDeviationGuide } from "@/lib/monitoring/mel";
import { deriveHealthSignals } from "@/lib/monitoring/signals";
import { useEngineText } from "@/lib/i18n/engine";
import { fetchWithTimeout } from "@/lib/utils/fetchWithTimeout";

// Dashboard de santé (F12, S-081) : Infra Health Score (IHS, S-079) + guide de déviation MEL (S-080).
// Les signaux sont DÉRIVÉS de la recommandation (santé de conception, S-081) — les métriques
// d'exploitation réelles (disponibilité…) se branchent au déploiement. Calcul 100 % client (moteurs
// purs) ; un snapshot est posté à /api/monitoring pour l'audit (non bloquant).

function statusTextClass(status: HealthStatus): string {
  if (status === "ok") return "text-primary";
  if (status === "warn") return "text-tertiary";
  if (status === "critical") return "text-error";
  return "text-on-surface-variant";
}
function statusDotClass(status: HealthStatus): string {
  if (status === "ok") return "bg-primary";
  if (status === "warn") return "bg-tertiary";
  if (status === "critical") return "bg-error";
  return "bg-outline-variant";
}

export function MonitoringPanel({
  result,
  profile,
}: {
  result: Recommendation;
  profile: Profile;
}): ReactElement {
  const t = useTranslations("Monitoring");
  const tStatus = useTranslations("Engine.monitoring.health.status");
  const resolve = useEngineText();

  const report = useMemo(
    () => computeHealthScore(deriveHealthSignals({ scores: result.scores, totalCost: result.totalCost, budget: profile.budget })),
    [result.scores, result.totalCost, profile.budget],
  );
  const guide = useMemo(() => deriveDeviationGuide(report), [report]);

  useEffect(() => {
    // Audit non bloquant : on logue le relevé observé (jamais d'effet sur l'affichage en cas d'échec).
    void fetchWithTimeout("/api/monitoring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        score: report.score,
        status: report.status,
        measured: report.measured,
        total: report.total,
        subscores: report.subscores.map((s) => ({ dimension: s.dimension, score: s.score, status: s.status })),
      }),
      cache: "no-store",
    }).catch(() => {});
  }, [report]);

  return (
    <section className="rounded-card border border-outline-variant bg-surface-container-lowest p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-headline-md text-on-surface">{t("title")}</h3>
        <span className="flex items-center gap-2">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusDotClass(report.status)}`} aria-hidden />
          <span className={`font-mono text-headline-md ${statusTextClass(report.status)}`}>
            {report.score === null ? t("notMeasured") : `${report.score}/100`}
          </span>
        </span>
      </div>
      <p className="mt-1 text-body-sm text-on-surface-variant">{t("subtitle")}</p>
      <p className="mt-1 text-body-sm text-on-surface-variant">
        {t("coverage", { measured: report.measured, total: report.total })}
      </p>

      <ul className="mt-4 divide-y divide-outline-variant">
        {report.subscores.map((s) => (
          <li key={s.dimension} className="flex items-center justify-between gap-2 py-2">
            <span className="flex items-center gap-2 text-body-sm text-on-surface">
              <span className={`inline-block h-2 w-2 rounded-full ${statusDotClass(s.status)}`} aria-hidden />
              {resolve(s.label)}
            </span>
            <span className={`font-mono text-body-sm ${statusTextClass(s.status)}`}>
              {s.score === null ? t("notMeasured") : `${s.score}`}
            </span>
          </li>
        ))}
      </ul>

      {guide.length > 0 ? (
        <div className="mt-5">
          <p className="text-label-caps uppercase text-on-surface-variant">{t("melTitle")}</p>
          <ul className="mt-2 space-y-3">
            {guide.map((item) => (
              <li key={item.dimension} className="rounded-input border border-outline-variant p-3">
                <span className={`text-body-sm font-medium ${statusTextClass(item.status)}`}>{resolve(item.dispatchLabel)}</span>
                <p className="mt-1 text-body-sm text-on-surface">{resolve(item.guidance)}</p>
                <p className="mt-1 text-body-sm text-on-surface-variant">
                  {t("correctiveLabel")} {resolve(item.corrective)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-body-sm text-on-surface-variant">{t("allClear", { status: tStatus(report.status) })}</p>
      )}
    </section>
  );
}
