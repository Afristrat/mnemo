"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState, type ReactElement } from "react";
import { CheckboxCards } from "@/components/wizard/CheckboxCards";
import { StatusDot } from "@/components/ui/StatusDot";
import type { Regulation } from "@/lib/engine";
import type { RegimeSuggestion } from "@/lib/legal/regime-seed";
import type { Option } from "@/lib/wizard/options";
import { fetchWithTimeout } from "@/lib/utils/fetchWithTimeout";

type RegimeFeedResponse = { regimes?: RegimeSuggestion[]; source?: string };

type RegimeDetectorProps = {
  /** Pays cible (code geography) — obligatoire pour la détection. */
  targetCountry: string;
  /** Libellé localisé du pays cible (pour le bouton). */
  targetCountryLabel: string;
  /** Pays de résidence des clients sélectionnés (codes). */
  clientResidence: string[];
  /** Toutes les juridictions concrètes (multi-input résidence). */
  residenceOptions: Option<string>[];
  onToggleResidence: (code: string) => void;
  /** Pré-coche les régimes mappables détectés (codes énum moteur). Les cases manuelles restent maîtres. */
  onDetected: (codes: Regulation[]) => void;
};

type Status = { kind: "idle" } | { kind: "loading" } | { kind: "error" } | { kind: "ready"; regimes: RegimeSuggestion[] };

/**
 * Détection dynamique des régimes (S-077) : à partir du pays cible + des pays de résidence des clients,
 * interroge la veille (`/api/legal/regimes`), PRÉ-COCHE les régimes mappables sur l'énum moteur (les
 * cases manuelles restent maîtres = repli) et LISTE les régimes sourcés non mappables (lien + confiance +
 * « à valider par un conseil »). Jamais d'avis juridique. Bornée par timeout (repli rapide).
 */
export function RegimeDetector({
  targetCountry,
  targetCountryLabel,
  clientResidence,
  residenceOptions,
  onToggleResidence,
  onDetected,
}: RegimeDetectorProps): ReactElement {
  const t = useTranslations("Wizard.regimeDetector");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const detect = useCallback(async () => {
    setStatus({ kind: "loading" });
    try {
      const res = await fetchWithTimeout("/api/legal/regimes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: targetCountry, residences: clientResidence }),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: RegimeFeedResponse = await res.json();
      const regimes = Array.isArray(data.regimes) ? data.regimes : [];
      // Pré-cochage : régimes mappables sur l'énum moteur (dédupliqués).
      const codes = Array.from(
        new Set(regimes.map((r) => r.code).filter((c): c is Regulation => c !== null && c !== undefined)),
      );
      if (codes.length > 0) onDetected(codes);
      setStatus({ kind: "ready", regimes });
    } catch {
      setStatus({ kind: "error" });
    }
  }, [targetCountry, clientResidence, onDetected]);

  return (
    <details className="mt-3 rounded-card border border-outline-variant bg-surface-container-lowest p-4">
      <summary className="cursor-pointer text-body-sm font-medium text-on-surface">{t("summary")}</summary>

      <p className="mt-3 text-body-sm text-on-surface-variant">{t("residenceLabel")}</p>
      <div className="mt-2">
        <CheckboxCards values={clientResidence} options={residenceOptions} onToggle={onToggleResidence} />
      </div>

      <button
        type="button"
        onClick={() => void detect()}
        disabled={status.kind === "loading"}
        className="mt-4 rounded-full bg-primary px-5 py-2 text-body-sm font-medium text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {status.kind === "loading" ? t("detecting") : t("detectButton", { country: targetCountryLabel })}
      </button>

      {status.kind === "error" ? <p className="mt-3 text-body-sm text-error">{t("error")}</p> : null}

      {status.kind === "ready" ? (
        status.regimes.length === 0 ? (
          <p className="mt-3 text-body-sm text-on-surface-variant">{t("empty")}</p>
        ) : (
          <div className="mt-4">
            <p className="text-label-caps uppercase text-on-surface-variant">{t("resultsTitle")}</p>
            <ul className="mt-2 divide-y divide-outline-variant">
              {status.regimes.map((r) => (
                <li key={`${r.country}-${r.name}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="flex items-center gap-2">
                    <StatusDot confidence={r.confidence} />
                    {r.source.url.length > 0 ? (
                      <a
                        href={r.source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-body-sm text-secondary underline decoration-dotted"
                      >
                        {r.name}
                      </a>
                    ) : (
                      <span className="text-body-sm text-on-surface">{r.name}</span>
                    )}
                    <span className="text-body-sm text-on-surface-variant">
                      {r.code !== null ? t("mappedNote") : t("unmappedNote")}
                    </span>
                  </span>
                  <span className="font-mono text-body-sm text-on-surface-variant">{r.source.checkedAt}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-body-sm text-on-surface-variant">{t("disclaimer")}</p>
          </div>
        )
      ) : null}
    </details>
  );
}
