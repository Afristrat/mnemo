"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { useEngineText } from "@/lib/i18n/engine";
import type { Region, ResidencyPlan, TransferFlag } from "@/lib/engine";

type ResidencyPanelProps = {
  plan: ResidencyPlan;
};

const REGION_KEY: Record<Region, "regionEu" | "regionMaroc" | "regionUs" | "regionOther"> = {
  eu: "regionEu",
  maroc: "regionMaroc",
  us: "regionUs",
  other: "regionOther",
};

const STATUS_META: Record<TransferFlag["status"], { icon: string; labelKey: "statusOk" | "statusRestricted" | "statusForbidden"; tone: string }> = {
  ok: { icon: "✅", labelKey: "statusOk", tone: "text-primary" },
  restricted: { icon: "⚠️", labelKey: "statusRestricted", tone: "text-tertiary" },
  forbidden: { icon: "⛔", labelKey: "statusForbidden", tone: "text-error" },
};

// Base de transfert renvoyée par la veille live (S-062, `/api/legal/transfers`). Type local minimal
// (pas d'import du module serveur côté client) — seuls les champs consommés par le panneau.
type LiveBasis = {
  from: Region;
  to: Region;
  status: TransferFlag["status"];
  legalBasis: string;
  note?: string;
  checkedAt: string;
  provenance?: "seed" | "live" | "flagged";
};

/** Affichage effectif d'un transfert = base moteur (seed) éventuellement RAFRAÎCHIE par la veille live. */
type DisplayedTransfer = TransferFlag & { live?: "live" | "flagged"; checkedAt?: string };

/**
 * Panneau Résidence & transferts (S-048 + S-062) : topologie des régions, conformité des flux
 * inter-juridiction (pastilles autorisé/encadré/interdit + base légale datée), RPO/RTO régionaux et
 * alerte de conflit. Les statuts sont RAFRAÎCHIS par la veille juridique live (`/api/legal/transfers`,
 * réconcilié vs le repli daté — un signal divergent est `flagged` « à revérifier », jamais adopté en
 * douce) ; indispo → on garde le statut seed (gracieux). Disclaimer « ingénierie, pas un avis juridique ».
 */
export function ResidencyPanel({ plan }: ResidencyPanelProps): ReactElement | null {
  const t = useTranslations("Results.residencyPanel");
  const resolveEngine = useEngineText();
  const [live, setLive] = useState<LiveBasis[] | null>(null);
  const [checking, setChecking] = useState(false);

  const hasTransfers = plan.transfers.length > 0;

  // Veille live des statuts juridiques (S-062) : rafraîchit les transferts affichés. Au montage
  // seulement, si des transferts existent. Échec/indispo → on reste sur le seed (jamais bloquant).
  useEffect(() => {
    if (!hasTransfers) return;
    let cancelled = false;
    setChecking(true);
    void (async () => {
      try {
        const res = await fetch("/api/legal/transfers", { cache: "no-store" });
        if (!res.ok) return;
        const data: unknown = await res.json();
        if (!cancelled && data !== null && typeof data === "object" && Array.isArray((data as { bases?: unknown }).bases)) {
          setLive((data as { bases: LiveBasis[] }).bases);
        }
      } catch {
        /* repli silencieux : les statuts seed restent affichés. */
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasTransfers]);

  const hasDr = plan.drTier !== "none" || plan.activeActive;
  if (!hasDr && !hasTransfers && !plan.conflict.hasConflict) return null;

  const continuityMode = plan.activeActive
    ? t("modeActiveActive")
    : plan.drTier === "none"
      ? t("modeNone")
      : t("modeDr", { tier: plan.drTier });

  // Fusion : pour chaque transfert affiché, si la veille a une base live/flagged sur le même flux,
  // on adopte son statut/base légale/note + on marque la fraîcheur (jamais le seed silencieusement).
  const transfers: DisplayedTransfer[] = plan.transfers.map((tr) => {
    const match = live?.find((b) => b.from === tr.from && b.to === tr.to && (b.provenance ?? "seed") !== "seed");
    if (match === undefined) return tr;
    return {
      ...tr,
      status: match.status,
      legalBasis: match.legalBasis,
      note: match.note ?? tr.note,
      live: match.provenance === "flagged" ? "flagged" : "live",
      checkedAt: match.checkedAt,
    };
  });

  return (
    <Card>
      <h3 className="font-display text-headline-md text-on-surface">{t("title")}</h3>
      <p className="mt-1 text-body-sm text-on-surface-variant">{t("intro")}</p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-label-caps uppercase text-on-surface-variant">{t("primaryRegion")}</dt>
          <dd className="text-body-md text-on-surface">{t(REGION_KEY[plan.primaryRegion])}</dd>
        </div>
        <div>
          <dt className="text-label-caps uppercase text-on-surface-variant">{t("continuity")}</dt>
          <dd className="text-body-md text-on-surface">
            {t("continuityValue", { mode: continuityMode, rpo: plan.rpoMinutes, rto: plan.rtoMinutes })}
          </dd>
        </div>
      </dl>

      {hasTransfers ? (
        <div className="mt-4">
          <p className="flex items-center gap-2 text-label-caps uppercase text-on-surface-variant">
            {t("transfersTitle")}
            {checking ? <span className="font-mono normal-case text-on-surface-variant/70">· {t("liveChecking")}</span> : null}
          </p>
          <ul className="mt-2 space-y-2">
            {transfers.map((transfer) => {
              const meta = STATUS_META[transfer.status];
              return (
                <li key={`${transfer.from}-${transfer.to}`} className="rounded-card bg-surface-container p-3 text-body-sm">
                  <p className="flex flex-wrap items-center gap-2">
                    <span aria-hidden="true">{meta.icon}</span>
                    <span className="text-on-surface">
                      {t(REGION_KEY[transfer.from])} → {t(REGION_KEY[transfer.to])}
                    </span>
                    <span className={meta.tone}>· {t(meta.labelKey)}</span>
                    {transfer.live === "live" ? (
                      <span className="font-mono text-xs text-primary">{t("liveFresh", { date: transfer.checkedAt ?? "" })}</span>
                    ) : transfer.live === "flagged" ? (
                      <span className="font-mono text-xs text-tertiary">{t("liveFlagged", { date: transfer.checkedAt ?? "" })}</span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-on-surface-variant">
                    <span className="font-medium text-on-surface">{t("legalBasis")}</span>
                    {transfer.legalBasis}
                  </p>
                  {transfer.note !== "" ? <p className="mt-1 text-on-surface-variant/80">{transfer.note}</p> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : hasDr ? (
        <p className="mt-4 text-body-sm text-on-surface-variant">{t("noTransfers")}</p>
      ) : null}

      {plan.conflict.hasConflict ? (
        <div className="mt-4 rounded-card border border-error/40 bg-error/5 p-4 text-body-sm" role="alert">
          <p className="font-medium text-error">{t("conflictTitle")}</p>
          <p className="mt-1 text-on-surface-variant">{resolveEngine(plan.conflict.reason)}</p>
          <p className="mt-2 text-on-surface">{t("conflictLevers")}</p>
          <ul className="mt-1 list-disc space-y-1 ps-5 text-on-surface-variant">
            {plan.conflict.levers.map((lever) => (
              <li key={lever.id}>{resolveEngine(lever)}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
