"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState, type ReactElement } from "react";
import type { Recommendation } from "@/lib/engine";
import { useEngineText } from "@/lib/i18n/engine";
import { compareRealVsEstimated, type PostStatus, type RealCostEntry } from "@/lib/network/real-cost";
import { fetchWithTimeout } from "@/lib/utils/fetchWithTimeout";

// Collecte du coût réel (F13, S-082) : l'utilisateur déclare son coût RÉEL par poste (postes dérivés
// des couches de la reco) → comparaison live estimé/réel (moteur pur côté client) + écart coloré.
// Persistance dans le réseau SI consentement (opt-in F9). DÉFCON 1 : l'écart est un fait chiffré.

function statusClass(status: PostStatus): string {
  if (status === "within") return "text-primary";
  if (status === "over") return "text-error";
  return "text-tertiary"; // under
}

type PosteDef = { poste: string; estimated: number };

export function RealCostPanel({ result }: { result: Recommendation }): ReactElement {
  const t = useTranslations("RealCost");
  const resolve = useEngineText();

  // Postes = couches au coût > 0 + mise en route (one-time) si présente.
  const postes = useMemo<PosteDef[]>(() => {
    const layers = result.layers.filter((l) => l.cost > 0).map((l) => ({ poste: resolve(l.name), estimated: l.cost }));
    return result.setupCost > 0 ? [...layers, { poste: t("setupPoste"), estimated: result.setupCost }] : layers;
  }, [result.layers, result.setupCost, resolve, t]);

  const [real, setReal] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" | "error" }>({ kind: "idle" });

  const entries: RealCostEntry[] = useMemo(
    () => postes.map((p) => ({ poste: p.poste, estimated: p.estimated, real: Number(real[p.poste] ?? "") || 0 })),
    [postes, real],
  );
  const comparison = useMemo(() => compareRealVsEstimated(entries), [entries]);
  const hasInput = entries.some((e) => e.real > 0);

  const save = async (): Promise<void> => {
    setState({ kind: "saving" });
    try {
      const res = await fetchWithTimeout("/api/network/real-cost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries, consent }),
        cache: "no-store",
      });
      setState({ kind: res.ok ? "saved" : "error" });
    } catch {
      setState({ kind: "error" });
    }
  };

  return (
    <section className="rounded-card border border-outline-variant bg-surface-container-lowest p-5">
      <h3 className="font-display text-headline-md text-on-surface">{t("title")}</h3>
      <p className="mt-1 text-body-sm text-on-surface-variant">{t("intro")}</p>

      <table className="mt-4 w-full text-body-sm">
        <thead>
          <tr className="text-start text-on-surface-variant">
            <th className="py-1 text-start font-medium">{t("posteHeader")}</th>
            <th className="py-1 text-end font-medium">{t("estimatedHeader")}</th>
            <th className="py-1 text-end font-medium">{t("realHeader")}</th>
            <th className="py-1 text-end font-medium">{t("deltaHeader")}</th>
          </tr>
        </thead>
        <tbody>
          {postes.map((p) => {
            const cmp = comparison.posts.find((c) => c.poste === p.poste);
            const filled = (real[p.poste] ?? "") !== "" && Number(real[p.poste]) > 0;
            return (
              <tr key={p.poste} className="border-t border-outline-variant">
                <td className="py-2 text-on-surface">{p.poste}</td>
                <td className="py-2 text-end font-mono text-on-surface-variant">{p.estimated} €</td>
                <td className="py-2 text-end">
                  <input
                    type="number"
                    min={0}
                    inputMode="decimal"
                    aria-label={t("realAria", { poste: p.poste })}
                    value={real[p.poste] ?? ""}
                    onChange={(e) => setReal((r) => ({ ...r, [p.poste]: e.target.value }))}
                    className="w-24 rounded-input border border-outline-variant bg-surface px-2 py-1 text-end font-mono"
                  />
                </td>
                <td className={`py-2 text-end font-mono ${filled && cmp ? statusClass(cmp.status) : "text-on-surface-variant"}`}>
                  {filled && cmp ? `${cmp.deltaPct > 0 ? "+" : ""}${cmp.deltaPct} %` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {hasInput ? (
        <p className={`mt-3 text-body-sm ${comparison.withinTolerance ? "text-primary" : "text-error"}`}>
          {t("total", {
            estimated: comparison.totalEstimated,
            real: comparison.totalReal,
            delta: `${comparison.totalDeltaPct > 0 ? "+" : ""}${comparison.totalDeltaPct}`,
          })}
        </p>
      ) : null}

      <label className="mt-4 flex items-start gap-2 text-body-sm text-on-surface">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
        <span>{t("consentLabel")}</span>
      </label>

      <button
        type="button"
        onClick={() => void save()}
        disabled={!hasInput || state.kind === "saving"}
        className="mt-4 rounded-full bg-primary px-5 py-2 text-body-sm font-medium text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {state.kind === "saving" ? t("saving") : t("submit")}
      </button>
      {state.kind === "saved" ? <p className="mt-2 text-body-sm text-primary">{t("saved")}</p> : null}
      {state.kind === "error" ? <p className="mt-2 text-body-sm text-error">{t("error")}</p> : null}
    </section>
  );
}
