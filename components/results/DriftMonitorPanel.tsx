"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useEngineText } from "@/lib/i18n/engine";
import { reconcileDrift, type DriftReport, type DriftStatus } from "@/lib/drift/reconcile";
import type { Profile, Recommendation } from "@/lib/engine";

// Drift Monitor (moat « chaîne de preuve », vague 2 #7) : l'infra déployée est-elle TOUJOURS la reco signée ?
// DÉFCON 1 : Strate ne lit pas l'infra → elle réconcilie le manifeste signé (reco affichée) avec l'état
// vivant que le client colle (live-state.json produit par une commande d'introspection fournie).

type DriftMonitorPanelProps = { profile: Profile; recommendation: Recommendation };

const STATUS_META: Record<DriftStatus, { icon: string; tone: string; key: "statusAligned" | "statusDrifted" | "statusMissing" | "statusUnexpected" }> = {
  aligned: { icon: "✅", tone: "text-primary", key: "statusAligned" },
  drifted: { icon: "⚠️", tone: "text-tertiary", key: "statusDrifted" },
  missing: { icon: "⛔", tone: "text-error", key: "statusMissing" },
  unexpected: { icon: "❔", tone: "text-on-surface-variant", key: "statusUnexpected" },
};

export function DriftMonitorPanel({ profile, recommendation }: DriftMonitorPanelProps): ReactElement {
  const t = useTranslations("Results.driftMonitor");
  const resolve = useEngineText();
  const [raw, setRaw] = useState("");
  const [report, setReport] = useState<DriftReport | null>(null);
  const [busy, setBusy] = useState(false);

  const buildManifest = async () => {
    const { buildExitBundle } = await import("@/lib/exit/bundle");
    return buildExitBundle(profile, recommendation, undefined, undefined, resolve).manifest;
  };

  const check = async (): Promise<void> => {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    const manifest = await buildManifest();
    setReport(reconcileDrift(manifest, parsed, new Date().toISOString()));
  };

  const downloadEvidence = async (): Promise<void> => {
    if (report === null) return;
    setBusy(true);
    try {
      const { buildDriftEvidence } = await import("@/lib/drift/evidence");
      const { markdown } = await buildDriftEvidence(report);
      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "preuve-conformite-deploiement.md";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h2 className="font-display text-headline-md text-on-surface">{t("title")}</h2>
      <p className="mt-1 max-w-2xl text-body-sm text-on-surface-variant">{t("intro")}</p>

      <div className="mt-4 rounded-card bg-surface-container p-4">
        <p className="text-label-caps uppercase text-on-surface-variant">{t("probeTitle")}</p>
        <p className="mt-1 text-body-sm text-on-surface-variant">{t("probeHint")}</p>
        <pre className="mt-2 overflow-x-auto rounded-input bg-surface p-3 font-mono text-xs text-on-surface">{t("probeCommand")}</pre>
      </div>

      <div className="mt-4">
        <label htmlFor="drift-state" className="text-label-caps uppercase text-on-surface-variant">{t("verifyTitle")}</label>
        <textarea
          id="drift-state"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={5}
          placeholder={t("verifyPlaceholder")}
          className="mt-2 w-full rounded-card border border-outline-variant bg-surface p-3 font-mono text-xs text-on-surface"
        />
        <Button variant="primary" onClick={() => void check()} disabled={raw.trim() === ""} className="mt-2">
          {t("verifyButton")}
        </Button>
      </div>

      {report !== null ? (
        <div
          className={`mt-4 rounded-card border p-4 text-body-sm ${report.inSync ? "border-primary/40 bg-primary/5" : "border-tertiary/40 bg-tertiary/5"}`}
          role="status"
        >
          <p className={`font-medium ${report.inSync ? "text-primary" : "text-tertiary"}`}>
            {report.inSync ? t("resultInSync") : t("resultDrift")}
          </p>
          <p className="mt-1 text-on-surface-variant">
            {t("resultLine", { aligned: report.alignedCount, drift: report.driftCount, violations: report.constraintViolations.length })}
          </p>
          <ul className="mt-2 space-y-1">
            {report.items
              .filter((i) => i.status !== "aligned")
              .map((i) => {
                const meta = STATUS_META[i.status];
                return (
                  <li key={i.id} className="flex flex-wrap items-center gap-2">
                    <span aria-hidden="true">{meta.icon}</span>
                    <span className="text-on-surface">C{i.id} {i.label}</span>
                    <span className={meta.tone}>· {t(meta.key)}</span>
                    <span className="font-mono text-xs text-on-surface-variant">{i.expected ?? "—"} → {i.actual ?? "—"}</span>
                  </li>
                );
              })}
          </ul>
          {report.constraintViolations.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 ps-5 text-error">
              {report.constraintViolations.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          ) : null}
          <Button variant="secondary" onClick={() => void downloadEvidence()} disabled={busy} className="mt-3">
            {busy ? t("generating") : t("downloadEvidence")}
          </Button>
        </div>
      ) : null}
      <p className="mt-2 text-body-sm text-on-surface-variant/80">{t("disclaimer")}</p>
    </Card>
  );
}
