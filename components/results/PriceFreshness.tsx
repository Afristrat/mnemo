"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { StatusDot } from "@/components/ui/StatusDot";
import type { PriceFeedStatus, PriceObservation } from "@/lib/pricing/feed";

const STATUS_TONE: Record<PriceFeedStatus, "primary" | "error" | "neutral"> = {
  verified: "primary",
  changed: "error",
  unavailable: "neutral",
};
const STATUS_KEY: Record<PriceFeedStatus, "statusVerified" | "statusChanged" | "statusUnavailable"> = {
  verified: "statusVerified",
  changed: "statusChanged",
  unavailable: "statusUnavailable",
};

type FeedState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; observations: PriceObservation[] };

export function PriceFreshness(): ReactElement {
  const t = useTranslations("Results.freshness");
  const [state, setState] = useState<FeedState>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const response = await fetch("/api/pricing", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload: { observations: PriceObservation[] } = await response.json();
      setState({ kind: "ready", observations: payload.observations });
    } catch {
      setState({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-headline-md text-on-surface">{t("title")}</h3>
        <button
          type="button"
          onClick={() => void load()}
          disabled={state.kind === "loading"}
          className="rounded-full border border-outline-variant px-4 py-1.5 text-body-sm font-medium text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50"
        >
          {state.kind === "loading" ? t("refreshing") : t("refresh")}
        </button>
      </div>
      <p className="mt-1 text-body-sm text-on-surface-variant">{t("intro")}</p>

      {state.kind === "error" ? (
        <p className="mt-4 text-body-sm text-error">{t("error")}</p>
      ) : null}

      {state.kind === "loading" ? (
        <p className="mt-4 text-body-sm text-on-surface-variant">{t("loadingMsg")}</p>
      ) : null}

      {state.kind === "ready" ? (
        <ul className="mt-4 divide-y divide-outline-variant">
          {state.observations.map((obs) => {
            return (
              <li key={obs.layerId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="flex items-center gap-2">
                  <StatusDot confidence={obs.confidence} />
                  <a
                    href={obs.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-body-sm text-secondary underline decoration-dotted"
                  >
                    {obs.label}
                  </a>
                  <Chip tone={STATUS_TONE[obs.status]}>{t(STATUS_KEY[obs.status])}</Chip>
                </span>
                <span className="flex items-center gap-3">
                  {obs.sampleFigures.length > 0 ? (
                    <span className="font-mono text-body-sm text-on-surface-variant">
                      {obs.sampleFigures.join(" · ")}
                    </span>
                  ) : null}
                  <span className="font-mono text-body-sm text-on-surface-variant">{obs.checkedAt}</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Card>
  );
}
