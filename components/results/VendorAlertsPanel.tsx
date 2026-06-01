"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { useEngineText } from "@/lib/i18n/engine";
import { fetchWithTimeout } from "@/lib/utils/fetchWithTimeout";
import type { Message } from "@/lib/engine/message";

// Broadcast d'alertes vendor (F13, S-084) : au montage, interroge `/api/network/vendor-alerts` qui
// lance la veille prix live (S-025), détecte les variations vs la baseline datée et renvoie des alertes
// SOURCÉES. DÉFCON 1 : chaque alerte est un FAIT chiffré et sourcé (ancien → nouveau + écart + source
// datée), jamais une reco d'achat. Faits de prix PUBLICS → diffusés à tout membre (broadcast réseau) ;
// aucune variation détectée → message rassurant. Indispo/aberration → état d'erreur gracieux.

type Severity = "info" | "notable" | "major";
type DisplayAlert = { summary: Message; severity: Severity; url: string; checkedAt: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Reconstruit un descripteur `Message` sérialisé (sans `as`), en ne gardant que des valeurs ICU sûres. */
function parseMessage(v: unknown): Message | null {
  if (!isRecord(v) || typeof v.id !== "string") return null;
  if (!isRecord(v.values)) return { id: v.id };
  const values: Record<string, string | number> = {};
  for (const [k, val] of Object.entries(v.values)) {
    if (typeof val === "string" || typeof val === "number") values[k] = val;
  }
  return { id: v.id, values };
}

function parseAlert(v: unknown): DisplayAlert | null {
  if (!isRecord(v)) return null;
  const summary = parseMessage(v.summary);
  if (summary === null) return null;
  const severity: Severity = v.severity === "major" ? "major" : v.severity === "notable" ? "notable" : "info";
  const source = isRecord(v.source) ? v.source : {};
  return { summary, severity, url: str(source.url), checkedAt: str(source.checkedAt) };
}

const SEVERITY_TONE: Record<Severity, string> = {
  info: "text-on-surface-variant",
  notable: "text-tertiary",
  major: "text-error",
};

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; alerts: DisplayAlert[] };

export function VendorAlertsPanel(): ReactElement | null {
  const t = useTranslations("Results.vendorAlertsPanel");
  const resolve = useEngineText();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchWithTimeout("/api/network/vendor-alerts", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setState({ kind: "error" });
          return;
        }
        const data: unknown = await res.json();
        const raw = isRecord(data) && Array.isArray(data.alerts) ? data.alerts : [];
        const alerts: DisplayAlert[] = [];
        for (const a of raw) {
          const parsed = parseAlert(a);
          if (parsed !== null) alerts.push(parsed);
        }
        if (!cancelled) setState({ kind: "ready", alerts });
      } catch {
        if (!cancelled) setState({ kind: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <h3 className="font-display text-headline-md text-on-surface">{t("title")}</h3>
      <p className="mt-1 text-body-sm text-on-surface-variant">{t("intro")}</p>

      {state.kind === "loading" ? (
        <p className="mt-4 text-body-sm text-on-surface-variant">{t("loading")}</p>
      ) : state.kind === "error" ? (
        <p className="mt-4 text-body-sm text-on-surface-variant">{t("error")}</p>
      ) : state.alerts.length === 0 ? (
        <p className="mt-4 text-body-sm text-on-surface-variant">{t("empty")}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {state.alerts.map((alert, i) => (
            <li key={`${alert.summary.id}-${i}`} className="rounded-card bg-surface-container p-3 text-body-sm">
              <p className="flex flex-wrap items-center gap-2">
                <span className={`font-mono text-xs uppercase ${SEVERITY_TONE[alert.severity]}`}>{t(`severity_${alert.severity}`)}</span>
                <span className="text-on-surface">{resolve(alert.summary)}</span>
              </p>
              {alert.url !== "" ? (
                <p className="mt-1 text-on-surface-variant/80">
                  <a href={alert.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    {t("source", { date: alert.checkedAt })}
                  </a>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
