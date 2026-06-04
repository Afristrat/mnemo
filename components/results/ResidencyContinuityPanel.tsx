"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState, type ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useEngineText } from "@/lib/i18n/engine";
import { auditResidencyContinuity, type ContinuityFlag } from "@/lib/residency/continuity";
import { buildResidencyEvidence } from "@/lib/residency/evidence";
import type { Recommendation } from "@/lib/engine";

// Preuve de résidence continue (moat « chaîne de preuve », vague 2 #3) : carte de résidence PAR COMPOSANT,
// drapeaux des sorties de zone, evidence pack haché téléchargeable. DÉFCON 1 : aucune juridiction fabriquée
// (un composant sans région pinnée = « à confirmer », jamais inventé).

type Props = { recommendation: Recommendation };

const FLAG_META: Record<
  ContinuityFlag,
  { icon: string; tone: string; key: "flagInZone" | "flagRestricted" | "flagOutOfZone" | "flagUnverified" }
> = {
  "in-zone": { icon: "✅", tone: "text-primary", key: "flagInZone" },
  restricted: { icon: "⚠️", tone: "text-tertiary", key: "flagRestricted" },
  "out-of-zone": { icon: "⛔", tone: "text-error", key: "flagOutOfZone" },
  unverified: { icon: "❔", tone: "text-on-surface-variant", key: "flagUnverified" },
};

export function ResidencyContinuityPanel({ recommendation }: Props): ReactElement {
  const t = useTranslations("Results.residencyContinuity");
  const resolve = useEngineText();
  const [busy, setBusy] = useState(false);

  // Aperçu live (sans figer la date) ; l'evidence pack fige date + hash au clic.
  const report = useMemo(() => auditResidencyContinuity(recommendation, ""), [recommendation]);

  const downloadEvidence = async (): Promise<void> => {
    setBusy(true);
    try {
      const dated = auditResidencyContinuity(recommendation, new Date().toISOString());
      const { markdown } = await buildResidencyEvidence(dated, resolve);
      // Persistance d'audit non bloquante (circle anonyme) — best effort, ne bloque jamais le téléchargement.
      void fetch("/api/legal/residency-continuity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: dated }),
        cache: "no-store",
      }).catch(() => undefined);
      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "preuve-residence-continue.md";
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
      <p className="mt-3 text-body-sm text-on-surface">
        {t("summary", { out: report.outOfZoneCount, unverified: report.unverifiedCount })}
      </p>
      <ul className="mt-3 space-y-2">
        {report.components.map((c) => {
          const meta = FLAG_META[c.flag];
          return (
            <li key={c.id} className="rounded-card bg-surface-container p-3 text-body-sm">
              <p className="flex flex-wrap items-center gap-2">
                <span aria-hidden="true">{meta.icon}</span>
                <span className="text-on-surface">{resolve(c.label)}</span>
                <span className="font-mono text-xs text-on-surface-variant">{c.region ?? "—"}</span>
                <span className={meta.tone}>· {t(meta.key)}</span>
              </p>
              {c.legalBasis !== undefined ? <p className="mt-1 text-on-surface-variant">{c.legalBasis}</p> : null}
            </li>
          );
        })}
      </ul>
      <Button variant="secondary" onClick={() => void downloadEvidence()} disabled={busy} className="mt-4">
        {busy ? t("generating") : t("downloadEvidence")}
      </Button>
      <p className="mt-2 text-body-sm text-on-surface-variant/80">{t("disclaimer")}</p>
    </Card>
  );
}
