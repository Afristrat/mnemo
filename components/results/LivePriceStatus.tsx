"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { StatusDot } from "@/components/ui/StatusDot";
import type { LivePriceItem } from "@/lib/pricing/live-feed";
import type { PriceStatus } from "@/lib/pricing/reconcile";

const STATUS_TONE: Record<PriceStatus, "primary" | "error" | "neutral"> = {
  live: "primary",
  flagged: "error",
  fallback: "neutral",
};
const STATUS_KEY: Record<PriceStatus, "statusLive" | "statusFlagged" | "statusFallback"> = {
  live: "statusLive",
  flagged: "statusFlagged",
  fallback: "statusFallback",
};

type FeedState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; items: LivePriceItem[]; generatedAt: string };

function formatEur(amount: number): string {
  if (amount === 0) return "0 €";
  return `${amount.toLocaleString("fr-FR", { maximumSignificantDigits: 4 })} €`;
}

/**
 * Provenance des prix d'infra **extraits en direct** (Firecrawl) et réconciliés vs la baseline
 * sourcée (garde-fou DÉFCON 1). Rend visible le statut par poste : promu (live), rejeté au profit
 * de la baseline (à revérifier), ou repli (extraction indisponible). Sources cliquables + date.
 */
export function LivePriceStatus(): ReactElement {
  const t = useTranslations("Results.livePrices");
  const [state, setState] = useState<FeedState>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const response = await fetch("/api/pricing/live", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload: { items?: LivePriceItem[]; generatedAt?: string } = await response.json();
      setState({
        kind: "ready",
        items: payload.items ?? [],
        generatedAt: payload.generatedAt ?? "",
      });
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
      <p className="mt-2 rounded-card bg-surface-container px-3 py-2 text-body-sm text-on-surface-variant">
        {t("fallbackNote")}
      </p>

      {state.kind === "error" ? (
        <p className="mt-4 text-body-sm text-error">{t("error")}</p>
      ) : null}

      {state.kind === "loading" ? (
        <p className="mt-4 text-body-sm text-on-surface-variant">{t("loadingMsg")}</p>
      ) : null}

      {state.kind === "ready" ? (
        <ul className="mt-4 divide-y divide-outline-variant">
          {state.items.map((it) => {
            return (
              <li key={it.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="flex items-center gap-2">
                  <StatusDot confidence={it.confidence} />
                  {it.url.length > 0 ? (
                    <a
                      href={it.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-body-sm text-secondary underline decoration-dotted"
                    >
                      {it.label}
                    </a>
                  ) : (
                    <span className="text-body-sm text-on-surface">{it.label}</span>
                  )}
                  <Chip tone={STATUS_TONE[it.status]}>{t(STATUS_KEY[it.status])}</Chip>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-body-sm text-on-surface-variant">
                    {formatEur(it.amountEur)}/{it.unit}
                  </span>
                  <span className="font-mono text-body-sm text-on-surface-variant">{it.checkedAt}</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Card>
  );
}
