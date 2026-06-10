"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { SourcedEvidence } from "@/lib/evidence/types";
import type { CrossCheckType } from "@/lib/evidence/cross-check";

// Feature C — vérification d'authenticité externe : confronte un artefact client collé aux sources publiques
// (SearXNG+LLM). DÉFCON 1 : « incohérence » ≠ accusation de fraude ; « invérifiable » assumé.

const TYPES: CrossCheckType[] = ["provider-cert", "status-page", "legal-mention"];
const TYPE_KEY: Record<CrossCheckType, "typeProviderCert" | "typeStatusPage" | "typeLegalMention"> = {
  "provider-cert": "typeProviderCert",
  "status-page": "typeStatusPage",
  "legal-mention": "typeLegalMention",
};
const VERDICT_KEY: Record<string, "verdictMatch" | "verdictMismatch" | "verdictUnverifiable"> = {
  match: "verdictMatch",
  mismatch: "verdictMismatch",
  unverifiable: "verdictUnverifiable",
};

export function CrossCheckPanel(): ReactElement {
  const t = useTranslations("Results.crossCheck");
  const [type, setType] = useState<CrossCheckType>("provider-cert");
  const [artefact, setArtefact] = useState("");
  const [ev, setEv] = useState<SourcedEvidence | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (): Promise<void> => {
    setBusy(true);
    try {
      const res = await fetch("/api/evidence/cross-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artefact, type }),
      });
      if (!res.ok) return;
      const json: unknown = await res.json();
      if (typeof json === "object" && json !== null && "verdict" in json) setEv(json as SourcedEvidence);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h2 className="font-display text-headline-md text-on-surface">{t("title")}</h2>
      <p className="mt-1 max-w-2xl text-body-sm text-on-surface-variant">{t("intro")}</p>
      <label htmlFor="cc-type" className="mt-3 block text-label-caps uppercase text-on-surface-variant">
        {t("typeLabel")}
      </label>
      <select
        id="cc-type"
        value={type}
        onChange={(e) => setType(e.target.value as CrossCheckType)}
        className="mt-1 rounded-input border border-outline-variant bg-surface p-2 text-body-sm text-on-surface"
      >
        {TYPES.map((ty) => (
          <option key={ty} value={ty}>
            {t(TYPE_KEY[ty])}
          </option>
        ))}
      </select>
      <textarea
        value={artefact}
        onChange={(e) => setArtefact(e.target.value)}
        rows={5}
        placeholder={t("pastePlaceholder")}
        className="mt-2 w-full rounded-card border border-outline-variant bg-surface p-3 font-mono text-xs text-on-surface"
      />
      <Button variant="primary" onClick={() => void run()} disabled={busy || artefact.trim() === ""} className="mt-2">
        {busy ? t("running") : t("runButton")}
      </Button>
      {ev !== null ? (
        <div className="mt-4 rounded-card border border-outline-variant bg-surface p-3 text-body-sm" role="status">
          <p className="font-medium text-on-surface">{t(VERDICT_KEY[ev.verdict] ?? "verdictUnverifiable")}</p>
          {ev.rationale !== "" ? <p className="mt-1 text-on-surface-variant">{ev.rationale}</p> : null}
          {ev.sources.length > 0 ? (
            <ul className="mt-1 list-disc ps-5">
              {ev.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    {s.title || s.url}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-on-surface-variant/80">{t("noSources")}</p>
          )}
        </div>
      ) : null}
      <p className="mt-2 text-body-sm text-on-surface-variant/80">{t("disclaimer")}</p>
    </Card>
  );
}
