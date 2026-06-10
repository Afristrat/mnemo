"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { Profile, Recommendation } from "@/lib/engine";
import type { ExternalDriftReport } from "@/lib/evidence/external-drift";

// Feature B — drift externe : surveille en ligne tout changement matériel des composants de la reco signée
// depuis la date du jour (juridiction, incident SLA, dépréciation, rachat). DÉFCON 1 : faits sourcés seulement.

type Props = { profile: Profile; recommendation: Recommendation };

export function ExternalDriftPanel({ profile }: Props): ReactElement {
  const t = useTranslations("Results.externalDrift");
  const [report, setReport] = useState<ExternalDriftReport | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (): Promise<void> => {
    setBusy(true);
    try {
      const res = await fetch("/api/evidence/external-drift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, asOf: new Date().toISOString().slice(0, 10) }),
      });
      if (!res.ok) return;
      const json: unknown = await res.json();
      if (typeof json === "object" && json !== null && Array.isArray((json as { signals?: unknown }).signals)) {
        setReport(json as ExternalDriftReport);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h2 className="font-display text-headline-md text-on-surface">{t("title")}</h2>
      <p className="mt-1 max-w-2xl text-body-sm text-on-surface-variant">{t("intro")}</p>
      <Button variant="primary" onClick={() => void run()} disabled={busy} className="mt-3">
        {busy ? t("running") : t("runButton")}
      </Button>
      {report !== null ? (
        <div
          className={`mt-4 rounded-card border p-4 text-body-sm ${report.inSync ? "border-primary/40 bg-primary/5" : "border-tertiary/40 bg-tertiary/5"}`}
          role="status"
        >
          <p className={`font-medium ${report.inSync ? "text-primary" : "text-tertiary"}`}>
            {report.inSync ? t("resultInSync") : t("resultDrift")}
          </p>
          <p className="mt-1 text-on-surface-variant">
            {t("resultLine", { changed: report.changedCount, unknown: report.unknownCount })}
          </p>
          <ul className="mt-2 space-y-2">
            {report.signals
              .filter((s) => s.verdict !== "stable")
              .map((s) => (
                <li key={s.subject}>
                  <span className="text-on-surface">{s.subject}</span>{" "}
                  <span className="text-on-surface-variant">
                    · {s.verdict === "changed" ? t("verdictChanged") : t("verdictUnknown")}
                  </span>
                  {s.rationale !== "" ? <p className="text-on-surface-variant/80">{s.rationale}</p> : null}
                  {s.sources.map((src) => (
                    <a
                      key={src.url}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-primary underline"
                    >
                      {src.title || src.url}
                    </a>
                  ))}
                </li>
              ))}
          </ul>
        </div>
      ) : null}
      <p className="mt-2 text-body-sm text-on-surface-variant/80">{t("disclaimer")}</p>
    </Card>
  );
}
